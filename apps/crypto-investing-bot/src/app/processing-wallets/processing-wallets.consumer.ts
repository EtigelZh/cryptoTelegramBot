import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import {
  ZerionApiService
} from '../zerion-api/zerion-api.service';
import { AppConfig } from '../app.config';
import { AxiosError } from 'axios';
import { inspect } from 'util';
import { Job } from 'bull';
import { RequestErrorData, ZerionApiQueueName } from '../zerion-api/zerion-api.models';
import {
  FetchTransactionsJob,
} from '../zerion-api/zerion-api-fetch-transactions.consumer';
import { WalletService } from '../wallet/wallet.service';
import { GoogleDriveJobApiService } from '../google-api/google-drive-job-api.service';
import { GoogleSheetsJobApiService } from '../google-api/google-sheets/google-sheets-job-api.service';
import { SaveToDbApiJobService } from '../analytics/save-to-db.consumer';
import { ZerionClientJobApiService } from '../zerion-api/zerion-client-job-api.service';
import { TelegramJobApiService } from '../telegraf/telegram-job-api.service';

export type ProcessingWalletArguments = {
  walletHash: string;
  chatId: number;
  suffix: string;
  parentMessageId: number | null;
  apiKeyQueueName: ZerionApiQueueName;
};

export const walletQueueName = 'processingWallet';

@Processor(walletQueueName)
export class ProcessingWalletsConsumer {
  constructor(
    private _telegramJobApiService: TelegramJobApiService,
    private _saveToDbApiJobService: SaveToDbApiJobService,
    private _zerionService: ZerionApiService,
    private _walletService: WalletService,
    private _googleSheetsJobApiService: GoogleSheetsJobApiService,
    private _googleDriveJobApiService: GoogleDriveJobApiService,
    private _zerionClientJobApiService: ZerionClientJobApiService,
  ) {
  }

  @Process({
    name: 'process',
    concurrency: AppConfig.walletProcessorConcurrency
  })
  async process(
    job: Job<ProcessingWalletArguments>
  ) {
    return await this.processWallet(
      job.data.walletHash,
      job.data.chatId,
      job.data.suffix,
      job.data.parentMessageId,
      job.data.apiKeyQueueName
    );
  }

  private async processWallet(
    walletHash: string,
    chatId: number,
    suffix: string,
    parentMessageId: number | null,
    apiKeyQueueName: ZerionApiQueueName
  ): Promise<{ summarySheetUpdated?: boolean }> {
    let walletAlias = '';

    walletAlias = await this._walletService.generateWalletEntityAndReturnAlias(walletHash);


    const globalPrefix = `Скачиваю транзакции для кошелька ${walletHash}(${walletAlias}). ${suffix}`;

    let lastApiCallMessageId = parentMessageId;
    const lastText = globalPrefix;
    try {
      lastApiCallMessageId = await this._telegramJobApiService.createOrUpdateLastMessage(
        parentMessageId,
        globalPrefix,
        chatId
      );

      const transactions = await this._zerionClientJobApiService.getTransactions({
        walletHash,
        take: 1000,
        apiKeyQueueName,
        reportingFn: 'telegram_full',
        messagingInfo: {
          lastApiCallMessageId,
          chatId,
          globalPrefix
        }
      } as FetchTransactionsJob);
      if (transactions.error) {
        const [text, status] = this.formatErrorMessage(transactions.error);
        this._telegramJobApiService.createOrUpdateLastMessage(
          lastApiCallMessageId,
          `${lastText}\nОшибка при скачивании транзакций: ${text} ${status}`,
          chatId
        );

        if (status === 'HTTP_400') {
          await this._googleSheetsJobApiService.updateOrAddWallet(walletHash, null, null, [text, status]);
          // TODO add not TRACKABLE status to wallet
        }

        return {};
      }
      const csvData = await this._zerionService.getCsvTransactions(
        transactions.data
      );
      if (csvData.errors.length) {
        const errorMessages = csvData.errors
          .map((error) => `Строка ${error.rowIndex}: ${error.message}`)
          .join('\n');
        this._telegramJobApiService.createOrUpdateLastMessage(
          lastApiCallMessageId,
          `${lastText}\nОшибка при трансформации csv транзакций: ${errorMessages}`,
          chatId
        );

        return {};
      }
      let fungiblePositionsCsv = [];
      try {
        fungiblePositionsCsv = await this._zerionClientJobApiService.getFungiblePositionsCsv({
          walletHash,
          apiKeyQueueName
        } as FetchTransactionsJob);
      } catch (error) {
        Logger.error(
          `Error fetching transactions for wallet ${walletHash}: ${error}`
        );
        this._telegramJobApiService.createOrUpdateLastMessage(
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
      const document = await this._googleDriveJobApiService.copySpreadSheet(
        `выгрузка от ${now} транзакции с ${startTransactionDate} по ${endTransactionDate} кошелек - ${walletHash}`
      );

      const url = `https://docs.google.com/spreadsheets/d/${document.id}/edit`;

      const updatingData = csvData.data.slice(1);

      const job = await this._googleSheetsJobApiService.updateSheetValues(
        document.id,
        'Исходник!A2',
        'USER_ENTERED',
        {
          values: updatingData
        }
      );
      // TODO над построением графа вычислений
      const updates = [job.finished()];
      if (fungiblePositionsCsv.length) {
        const job = await this._googleSheetsJobApiService.updateSheetValues(
          document.id,
          'Портфель исходник!A2',
          'USER_ENTERED',
          {
            values: fungiblePositionsCsv
          }
        );
        updates.push(job.finished());
      }
      updates.push(
        this._telegramJobApiService.createOrUpdateLastMessage(
          lastApiCallMessageId,
          lastText + `\nСоздан новый документ: ${url}\n`,
          chatId
        )
      );
      await Promise.allSettled(updates);
      // Gap for google sheets to update (5 seconds) we are have floating bag, when put incorrect data to aggregated google sheets
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      const [summary7days, summary30days] = await Promise.all([
        this._googleSheetsJobApiService.fillFinanceDataFromSheets(
          document.id,
          walletHash,
          'Анализ 7 дней'
        ),
        this._googleSheetsJobApiService.fillFinanceDataFromSheets(
          document.id,
          walletHash,
          'Анализ 30 дней'
        )
      ]);

      await Promise.allSettled([
        this._saveToDbApiJobService.saveToDbFinancialData(summary7days),
        this._saveToDbApiJobService.saveToDbFinancialData(summary30days)
      ]);

      await this._googleSheetsJobApiService.updateOrAddWallet(walletHash, summary7days, summary30days);
      return {
        summarySheetUpdated: true
      };
    } catch (error) {
      Logger.error(
        `Error fetching transactions for wallet ${walletHash}: ${error}`
      );
      this._telegramJobApiService.createOrUpdateLastMessage(
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
