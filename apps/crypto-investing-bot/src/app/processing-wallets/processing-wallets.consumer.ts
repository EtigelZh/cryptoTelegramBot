import { Process, Processor } from '@nestjs/bull';
import { ZerionApiService } from '../zerion-api/zerion-api.service';
import { AppConfig } from '../app.config';
import { AxiosError } from 'axios';
import { inspect } from 'util';
import { Job } from 'bull';
import {
  RequestErrorData,
  ZerionApiQueueName, ZerionTransaction
} from '../zerion-api/zerion-api.models';
import { FetchTransactionsJob } from '../zerion-api/zerion-api-fetch-transactions.consumer';
import { WalletService } from '../wallet/wallet.service';
import { GoogleDriveJobApiService } from '../google-api/google-drive-job-api.service';
import { GoogleSheetsJobApiService } from '../google-api/google-sheets/google-sheets-job-api.service';
import { SaveToDbApiJobService } from '../analytics/save-to-db.consumer';
import { ZerionClientJobApiService } from '../zerion-api/zerion-client-job-api.service';
import { TelegramJobApiService } from '../telegraf/telegram-job-api.service';
import { WalletStatus } from '../wallet/wallet.entity';
import { LongTermProcessingWalletsService } from './long-term-processing-wallets.service';
import { ProcessingWalletArguments } from './processing-wallet.models';
import { ErrorHandlingService } from '../error-handling/error-handling-service';
import { Logger } from '@nestjs/common';
import { TransactionService } from '../transaction/transaction.service';
import { Period, WalletFinancialStats } from '../wallet/wallet.models';
import {
  mapCurrencyTradeStatsToCSV,
  mapFinancialDataToCsvHeader,
} from '../utils/csv-humanizers';
import { EtherscanClientJobApiService } from '../etherscan-api/etherscan-client-job-api.service';
import { calcSlippage } from '../utils/slippage';

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
    private _longTermProcessingWalletsService: LongTermProcessingWalletsService,
    private _transactionService: TransactionService,
    private _etherscanClientJobApiService: EtherscanClientJobApiService
  ) {}

  @Process({
    name: 'process',
    concurrency: AppConfig.walletProcessorConcurrency,
  })
  async process(job: Job<ProcessingWalletArguments>) {
    if (job.data.longTermTaskId) {
      try {
        const result = await this.processWallet(
          job.data.walletHash,
          job.data.chatId,
          job.data.suffix,
          job.data.parentMessageId,
          job.data.apiKeyQueueName,
          job.data.silent
        );
        this._longTermProcessingWalletsService
          .setTaskFinished(job.data.longTermTaskId, result)
          .catch((error) => {
            ErrorHandlingService.handleError({
              error,
              message: `Error finishing long term task`,
            });
          });
        return result;
      } catch (error) {
        const errorMessage = this.formatErrorMessage(error);
        await this._longTermProcessingWalletsService.setTaskFinished(
          job.data.longTermTaskId,
          null,
          errorMessage.join('|')
        );
      }
    } else {
      return await this.processWallet(
        job.data.walletHash,
        job.data.chatId,
        job.data.suffix,
        job.data.parentMessageId,
        job.data.apiKeyQueueName,
        job.data.silent
      );
    }
  }

  private async processWallet(
    walletHash: string,
    chatId: number,
    suffix: string,
    parentMessageId: number | null,
    apiKeyQueueName: ZerionApiQueueName,
    silent = false
  ): Promise<{ summarySheetUpdated?: boolean; reason?: string }> {
    let walletAlias = '';

    const walletEntity =
      await this._walletService.createWalletEntityIfNotExists(walletHash);

    walletAlias = walletEntity?.alias || '';

    const globalPrefix = `Скачиваю транзакции для кошелька ${walletHash}(${walletAlias}). ${suffix}`;

    let lastApiCallMessageId = parentMessageId;
    const lastText = globalPrefix;
    try {
      if (!silent) {
        lastApiCallMessageId =
          await this._telegramJobApiService.createOrUpdateLastMessage(
            parentMessageId,
            globalPrefix,
            chatId
          );
      }

      const transactions =
        await this._zerionClientJobApiService.getTransactions({
          walletHash,
          take: 1000,
          apiKeyQueueName,
          reportingFn: 'telegram_full',
          messagingInfo: {
            lastApiCallMessageId,
            chatId,
            globalPrefix,
          },
        } as FetchTransactionsJob);

      if (transactions.error) {
        const [text, status] = this.formatErrorMessage(transactions.error);
        if (!silent) {
          this._telegramJobApiService.createOrUpdateLastMessage(
            lastApiCallMessageId,
            `${lastText}\nОшибка при скачивании транзакций: ${text} ${status}`,
            chatId
          );
        }

        if (status === 'HTTP_400') {
          await this._walletService.setWalletStatus(
            walletHash,
            WalletStatus.NOT_TRACKABLE
          );
        }

        return {
          summarySheetUpdated: false,
          reason: `Error fetching transactions: ${text} ${status}`,
        };
      }
      const walletEntity = await this._walletService.getWallet(walletHash);
      let walletFinancialStats: WalletFinancialStats | null = null;
      // Рассчет финансовых показателей для кошелька
      if (walletEntity) {
        try {
          walletFinancialStats =
            await this._transactionService.getWalletFinancialStatistics(
              walletHash
            );
          await this._walletService.updateWallet(walletHash, {
            walletFinancialStats,
          });
        } catch (error) {
          ErrorHandlingService.handleError({
            error,
            message: `Error calculating wallet stats`,
          });
        }
      }

      if (
        walletEntity &&
        (walletEntity.status === WalletStatus.NOT_TRACKABLE ||
          walletEntity.status === WalletStatus.LOW_TRADES)
      ) {
        // Скипаем анализ и добавление потому что мало trades
        Logger.log(`Skip wallet ${walletEntity.status}`);
        // TODO Добавить удаление из excel
        if (!silent) {
          this._telegramJobApiService.createOrUpdateLastMessage(
            lastApiCallMessageId,
            `${lastText}\nКошелек не будет рассчитан в excel. Кошелек не трейдерский: ${
              walletEntity.status === WalletStatus.NOT_TRACKABLE
                ? 'Не отслеживается в zerion - скорей всего контракт'
                : 'Слишком мало транзакций'
            }`,
            chatId
          );
        }
        return {
          reason: `Wallet status is ${walletEntity.status}`,
          summarySheetUpdated: false,
        };
      }

      console.log('__BEFOREEE_____SLIPPAGE_____')
      // TODO cal slippage
      if (walletFinancialStats) {
        const { source } = walletFinancialStats.periods[Period.ONE_MONTH];
        if (source) {
        console.log('_____SLIPPAGE_____')
        for (const attributes of Object.values(source)) {
          // currency
          for (const transaction of attributes.transactions) {
            const { blockNo, receiveCurrencyAddress, spentCurrencyAddress } = transaction;
            for (const address in [receiveCurrencyAddress, spentCurrencyAddress]) {
              if (address) {
                // TODO add address
                const existTrans: ZerionTransaction | undefined = transactions.data.find(({id}) => id === transaction.id);
                if (existTrans) {
                  const ethTransactions = await this._etherscanClientJobApiService.getDexTransactions(blockNo, address);
                  const slippage = calcSlippage(ethTransactions);
                  if (!existTrans.calculatedAttributes) {
                    existTrans.calculatedAttributes = {
                      slippage: null,
                      trailing: null,
                    }
                  }
                  existTrans.calculatedAttributes.slippage = slippage;}
                }
              }
            }
          }
        }
      }

      const csvData = await this._zerionService.getCsvTransactions(
        transactions.data
      );
      if (csvData.errors.length) {
        const errorMessages = csvData.errors
          .map((error) => `Строка ${error.rowIndex}: ${error.message}`)
          .join('\n');
        if (!silent) {
          this._telegramJobApiService.createOrUpdateLastMessage(
            lastApiCallMessageId,
            `${lastText}\nОшибка при трансформации csv транзакций: ${errorMessages}`,
            chatId
          );
        }

        return {
          summarySheetUpdated: false,
          reason: 'csv error',
        };
      }
      let fungiblePositionsCsv = [];
      try {
        fungiblePositionsCsv =
          await this._zerionClientJobApiService.getFungiblePositionsCsv({
            walletHash,
            apiKeyQueueName,
          } as FetchTransactionsJob);
      } catch (error) {
        ErrorHandlingService.handleError({
          error,
          message: `Error fetching transactions for wallet ${walletHash}`,
        });
        if (!silent) {
          this._telegramJobApiService.createOrUpdateLastMessage(
            lastApiCallMessageId,
            `${lastText}\nОшибка при скачивании текущего потфеля: ${this.formatErrorMessage(
              error
            )}`,
            chatId
          );
        }
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
          values: updatingData,
        }
      );

      // TODO над построением графа вычислений
      const updates = [job.finished()];
      if (walletFinancialStats !== null) {
        const attributesOneMonth =
          walletFinancialStats.periods[Period.ONE_MONTH].attributes;
        const attributesOneWeek =
          walletFinancialStats.periods[Period.ONE_WEEK].attributes;
        updates.push(
          this._googleSheetsJobApiService.updateSheetValues(
            document.id,
            'Анализ 30 дней!E9',
            'USER_ENTERED',
            {
              values: mapFinancialDataToCsvHeader(attributesOneMonth),
            }
          )
        );
        updates.push(
          this._googleSheetsJobApiService.updateSheetValues(
            document.id,
            'Анализ 7 дней!E9',
            'USER_ENTERED',
            {
              values: mapFinancialDataToCsvHeader(attributesOneWeek),
            }
          )
        );
        updates.push(
          this._googleSheetsJobApiService.updateSheetValues(
            document.id,
            'Исходник из базы!A1',
            'USER_ENTERED',
            {
              values: [
                ['АНАЛИЗ 30 ДНЕЙ'],
                ...mapCurrencyTradeStatsToCSV(
                  walletFinancialStats.periods[Period.ONE_MONTH].source
                ),
                ['АНАЛИЗ 7 ДНЕЙ'],
                ...mapCurrencyTradeStatsToCSV(
                  walletFinancialStats.periods[Period.ONE_WEEK].source
                ),
              ],
            }
          )
        );
      }

      if (fungiblePositionsCsv.length) {
        const job = await this._googleSheetsJobApiService.updateSheetValues(
          document.id,
          'Портфель исходник!A2',
          'USER_ENTERED',
          {
            values: fungiblePositionsCsv,
          }
        );
        updates.push(job.finished());
      }

      await Promise.allSettled(updates);

      if (!silent) {
        this._telegramJobApiService.createOrUpdateLastMessage(
          lastApiCallMessageId,
          lastText + `\nСоздан новый документ: ${url}\n`,
          chatId
        );
      }

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
        ),
      ]);

      await Promise.allSettled([
        this._saveToDbApiJobService.saveToDbFinancialData(summary7days),
        this._saveToDbApiJobService.saveToDbFinancialData(summary30days),
      ]);

      await this._googleSheetsJobApiService.updateOrAddWallet(
        walletHash,
        summary7days,
        summary30days
      );
      return {
        summarySheetUpdated: true,
      };
    } catch (error) {
      ErrorHandlingService.handleError({
        error,
        message: `Error fetching transactions for wallet ${walletHash}`,
      });
      if (!silent) {
        this._telegramJobApiService.createOrUpdateLastMessage(
          lastApiCallMessageId,
          `${lastText}\nОшибка при скачивании транзакций: ${this.formatErrorMessage(
            error
          )}`,
          chatId
        );
      }
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

      return [
        `Ошибка API запроса: ${fullError.substring(0, 256)} Стаутс код: ${
          error.response.statusText
        } ${error.response.status} API`,
        error.response.status === 400 ? 'HTTP_400' : 'HTTP',
      ];
    }
    return [error?.toString() || String(error), 'OTHER'];
  }

  private isAxiosError(error: Error): error is AxiosError<RequestErrorData> {
    return Array.isArray(
      (error as AxiosError<RequestErrorData>)?.response?.data?.errors
    );
  }
}
