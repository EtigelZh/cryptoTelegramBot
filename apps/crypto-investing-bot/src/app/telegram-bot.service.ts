import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import { AppConfig } from './app.config';
import { XlsxService } from './xlsx.service';
import { RequestErrorData, ZerionApiService } from './zerion-api.service';
import { AxiosError } from 'axios';
import { inspect } from 'util';
import { message } from 'telegraf/filters';
import { MountMap } from 'telegraf/typings/telegram-types';
const walletHashRegex = /(0x[A-Za-z\d]{30,42}){1,}/gm;
const example = '\n\nПример команд:\n`0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`/transactions 0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`0x3004892cf2946356e8e4570a94748afdff86681c, 0x4eacda2bb8ae4c46b8384b86c5c136350180f243, 0xaf06c1529a8162dc34c9b03d6bb91e034fa03009`';
@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly bot: Telegraf;

  constructor(
    private readonly appConfig: AppConfig,
    private readonly zerionService: ZerionApiService,
    private readonly xlsxService: XlsxService
  ) {
    this.bot = new Telegraf(this.appConfig.telegramBotToken);
  }

  onModuleInit() {
    this.initializeBotCommands();
    this.bot.launch().catch((error) => {
      Logger.error(`Failed to launch the bot: ${error}`);
    });
    this.bot.catch(this.handleBotError);
  }

  private initializeBotCommands(): void {
    this.bot.command('start', this.handleStartCommand.bind(this));
    this.bot.command('transactions', this.handleTransactionsCommand.bind(this));
    this.bot.on([message('text')], this.handlePossibleWalletHash.bind(this)); // Listen for any text message
  }

  private async handlePossibleWalletHash(ctx: Context<MountMap['text']>): Promise<unknown> {
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

  private async handleTransactionsCommand(ctx: Context<MountMap['text'] & MountMap['message']>): Promise<unknown> {
    if (!this.isAdminUser(ctx.from?.id)) {
      return ctx.reply('Работа бота доступна только для избранных.');
    }

    const matchedHash = ctx.message.text.match(walletHashRegex);
    console.log('matchedHash', matchedHash, ctx.message.text);
    if (!matchedHash?.length) {
      return ctx.reply(
        `Не указан ни один hash кошелька. ${example}`
      );
    }
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
          async (minuteRequests, dayRequests, maxRequestsPerMinute, data) => {
            if (data.length === 0) {
              return;
            }
            const prefix = minuteRequests >= maxRequestsPerMinute && lastApiCallMessageId ? '⚠️Превышен лимит запросов к API в минуту.\nОжидаем сброса таймера. ' : '';
            
            if (lastApiCallMessageId) {
              await ctx.telegram.editMessageText(ctx.chat.id, lastApiCallMessageId, null, 
                `${prefix}Скачано ${data.length} транзакций.\nДата последней скачанной транзакции: ${data[data.length - 1]?.attributes?.mined_at?.substring(0, 10)}\nЗапросов в минуту: ${minuteRequests}/${maxRequestsPerMinute}. Запросов сегодня: ${dayRequests}/5000`);
            } else {
              const sentMessage = await ctx.reply(
                `${prefix}Скачано ${data.length} транзакций.\nДата последней скачанной транзакции: ${data[data.length - 1]?.attributes?.mined_at?.substring(0, 10)}\nЗапросов в минуту: ${minuteRequests}/${maxRequestsPerMinute}. Запросов сегодня: ${dayRequests}/5000`);
              lastApiCallMessageId = sentMessage.message_id;
            }
          }
        );
        if (transactions.error) {
          await ctx.reply(
            `Ошибка при скачивании транзакций: ${this.formatErrorMessage(
              transactions.error
            )}`
          );
        }
        const csvData = await this.zerionService.getCsvTransactions(
          transactions.data
        );
        if (csvData.errors.length) {
          const errorMessages = csvData.errors
            .map((error) => `Строка ${error.rowIndex}: ${error.message}`)
            .join('\n');
          return ctx.reply(
            `Ошибка при скачивании транзакций: ${errorMessages}`
          );
        }
        const xlsxBuffer = await this.xlsxService.addDataToWalletParser(
          csvData
        );
        ctx.replyWithDocument({
          source: xlsxBuffer,
          filename: `transactions-${walletHash}.xlsx`,
        });
      } catch (error) {
        Logger.error(
          `Error fetching transactions for wallet ${walletHash}: ${error}`
        );
        ctx.reply(
          `Ошибка при скачивании транзакций: ${this.formatErrorMessage(error)}`
        );
      }
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
