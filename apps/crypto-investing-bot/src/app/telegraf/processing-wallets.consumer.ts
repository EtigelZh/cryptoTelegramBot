import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import {
  RequestErrorData,
  ZerionApiService,
} from '../zerion-api/zerion-api.service';
import { AppConfig } from '../app.config';
import { AxiosError } from 'axios';
import { inspect } from 'util';
import { Job, Queue } from 'bull';
import { walletQueueName } from './queues';
import {
  CreateOrUpdateWalletArgs,
  FillFinanceDataFromSheetsArgs,
  UpdateSheetValuesArgs,
  googleSheetsApiQueueName,
} from './google-sheets.consumer';
import { googleDriveQueueName } from './google-drive.consumer';
import { TelegramJobApiService } from './telegram-job-api.service';
import { FinanceData } from '../google-sheet/google-sheets/google-sheets.models';
import { SaveToDbApiJobService } from './save-to-db.consumer';

@Processor(walletQueueName)
export class ProcessingWalletsConsumer {
  constructor(
    private readonly appConfig: AppConfig,
    private readonly zerionService: ZerionApiService,
    private readonly _telegramJobApiService: TelegramJobApiService,
    private readonly _saveToDbApiJobService: SaveToDbApiJobService,

    @InjectQueue(googleSheetsApiQueueName) private _googleSheetsQueue: Queue,
    @InjectQueue(googleDriveQueueName) private _googleDriveQueue: Queue
  ) {}

  @Process({
    name: 'process',
    concurrency: AppConfig.walletProcessorConcurrency,
  })
  async process(
    job: Job<{
      walletHash: string;
      chatId: number;
      suffix: string;
      parentMessageId: number | null;
      input: string;
    }>
  ) {
    return await this.processWallet(
      job.data.walletHash,
      job.data.chatId,
      job.data.suffix,
      job.data.parentMessageId,
      job.data.input
    );
  }

  private async _copySpreadSheet(newSheetName: string) {
    const job = await this._googleDriveQueue.add('copySpreadSheet', {
      templateGoogleSheetId: this.appConfig.templateGoogleSheetId,
      newSheetName,
      targetGoogleSheetDirectoryId: this.appConfig.targetGoogleSheetDirectoryId,
    });
    return await job.finished();
  }

  private async _updateSheetValues(
    spreadsheetId: string,
    range: string,
    valueInputOption: 'USER_ENTERED' | 'RAW',
    requestBody: unknown
  ) {
    const job = await this._googleSheetsQueue.add('sheetValuesUpdate', <
      UpdateSheetValuesArgs
    >{
      spreadsheetId,
      range,
      valueInputOption,
      requestBody,
    });
    return job;
  }

  private async _updateOrAddWallet(
    walletHash: string,
    summary7days: FinanceData | null,
    summary30days: FinanceData | null,
    error?: [string, 'HTTP_400' | 'HTTP' | 'OTHER'],
  ) {
    const job = await this._googleSheetsQueue.add('createOrUpdateWallet', <
      CreateOrUpdateWalletArgs
    >{
      spreadsheetId: this.appConfig.summaryWalletsSheetId,
      walletHash,
      walletData: [summary7days, summary30days],
      error,
    });
    return job;
  }

  private async _fillFinanceDataFromSheets(
    spreadsheetId: string,
    walletHash: string,
    sheetName: string
  ): Promise<FinanceData> {
    const job = await this._googleSheetsQueue.add('fillFinanceDataFromSheets', <
      FillFinanceDataFromSheetsArgs
    >{
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
      await this._telegramJobApiService.editMessageText(
        chatId,
        messageText,
        lastMessageId
      );
    } else {
      const sentMessage = await this._telegramJobApiService.sendMessage(
        chatId,
        messageText
      );
      lastMessageId = sentMessage.message_id;
    }
    return lastMessageId;
  }

  private async processWallet(
    walletHash: string,
    chatId: number,
    suffix: string,
    parentMessageId: number | null,
    input: string
  ): Promise<{ summarySheetUpdated?: boolean }> {
    const globalPrefix = `Скачиваю транзакции для кошелька ${walletHash}. ${suffix}`;
    let lastApiCallMessageId = parentMessageId;
    let lastText = globalPrefix;
    try {
      lastApiCallMessageId = await this.createOrUpdateLastMessage(
        parentMessageId,
        globalPrefix,
        chatId
      );
      
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
        1000,
        input
      );
      if (transactions.error) {
        const [text, status] = this.formatErrorMessage(transactions.error);
        this.createOrUpdateLastMessage(
          lastApiCallMessageId,
          `${lastText}\nОшибка при скачивании транзакций: ${text} ${status}`,
          chatId,
        );

        if (status === 'HTTP_400') {
          await this._updateOrAddWallet(walletHash, null, null, [text, status]);
        }

        return {};
      }
      const csvData = await this.zerionService.getCsvTransactions(
        transactions.data
      );
      if (csvData.errors.length) {
        const errorMessages = csvData.errors
          .map((error) => `Строка ${error.rowIndex}: ${error.message}`)
          .join('\n');
          this.createOrUpdateLastMessage(
            lastApiCallMessageId,
            `${lastText}\nОшибка при трансформации csv транзакций: ${errorMessages}`,
            chatId,
        );

        return {};
      }
      let fungiblePositionsCsv = [];
      try {
        fungiblePositionsCsv = await this.zerionService.getFungiblePositionsCsv(
          walletHash,
          input
        );
      } catch (error) {
        Logger.error(
          `Error fetching transactions for wallet ${walletHash}: ${error}`
        );
        this.createOrUpdateLastMessage(
          lastApiCallMessageId,
          `${lastText}\nОшибка при скачивании текущего потфеля: ${this.formatErrorMessage(
            error
          )}`,
          chatId
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
      const document = await this._copySpreadSheet(
        `выгрузка от ${now} транзакции с ${startTransactionDate} по ${endTransactionDate} кошелек - ${walletHash}`
      );

      const url = `https://docs.google.com/spreadsheets/d/${document.id}/edit`;

      const updatingData = csvData.data.slice(1);

      const job = await this._updateSheetValues(
        document.id,
        'Исходник!A2',
        'USER_ENTERED',
        {
          values: updatingData,
        }
      );
      // TODO над построением графа вычислений
      const updates = [job.finished()];
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
      updates.push(
        this.createOrUpdateLastMessage(
          lastApiCallMessageId,
          lastText + `\nСоздан новый документ: ${url}\n`,
          chatId
        )
      );
      await Promise.allSettled(updates);
      // Gap for google sheets to update (5 seconds) we are have floating bag, when put incorrect data to aggregated google sheets
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      const [summary7days, summary30days] = await Promise.all([
        this._fillFinanceDataFromSheets(
          document.id,
          walletHash,
          'Анализ 7 дней'
        ),
        this._fillFinanceDataFromSheets(
          document.id,
          walletHash,
          'Анализ 30 дней'
        ),
      ]);

      await Promise.allSettled([
        this._saveToDbApiJobService.saveToDbFinancialData(summary7days),
        this._saveToDbApiJobService.saveToDbFinancialData(summary30days),
      ]);

      await this._updateOrAddWallet(walletHash, summary7days, summary30days);
      return {
        summarySheetUpdated: true,
      };
    } catch (error) {
      Logger.error(
        `Error fetching transactions for wallet ${walletHash}: ${error}`
      );
      this.createOrUpdateLastMessage(
        lastApiCallMessageId,
        `${lastText}\nОшибка при скачивании транзакций: ${this.formatErrorMessage(error)}`,
        chatId
      );
    }
  }

  private formatErrorMessage(
    error: Error | AxiosError<RequestErrorData>
  ): [string, 'HTTP_400' | 'HTTP' | 'OTHER'] {
    if (
      this.isAxiosError(error) &&
      error.response &&
      error.response.data &&
      error.response.data
    ) {
      const fullError = inspect(error.response.data.errors);
      console.log('error.response.data.message', fullError);

      return [`Ошибка API запроса: ${fullError.substring(0, 256)} Стаутс код: ${
        error.response.statusText
      } ${error.response.status} API`, error.response.status === 400 ? 'HTTP_400' : 'HTTP'];
    }
    return [error?.toString() || String(error), 'OTHER'];
  }

  private isAxiosError(error: Error): error is AxiosError<RequestErrorData> {
    return Array.isArray(
      (error as AxiosError<RequestErrorData>)?.response?.data?.errors
    );
  }
}
