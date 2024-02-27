import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import { AppConfig } from '../app.config';
import { message } from 'telegraf/filters';
import { MountMap } from 'telegraf/typings/telegram-types';
import { WithSentryPerformance } from '../utils/sentry-performance';
import { TELEGRAF } from './telegraf.token';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';


const walletHashRegex = /(0x[A-Za-z\d]{30,42}){1,}/gm;
const example =
  '\n\nПример команд:\n`0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`/transactions 0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`0x3004892cf2946356e8e4570a94748afdff86681c, 0x4eacda2bb8ae4c46b8384b86c5c136350180f243, 0xaf06c1529a8162dc34c9b03d6bb91e034fa03009`';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  

  constructor(
    private readonly appConfig: AppConfig,
    @Inject(TELEGRAF)
    private readonly bot: Telegraf,
    @InjectQueue('processingWallet') private processingWalletQueue: Queue
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
    if (!matchedHash?.length) {
      return ctx.reply(`Не указан ни один hash кошелька. ${example}`);
    }
    const jobResults = [];
    for (const walletHash of matchedHash) {
      const index = matchedHash.indexOf(walletHash);
      let suffix = '';
      if (matchedHash.length > 1) {
        suffix = `(${index + 1} из ${matchedHash.length})`;
      }
      // Таймаут что бы не получать 429 ошибку от API телеграмма
      await new Promise((resolve) => setTimeout(resolve, 500));
      let parentMessageId = null;
      try {
        const message = await ctx.reply(`Кошелек ${walletHash} добавлен в очередь ${suffix}`);
        parentMessageId = message.message_id;
      } catch (e) {
        Logger.log(`Error sending message: ${e}`);
      }
      
      const job = await this.processingWalletQueue.add('process', {
        walletHash, chatId: ctx.chat.id, suffix, parentMessageId
      }, { removeOnComplete: true });
      jobResults.push(job.finished());
    }
    const summarySheetUpdatedResults = await Promise.allSettled(jobResults);
    const summarySheetUpdated = summarySheetUpdatedResults.some(res => res.status === 'fulfilled' && res.value?.summarySheetUpdated === true);
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
}
