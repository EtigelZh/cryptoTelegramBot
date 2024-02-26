import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import { AppConfig } from '../app.config';
import { RequestErrorData, ZerionApiService } from '../zerion-api/zerion-api.service';
import { AxiosError } from 'axios';
import { inspect } from 'util';
import { message } from 'telegraf/filters';
import { MountMap } from 'telegraf/typings/telegram-types';
import { GoogleDriveService } from '../google-sheet/google-drive.service';
import { GoogleSheetsService } from '../google-sheet/google-sheets/google-sheets.service';
import { WithSentryPerformance } from '../utils/sentry-performance';
import { TELEGRAF } from './telegraf.token';


const walletHashRegex = /(0x[A-Za-z\d]{30,42}){1,}/gm;
const example =
  '\n\nПример команд:\n`0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`/transactions 0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`0x3004892cf2946356e8e4570a94748afdff86681c, 0x4eacda2bb8ae4c46b8384b86c5c136350180f243, 0xaf06c1529a8162dc34c9b03d6bb91e034fa03009`';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  

  constructor(
    private readonly appConfig: AppConfig,
    private readonly zerionService: ZerionApiService,
    private readonly googleDrive: GoogleDriveService,
    @Inject(TELEGRAF)
    private readonly bot: Telegraf,
    private readonly googleSheets: GoogleSheetsService
  ) {
    
  }

  onModuleInit() {
    this.initializeBotCommands();
    this.bot.catch(this.handleBotError);
  }

  getMe() {
    return this.bot.telegram.getMe();
  }

  private initializeBotCommands(): void {
    this.bot.command('start', this.handleStartCommand.bind(this));
    this.bot.command('transactions', this.handleTransactionsCommand.bind(this));
    this.bot.on([message('text')], this.handlePossibleWalletHash.bind(this)); // Listen for any text message
  }

  private async handlePossibleWalletHash(
    ctx: Context<MountMap['text']>
  ): Promise<unknown> {
    const messageText = ctx.message.text;

    // Check if the message looks like a wallet hash
    if (messageText.startsWith('0x')) {
      // Call your handler for wallet hash here
      return this.handleTransactionsCommand(ctx);
    }
  }

  private async handleStartCommand(ctx): Promise<void> {
    if (!this.isAdminUser(ctx.from?.id)) {
      return ctx.reply('Работа бота доступна только для избранных.');
    }

    ctx.reply(
      `Отправь мне команду /transactions <hash_кошелька>, <hash_кошелька> чтобы я отправил аналитику по транзакциям. ${example}`
    );
  }

  @WithSentryPerformance('Handle transactions command')
  private async handleTransactionsCommand(
    ctx: Context<MountMap['text'] & MountMap['message']>
  ): Promise<unknown> {
    if (!this.isAdminUser(ctx.from?.id)) {
      return ctx.reply('Работа бота доступна только для избранных.');
    }

    const matchedHash = ctx.message.text.match(walletHashRegex);
    console.log('matchedHash', matchedHash, ctx.message.text);
    if (!matchedHash?.length) {
      return ctx.reply(`Не указан ни один hash кошелька. ${example}`);
    }
    let summarySheetUpdated = false;
    for (const walletHash of matchedHash) {
      const index = matchedHash.indexOf(walletHash);
      let suffix = '';
      if (matchedHash.length > 1) {
        suffix = `(${index + 1} из ${matchedHash.length})`;
      }
      ctx.reply(`Скачиваю транзакции для кошелька ${walletHash}. ${suffix}`);
      try {
        let lastApiCallMessageId = null;
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

            if (lastApiCallMessageId) {
              await ctx.telegram.editMessageText(
                ctx.chat.id,
                lastApiCallMessageId,
                null,
                `${prefix}Скачано ${
                  data.length
                } транзакций.\nДата последней скачанной транзакции: ${data[
                  data.length - 1
                ]?.attributes?.mined_at?.substring(
                  0,
                  10
                )}\nЗапросов в минуту: ${minuteRequests}/${maxRequestsPerMinute}. Запросов сегодня: ${dayRequests}/5000\nПопаданий в кеш: ${cacheHitsToday}`
              );
            } else {
              const sentMessage = await ctx.reply(
                `${prefix}Скачано ${
                  data.length
                } транзакций.\nДата последней скачанной транзакции: ${data[
                  data.length - 1
                ]?.attributes?.mined_at?.substring(
                  0,
                  10
                )}\nЗапросов в минуту: ${minuteRequests}/${maxRequestsPerMinute}. Запросов сегодня: ${dayRequests}/5000\nПопаданий в кеш: ${cacheHitsToday}`
              );
              lastApiCallMessageId = sentMessage.message_id;
            }
          },
          1000
        );
        if (transactions.error) {
          await ctx.reply(
            `Ошибка при скачивании транзакций: ${this.formatErrorMessage(
              transactions.error
            )}`
          );
          
          return;
        }
        const csvData = await this.zerionService.getCsvTransactions(
          transactions.data
        );
        if (csvData.errors.length) {
          const errorMessages = csvData.errors
            .map((error) => `Строка ${error.rowIndex}: ${error.message}`)
            .join('\n');
          ctx.reply(
            `Ошибка при трансформации csv транзакций: ${errorMessages}`
          );

          return;
        }
        const startTransactionDate = (transactions.data[transactions.data.length - 1]?.attributes?.mined_at || new Date().toISOString()).substring(0, 10);
        const endTransactionDate = (transactions.data[0]?.attributes?.mined_at || new Date().toISOString()).substring(0, 10);
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
        ctx.reply(`Создан новый документ: ${url}\n`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const summary7days = await this.googleSheets.fillFinanceDataFromSheets(document.id, walletHash, 'Анализ 7 дней', sheetsApi);
        const summary30days = await this.googleSheets.fillFinanceDataFromSheets(document.id, walletHash, 'Анализ 30 дней', sheetsApi);
        
        await this.googleSheets.updateOrAddWallet(this.appConfig.summaryWalletsSheetId, walletHash, [summary7days, summary30days], sheetsApi);
        summarySheetUpdated = true;
        
      } catch (error) {
        Logger.error(
          `Error fetching transactions for wallet ${walletHash}: ${error}`
        );
        ctx.reply(
          `Ошибка при скачивании транзакций: ${this.formatErrorMessage(error)}`
        );
      }
    }
    if (summarySheetUpdated) {
      ctx.reply(`Обновлены данные в общей таблице https://docs.google.com/spreadsheets/d/${this.appConfig.summaryWalletsSheetId}/edit`);
    }
  }

  private handleBotError(err: Error, ctx): void {
    Logger.error(`Telegraf bot error: ${err} Context: ${ctx}`);
    
    // Implement error-specific handling logic if needed
  }

  private isAdminUser(userId: string | number): boolean {
    return this.appConfig.adminChatIds.includes(String(userId));
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
