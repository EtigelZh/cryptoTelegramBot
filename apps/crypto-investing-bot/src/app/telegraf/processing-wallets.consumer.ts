import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { FinanceData, GoogleSheetsService } from '../google-sheet/google-sheets/google-sheets.service';
import {
  RequestErrorData,
  ZerionApiService,
} from '../zerion-api/zerion-api.service';
import { AppConfig } from '../app.config';
import { AxiosError } from 'axios';
import { inspect } from 'util';
import { Job, Queue } from 'bull';
import { telegramQueueName, walletQueueName } from './queues';
import { CreateOrUpdateWalletArgs, FillFinanceDataFromSheetsArgs, UpdateSheetValuesArgs, googleSheetsApiQueueName } from './google-sheets.consumer';
import { googleDriveQueueName } from './google-drive.consumer';

@Processor(walletQueueName)
export class ProcessingWalletsConsumer {
  constructor(
    private readonly appConfig: AppConfig,
    private readonly zerionService: ZerionApiService,
    @InjectQueue(telegramQueueName) private telegramQueue: Queue,
    @InjectQueue(googleSheetsApiQueueName) private _googleSheetsQueue: Queue,
    @InjectQueue(googleDriveQueueName) private _googleDriveQueue: Queue,
  ) {}

  @Process({
    name: 'process',
    concurrency: +(process.env.WALLET_PROCESSOR_CONCURRENCY || 4),
  })
  async process(
    job: Job<{
      walletHash: string;
      chatId: number;
      suffix: string;
      parentMessageId: number | null;
    }>
  ) {
    return await this.processWallet(
      job.data.walletHash,
      job.data.chatId,
      job.data.suffix,
      job.data.parentMessageId
    );
  }

  private async _sendMessage(chatId: number, message: string): Promise<{ message_id: number }> {
    const job = await this.telegramQueue.add('sendMessage',{
      chatId,
      message,
    }, { removeOnComplete: true });

    return job.finished();
  }

  private async _editMessageText(
    chatId: number,
    message: string,
    messageId: number,
    inlineMessageId?: string
  ) {
    const jobId = `${chatId}-${messageId}`;
    try {
      const foundJob = await this.telegramQueue.getJob(jobId);
      if (foundJob && await foundJob.isWaiting()) {
        Logger.log(`Removing old job ${jobId}`);
        try {
          await foundJob.remove();
        } catch (e) {
          Logger.error(`Error removing old job: ${e}`);
        }
       
      }
      // remove old jobs for update
      const job = await this.telegramQueue.add('editMessageText', {
        chatId,
        message,
        messageId,
        inlineMessageId,
      }, { removeOnComplete: true, jobId: `${chatId}-${messageId}` });
  
      return job;
    } catch (e) {
      Logger.error(`Error editing message: ${e}`);
    }
  }

  private async _copySpreadSheet(newSheetName: string) {
    const job = await this._googleDriveQueue.add('copySpreadSheet', {
      templateGoogleSheetId: this.appConfig.templateGoogleSheetId,
      newSheetName,
      targetGoogleSheetDirectoryId: this.appConfig.targetGoogleSheetDirectoryId
    })
    return await job.finished();
  }

  private async _updateSheetValues(spreadsheetId: string,
    range: string,
    valueInputOption: 'USER_ENTERED' | 'RAW',
    requestBody: unknown) {
    const job = await this._googleSheetsQueue.add('sheetValuesUpdate', <UpdateSheetValuesArgs>{
      spreadsheetId,
      range,
      valueInputOption,
      requestBody,
    });
    return job;
  }

  private async _updateOrAddWallet(walletHash: string, summary7days: FinanceData, summary30days: FinanceData) {
    const job = await this._googleSheetsQueue.add('createOrUpdateWallet', <CreateOrUpdateWalletArgs>{
      spreadsheetId: this.appConfig.summaryWalletsSheetId,
      walletHash,
      walletData: [
        summary7days,
        summary30days,
      ],
    });
    return job;
  }

  private async _fillFinanceDataFromSheets(spreadsheetId: string, walletHash: string, sheetName: string): Promise<FinanceData> {
    const job = await this._googleSheetsQueue.add('fillFinanceDataFromSheets', <FillFinanceDataFromSheetsArgs>{
      spreadsheetId,
      walletHash,
      sheetName,
    });
    return job.finished();
  }

  private async createOrUpdateLastMessage(
    lastMessageId: number | null,
    messageText: string,
    chatId: number
  ): Promise<number> {
    if (lastMessageId) {
      await this._editMessageText(chatId, messageText, lastMessageId);
    } else {
      const sentMessage = await this._sendMessage(chatId, messageText);
      lastMessageId = sentMessage.message_id;
    }
    return lastMessageId;
  }

  private async processWallet(
    walletHash: string,
    chatId: number,
    suffix: string,
    parentMessageId: number | null
  ): Promise<{ summarySheetUpdated?: boolean }> {
    try {
      const globalPrefix = `Скачиваю транзакции для кошелька ${walletHash}. ${suffix}`;
      let lastApiCallMessageId = await this.createOrUpdateLastMessage(
        parentMessageId,
        globalPrefix,
        chatId
      );
      let lastText = null;
      const transactions = await this.zerionService.getTransactions(
        walletHash,
        async (
          minuteRequests,
          dayRequests,
          maxRequestsPerMinute,
          cacheHitsToday,
          data
        ) => {
          if (data.length === 0) {
            return;
          }
          const prefix =
            minuteRequests >= maxRequestsPerMinute && lastApiCallMessageId
              ? '⚠️Превышен лимит запросов к API в минуту.\nОжидаем сброса таймера. '
              : '';

          const messageText = `${globalPrefix}\n${prefix}Скачано ${
            data.length
          } транзакций.\nДата последней скачанной транзакции: ${data[
            data.length - 1
          ]?.attributes?.mined_at?.substring(
            0,
            10
          )}\nЗапросов в минуту: ${minuteRequests}/${maxRequestsPerMinute}. Запросов сегодня: ${dayRequests}/5000\nПопаданий в кеш: ${cacheHitsToday}`;
          lastText = messageText;
          lastApiCallMessageId = await this.createOrUpdateLastMessage(
            lastApiCallMessageId,
            messageText,
            chatId
          );
        },
        1000
      );
      if (transactions.error) {
        await this._sendMessage(
          chatId,
          `Ошибка при скачивании транзакций: ${this.formatErrorMessage(
            transactions.error
          )}`
        );

        return {};
      }
      const csvData = await this.zerionService.getCsvTransactions(
        transactions.data
      );
      if (csvData.errors.length) {
        const errorMessages = csvData.errors
          .map((error) => `Строка ${error.rowIndex}: ${error.message}`)
          .join('\n');
        this._sendMessage(
          chatId,
          `Ошибка при трансформации csv транзакций: ${errorMessages}`
        );

        return {};
      }
      let fungiblePositionsCsv = [];
      try {
        fungiblePositionsCsv = await this.zerionService.getFungiblePositionsCsv(
          walletHash
        );
      } catch (error) {
        Logger.error(
          `Error fetching transactions for wallet ${walletHash}: ${error}`
        );
        this._sendMessage(
          chatId,
          `Ошибка при скачивании текущего потфеля: ${this.formatErrorMessage(
            error
          )}`
        );
      }

      const startTransactionDate = (
        transactions.data[transactions.data.length - 1]?.attributes?.mined_at ||
        new Date().toISOString()
      ).substring(0, 10);
      const endTransactionDate = (
        transactions.data[0]?.attributes?.mined_at || new Date().toISOString()
      ).substring(0, 10);
      const now = new Date().toISOString().substr(0, 16).replace('T', ' ');
      const document = await this._copySpreadSheet(`выгрузка от ${now} транзакции с ${startTransactionDate} по ${endTransactionDate} кошелек - ${walletHash}`);
      
      const url = `https://docs.google.com/spreadsheets/d/${document.id}/edit`;

      const updatingData = csvData.data.slice(1);

      const job = await this._updateSheetValues(
        document.id,
        'Исходник!A2',
        'USER_ENTERED',
        {
          values: updatingData,
        },
      );
      // TODO над построением графа вычислений
      const updates = [
        job.finished(),
      ];
      if (fungiblePositionsCsv.length) {
        const job = await this._updateSheetValues(
          document.id,
          'Портфель исходник!A2',
          'USER_ENTERED',
          {
            values: fungiblePositionsCsv,
          }
        );
        updates.push(job.finished());
      }
      updates.push(this.createOrUpdateLastMessage(
        lastApiCallMessageId,
        lastText + `\nСоздан новый документ: ${url}\n`,
        chatId
      ));
      await Promise.allSettled(updates);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const [summary7days, summary30days] = await Promise.all([
        this._fillFinanceDataFromSheets(
          document.id,
          walletHash,
          'Анализ 7 дней',
        ),
        this._fillFinanceDataFromSheets(
          document.id,
          walletHash,
          'Анализ 30 дней',
        ),
      ]);

      await this._updateOrAddWallet(
        walletHash,
        summary7days, 
        summary30days,
      );
      return {
        summarySheetUpdated: true,
      };
    } catch (error) {
      Logger.error(
        `Error fetching transactions for wallet ${walletHash}: ${error}`
      );
      this._sendMessage(
        chatId,
        `Ошибка при скачивании транзакций: ${this.formatErrorMessage(error)}`
      );
    }
  }

  private formatErrorMessage(
    error: Error | AxiosError<RequestErrorData>
  ): string {
    if (
      this.isAxiosError(error) &&
      error.response &&
      error.response.data &&
      error.response.data
    ) {
      const fullError = inspect(error.response.data.errors);
      console.log('error.response.data.message', fullError);

      return `Ошибка API запроса: ${fullError.substring(0, 256)} Стаутс код: ${
        error.response.statusText
      } ${error.response.status} API `;
    }
    return error?.toString() || String(error);
  }

  private isAxiosError(error: Error): error is AxiosError<RequestErrorData> {
    return Array.isArray(
      (error as AxiosError<RequestErrorData>)?.response?.data?.errors
    );
  }
}
