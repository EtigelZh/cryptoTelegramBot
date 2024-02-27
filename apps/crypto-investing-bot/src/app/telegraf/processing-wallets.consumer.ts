import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { TELEGRAF } from './telegraf.token';
import { Telegraf } from 'telegraf';
import { GoogleSheetsService } from '../google-sheet/google-sheets/google-sheets.service';
import { GoogleDriveService } from '../google-sheet/google-drive.service';
import {
  RequestErrorData,
  ZerionApiService,
} from '../zerion-api/zerion-api.service';
import { AppConfig } from '../app.config';
import { AxiosError } from 'axios';
import { inspect } from 'util';
import { Job } from 'bull';

@Processor('processingWallet')
export class ProcessingWalletsConsumer {
  constructor(
    private readonly appConfig: AppConfig,
    private readonly zerionService: ZerionApiService,
    private readonly googleDrive: GoogleDriveService,
    private readonly googleSheets: GoogleSheetsService,
    @Inject(TELEGRAF)
    private readonly bot: Telegraf
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

  private async createOrUpdateLastMessage(
    lastMessageId: number | null,
    messageText: string,
    chatId: number
  ): Promise<number> {
    if (lastMessageId) {
      await this.bot.telegram.editMessageText(
        chatId,
        lastMessageId,
        null,
        messageText
      );
    } else {
      const sentMessage = await this.bot.telegram.sendMessage(
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
        await this.bot.telegram.sendMessage(
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
        this.bot.telegram.sendMessage(
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
        this.bot.telegram.sendMessage(
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
      const document = await this.googleDrive.copySpreadsheet(
        this.appConfig.templateGoogleSheetId,
        `выгрузка от ${now} транзакции с ${startTransactionDate} по ${endTransactionDate} кошелек - ${walletHash}`,
        this.appConfig.targetGoogleSheetDirectoryId
      );
      const url = `https://docs.google.com/spreadsheets/d/${document.id}/edit`;

      const sheetsApi = this.googleSheets.getSheetConnect();

      const updatingData = csvData.data.slice(1);

      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: document.id,
        range: 'Исходник!A2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: updatingData,
        },
      });

      if (fungiblePositionsCsv.length) {
        await sheetsApi.spreadsheets.values.update({
          spreadsheetId: document.id,
          range: 'Портфель исходник!A2',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: fungiblePositionsCsv,
          },
        });
      }
      await this.createOrUpdateLastMessage(
        lastApiCallMessageId,
        lastText + `\nСоздан новый документ: ${url}\n`,
        chatId
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const summary7days = await this.googleSheets.fillFinanceDataFromSheets(
        document.id,
        walletHash,
        'Анализ 7 дней',
        sheetsApi
      );
      const summary30days = await this.googleSheets.fillFinanceDataFromSheets(
        document.id,
        walletHash,
        'Анализ 30 дней',
        sheetsApi
      );

      await this.googleSheets.updateOrAddWallet(
        this.appConfig.summaryWalletsSheetId,
        walletHash,
        [summary7days, summary30days],
        sheetsApi
      );
      return {
        summarySheetUpdated: true,
      };
    } catch (error) {
      Logger.error(
        `Error fetching transactions for wallet ${walletHash}: ${error}`
      );
      this.bot.telegram.sendMessage(
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
