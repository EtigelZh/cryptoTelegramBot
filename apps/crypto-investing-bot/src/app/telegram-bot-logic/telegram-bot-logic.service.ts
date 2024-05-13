import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import { AppConfig } from '../app.config';
import { message } from 'telegraf/filters';
import { MountMap } from 'telegraf/typings/telegram-types';
import { WithSentryPerformance } from '../utils/sentry-performance';


import { ZerionApiService } from '../zerion-api/zerion-api.service';
import { Cron } from '@nestjs/schedule';
import { ZerionApiQueueName } from '../zerion-api/zerion-api.models';
import { GoogleSheetsJobApiService } from '../google-api/google-sheets/google-sheets-job-api.service';
import { ProcessingWalletsJobApiService } from '../processing-wallets/processing-wallets-job-api.service';
import { TELEGRAF } from '../telegraf/telegraf.token';
import { TelegramJobApiService } from '../telegraf/telegram-job-api.service';
import { ProcessingWalletArguments } from '../processing-wallets/processing-wallet.models';
import { WalletSearcherService } from '../wallets-searcher/wallet-searcher.service';
import { TelegramReportingService } from './telegram-reporting.service';

const walletHashRegex = /(0x[A-Za-z\d]{30,42}){1,}/gm;
const example =
  '\n\nПример команд:\n`0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`/transactions 0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`0x3004892cf2946356e8e4570a94748afdff86681c, 0x4eacda2bb8ae4c46b8384b86c5c136350180f243, 0xaf06c1529a8162dc34c9b03d6bb91e034fa03009`';

@Injectable()
export class TelegramBotLogicService implements OnModuleInit {
  constructor(
    private _appConfig: AppConfig,
    private _processingWalletsJobApiService: ProcessingWalletsJobApiService,
    private _googleSheetsJobApiService: GoogleSheetsJobApiService,
    private _zerionApi: ZerionApiService,
    private _telegramJobApiService: TelegramJobApiService,
    @Inject(TELEGRAF)
    public readonly _bot: Telegraf,
    private _walletSearcherService: WalletSearcherService,
    private _telegramReportingService: TelegramReportingService
  ) {}

  onModuleInit() {
    this.initializeBotCommands();
    this._bot.catch(this.handleBotError);
  }

  getMe() {
    return this._bot.telegram.getMe();
  }

  private initializeBotCommands(): void {
    this._bot.command('start', this.handleStartCommand.bind(this));
    this._bot.command('transactions', this.handleTransactionsCommand.bind(this));
    this._bot.command(
      'update_old_wallets',
      this.handleUpdateOldWalletsCommand.bind(this)
    );
    this._bot.command('restart', this.handleRestart.bind(this));
    this._bot.command('search', this.handleSearch.bind(this));
    this._bot.command('report', this.handleReport.bind(this));
    this._bot.on('message', this.handlePossibleWalletHash.bind(this)); // Listen for any text message
    this._bot.on([message('text')], this.handlePossibleWalletHash.bind(this)); // Listen for any text message
  }

  private async handleReport( ctx: Context<MountMap['text']>) {
    if (this._isBotMessage(ctx)) {
      return;
    }
    // ctx.chat.id <- чат из которого отправили сообщение возможно стоит везде поменять ctx.from?.id на ctx.chat.id
    if (!this.isAdminUser(ctx.from?.id)) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Работа бота доступна только для избранных.'
      );
      return;
    }
    const message = await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      'Генерируем отчет...'
    );
    await this._telegramReportingService.report(ctx.from.id, message.message_id);
  }

  private async handleSearch( ctx: Context<MountMap['text']>) {
    if (this._isBotMessage(ctx)) {
      return;
    }
    // ctx.chat.id <- чат из которого отправили сообщение возможно стоит везде поменять ctx.from?.id на ctx.chat.id
    if (!this.isAdminUser(ctx.from?.id)) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Работа бота доступна только для избранных.'
      );
      return;
    }
    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      'Поиск кошельков запущен'
    );
    await this._walletSearcherService.getNewWallets();
  }

  private async handleRestart(
    ctx: Context<MountMap['text']>
  ) {
    if (this._isBotMessage(ctx)) {
      return;
    }
    if (!this.isAdminUser(ctx.from?.id)) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Работа бота доступна только для избранных.'
      );
      return;
    }
    await this._telegramJobApiService.sendMessage(
      this._appConfig.dailyUpdateReportChatId,
      'Бот умер, но воскреснет в течении 10 секунд'
    );
    await this._bot.stop();
    setTimeout(() => {
      process.exit(0);
    }, 1_000);

  }

  private async handleUpdateOldWalletsCommand(
    ctx: Context<MountMap['text']>
  ): Promise<void> {
    if (this._isBotMessage(ctx)) {
      return;
    }
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
    const oldWallets = await this._googleSheetsJobApiService.getOldWallets(numberOfWalletsToUpdate);

    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      `Добавлены кошельки в очередь на обработку. Всего кошельков: ${oldWallets.length}`
    );

    await this._processWallets(oldWallets, ctx, 'updating');
  }

  private async handlePossibleWalletHash(
    ctx: Context<MountMap['text']>
  ): Promise<unknown> {
    if (this._isBotMessage(ctx)) {
      return;
    }
    const messageText = ctx.message.text;

    // Check if the message looks like a wallet hash
    if (messageText.startsWith('0x')) {
      // Call your handler for wallet hash here
      return this.handleTransactionsCommand(ctx);
    }
  }

  private async handleStartCommand(ctx): Promise<void> {
    if (this._isBotMessage(ctx)) {
      return;
    }
    // ctx.chat.id <- чат из которого отправили сообщение возможно стоит везде поменять ctx.from?.id на ctx.chat.id
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
    if (this._isBotMessage(ctx)) {
      return;
    }
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
        this._appConfig.dailyUpdateReportChatId,
        'Дневной лимит запросов исчерпан. Попробуйте завтра.'
      );
      return;
    }

    const oldWallets = await this._googleSheetsJobApiService.getOldWallets(numberOfWalletsToUpdate);

    let parentMessageId = null;
    for (const walletHash of oldWallets) {
      const index = oldWallets.indexOf(walletHash);
      let suffix = '';
      if (oldWallets.length > 1) {
        suffix = `(${index + 1} из ${oldWallets.length})`;
      }


      try {
        parentMessageId = await this._telegramJobApiService.createOrUpdateLastMessage(
          parentMessageId,
          `Кошелек ${walletHash} добавлен в очередь ${suffix}`,
          this._appConfig.dailyUpdateReportChatId,
        );
      } catch (e) {
        Logger.log(`Error sending message: ${e}`);
      }

      this._processingWalletsJobApiService.processWallet({
        walletHash,
        chatId: this._appConfig.dailyUpdateReportChatId,
        suffix,
        parentMessageId,
        silent: true,
        apiKeyQueueName: 'updating'
      } as ProcessingWalletArguments);
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

      jobResults.push(this._processingWalletsJobApiService.processWallet({
        walletHash,
        chatId: ctx.chat.id,
        suffix,
        parentMessageId,
        apiKeyQueueName,
      } as ProcessingWalletArguments));
    }
    const summarySheetUpdatedResults = await Promise.allSettled(jobResults);
    const summarySheetUpdated = summarySheetUpdatedResults.some(
      (res) =>
        res.status === 'fulfilled' && res.value?.summarySheetUpdated === true
    );
    if (summarySheetUpdated) {
      this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Обновлены данные в общей таблице https://docs.google.com/spreadsheets/d/${this._appConfig.summaryWalletsSheetId}/edit`
      );
    }
  }

  private handleBotError(err: Error, ctx): void {
    Logger.error(`Telegraf bot error: ${err} Context: ${ctx}`);

    // Implement error-specific handling logic if needed
  }

  private _isBotMessage(ctx: Context<MountMap['text']>): boolean {
    return ctx.message.from.is_bot;
  }

  private isAdminUser(userId: string | number): boolean {
    return this._appConfig.adminChatIds.includes(String(userId));
  }
}
