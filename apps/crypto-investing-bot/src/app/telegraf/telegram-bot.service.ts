import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import { AppConfig } from '../app.config';
import { message } from 'telegraf/filters';
import { MountMap } from 'telegraf/typings/telegram-types';
import { WithSentryPerformance } from '../utils/sentry-performance';
import { TELEGRAF } from './telegraf.token';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { walletQueueName } from './queues';
import {
  GetOldWalletsArgs,
  googleSheetsApiQueueName,
} from './google-sheets.consumer';
import { ZerionApiService } from '../zerion-api/zerion-api.service';
import { Cron } from '@nestjs/schedule';
import { TelegramJobApiService } from './telegram-job-api.service';
import { ZerionApiQueueName } from '../zerion-api/zerion-api.models';
import { ProcessingWalletArguments } from './processing-wallets.consumer';

const walletHashRegex = /(0x[A-Za-z\d]{30,42}){1,}/gm;
const example =
  '\n\nПример команд:\n`0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`/transactions 0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`0x3004892cf2946356e8e4570a94748afdff86681c, 0x4eacda2bb8ae4c46b8384b86c5c136350180f243, 0xaf06c1529a8162dc34c9b03d6bb91e034fa03009`';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  constructor(
    private readonly appConfig: AppConfig,
    @Inject(TELEGRAF)
    private readonly bot: Telegraf,
    @InjectQueue(walletQueueName) private _processingWalletQueue: Queue,
    @InjectQueue(googleSheetsApiQueueName) private _googleSheetsQueue: Queue,
    private _zerionApi: ZerionApiService,
    private _telegramJobApiService: TelegramJobApiService
  ) {}

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
    this.bot.command(
      'update_old_wallets',
      this.handleUpdateOldWalletsCommand.bind(this)
    );
    this.bot.command('restart', this.handleRestart.bind(this));
    this.bot.on([message('text')], this.handlePossibleWalletHash.bind(this)); // Listen for any text message
  }

  private async handleRestart(
    ctx: Context<MountMap['text']>
  ) {
    if (!this.isAdminUser(ctx.from?.id)) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Работа бота доступна только для избранных.'
      );
      return;
    }
    await this._telegramJobApiService.sendMessage(
      this.appConfig.dailyUpdateReportChatId,
      'Бот умер, но воскреснет в течении 10 секунд'
    );
    await this.bot.stop();
    setTimeout(() => {
      process.exit(0);
    }, 1_000);
    
  }

  private async handleUpdateOldWalletsCommand(
    ctx: Context<MountMap['text']>
  ): Promise<void> {
    if (!this.isAdminUser(ctx.from?.id)) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Работа бота доступна только для избранных.'
      );
      return;
    }
    const numberOfWalletsToUpdate =
      this._zerionApi.getEstimateAvailableProcessingWallets();
    if (numberOfWalletsToUpdate <= 0) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Дневной лимит запросов исчерпан. Попробуйте завтра.'
      );
      return;
    }
    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      `Получаем кошельки для обработки. Всего можем обновить кошельков сегодня: ${numberOfWalletsToUpdate}`
    );
    const job = await this._googleSheetsQueue.add(
      'getOldWallets',
      <GetOldWalletsArgs>{
        spreadsheetId: this.appConfig.summaryWalletsSheetId,
        numberOfWalletsToUpdate,
      },
      { removeOnComplete: true }
    );
    const oldWallets = await job.finished();

    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      `Добавлены кошельки в очередь на обработку. Всего кошельков: ${oldWallets.length}`
    );

    await this._processWallets(oldWallets, ctx, 'updating');
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
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Работа бота доступна только для избранных.'
      );
      return;
    }

    this._telegramJobApiService.sendMessage(
      ctx.from.id,
      `[${ctx.from?.id}] Отправь мне команду /transactions <hash_кошелька>, <hash_кошелька> чтобы я отправил аналитику по транзакциям. ${example}`
    );
  }

  @WithSentryPerformance('Handle transactions command')
  private async handleTransactionsCommand(
    ctx: Context<MountMap['text'] & MountMap['message']>
  ): Promise<unknown> {
    if (!this.isAdminUser(ctx.from?.id)) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Работа бота доступна только для избранных.'
      );
      return;
    }

    const matchedHash = ctx.message.text.match(walletHashRegex);
    if (!matchedHash?.length) {
      return await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Не указан ни один hash кошелька. ${example}`
      );
    }
    await this._processWallets(matchedHash, ctx, 'manual');
  }

  @Cron(AppConfig.updateOldWalletsCron)
  async updateOldWallets() {
    const numberOfWalletsToUpdate = this._zerionApi.getEstimateAvailableProcessingWallets();
    if (numberOfWalletsToUpdate <= 0) {
      await this._telegramJobApiService.sendMessage(
        this.appConfig.dailyUpdateReportChatId,
        'Дневной лимит запросов исчерпан. Попробуйте завтра.'
      );
      return;
    }
    const job = await this._googleSheetsQueue.add(
      'getOldWallets',
      <GetOldWalletsArgs>{
        spreadsheetId: this.appConfig.summaryWalletsSheetId,
        numberOfWalletsToUpdate,
      },
      { removeOnComplete: true }
    );
    const oldWallets = await job.finished();

    for (const walletHash of oldWallets) {
      const index = oldWallets.indexOf(walletHash);
      let suffix = '';
      if (oldWallets.length > 1) {
        suffix = `(${index + 1} из ${oldWallets.length})`;
      }

      let parentMessageId = null;
      try {
        const message = await this._telegramJobApiService.sendMessage(
          this.appConfig.dailyUpdateReportChatId,
          `Кошелек ${walletHash} добавлен в очередь ${suffix}`
        );
        parentMessageId = message.message_id;
      } catch (e) {
        Logger.log(`Error sending message: ${e}`);
      }

      await this._processingWalletQueue.add(
        'process',
        {
          walletHash,
          chatId: this.appConfig.dailyUpdateReportChatId,
          suffix,
          parentMessageId,
          apiKeyQueueName: 'updating'
        } as ProcessingWalletArguments,
        { removeOnComplete: true }
      );
    }
  }

  private async _processWallets(
    matchedHash: string[],
    ctx: Context<MountMap['text'] & MountMap['message']>,
    apiKeyQueueName: ZerionApiQueueName
  ) {
    const jobResults = [];
    for (const walletHash of matchedHash) {
      const index = matchedHash.indexOf(walletHash);
      let suffix = '';
      if (matchedHash.length > 1) {
        suffix = `(${index + 1} из ${matchedHash.length})`;
      }
      let parentMessageId = null;
      try {
        const message = await this._telegramJobApiService.sendMessage(
          ctx.from.id,
          `Кошелек ${walletHash} добавлен в очередь ${suffix}`
        );
        parentMessageId = message.message_id;
      } catch (e) {
        Logger.log(`Error sending message: ${e}`);
      }

      const job = await this._processingWalletQueue.add(
        'process',
        {
          walletHash,
          chatId: ctx.chat.id,
          suffix,
          parentMessageId,
          apiKeyQueueName,
        } as ProcessingWalletArguments,
        { removeOnComplete: true }
      );
      jobResults.push(job.finished());
    }
    const summarySheetUpdatedResults = await Promise.allSettled(jobResults);
    const summarySheetUpdated = summarySheetUpdatedResults.some(
      (res) =>
        res.status === 'fulfilled' && res.value?.summarySheetUpdated === true
    );
    if (summarySheetUpdated) {
      this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Обновлены данные в общей таблице https://docs.google.com/spreadsheets/d/${this.appConfig.summaryWalletsSheetId}/edit`
      );
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
