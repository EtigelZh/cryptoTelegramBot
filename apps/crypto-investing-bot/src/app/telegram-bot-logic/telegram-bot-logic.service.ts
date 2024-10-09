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
import { ErrorHandlingService } from '../error-handling/error-handling-service';
import { GoogleDriveJobApiService } from '../google-api/google-drive-job-api.service';
import { WalletService } from '../wallet/wallet.service';
import { messageTokenPrice } from '../eth-transactions-watcher-logic/domain-logic/get-token-price'
import { SwapTokensArgs } from '../utils/crypto-core/buy-coins';
import { EthRuntimeWatcherService } from '../eth-transactions-watcher-logic/eth-runtime-wather.service';
import { WathcingTransactionsMode } from '../eth-transactions-watcher-logic/domain-logic/models';
import { TokenPriceHistoryService } from '../token-price-history/token-price-history.service';
import { DexOrderService } from '../dex-order/dex-order.service';

const walletHashRegex = /(0x[A-Za-z\d]{30,42}){1,}/gm;
const example =
  '\n\nПример команд:\n`0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`/transactions 0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`\n\n`0x3004892cf2946356e8e4570a94748afdff86681c, 0x4eacda2bb8ae4c46b8384b86c5c136350180f243, 0xaf06c1529a8162dc34c9b03d6bb91e034fa03009`';
const exampleEmulate =
  '\n\nПример команды:\n`/emulate 20509610 0xae80a091efd5f808371c723f8ea82bb6560f9b10`\n\n`/emulate 20509610,20489685 0xae80a091efd5f808371c723f8ea82bb6560f9b10`'

@Injectable()
export class TelegramBotLogicService implements OnModuleInit {
  private userStates = new Map<number, { state: string; idDexOrder: number }>();
  constructor(
    private _appConfig: AppConfig,
    private _processingWalletsJobApiService: ProcessingWalletsJobApiService,
    private _googleSheetsJobApiService: GoogleSheetsJobApiService,
    private _googleDriveJobApiService: GoogleDriveJobApiService,
    private _zerionApi: ZerionApiService,
    private _telegramJobApiService: TelegramJobApiService,
    @Inject(TELEGRAF)
    public readonly _bot: Telegraf,
    private _walletSearcherService: WalletSearcherService,
    private _telegramReportingService: TelegramReportingService,
    private _walletService: WalletService,
    private _ethRuntimeWatcherService: EthRuntimeWatcherService,
    private _tokenPriceHistoryService: TokenPriceHistoryService,
    private _dexOrderService: DexOrderService
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
    this._bot.command('subscribe', this.handleSubscribeCommand.bind(this));
    this._bot.command('unsubscribe', this.handleUnsubscribeCommand.bind(this));
    this._bot.command(
      'update_old_wallets',
      this.handleUpdateOldWalletsCommand.bind(this)
    );
    this._bot.command('restart', this.handleRestart.bind(this));
    this._bot.command('search_zerion', this.handleZerionSearch.bind(this));
    this._bot.command('search_etherscan', this.handleEtherscanSearch.bind(this));
    this._bot.command('report', this.handleReport.bind(this));
    this._bot.command('cleanup', this.handleCleanup.bind(this));
    this._bot.command('emulate', this.handleEmulateCommand.bind(this));
    this._bot.command('get_price_history', this.handleTokenPriceHistoryCommand.bind(this));
    this._bot.command('get_token_price', this.handleGetTokenPriceCommand.bind(this))
    this._bot.on('message', this.handlePossibleWalletHash.bind(this)); // Listen for any text message
    this._bot.on([message('text')], this.handlePossibleWalletHash.bind(this)); // Listen for any text message
    this._bot.action(/dexOrderManualStop_(\d+)/, (ctx) => this.handleStop(ctx));
    this._bot.action(/dexOrderTargetPriceChangeLess_(\d+)/, (ctx) => this.handleReductionPrice(ctx));
    this._bot.action(/dexOrderTargetPriceChangeMore_(\d+)/, (ctx) => this.handleRaisePrice(ctx));
    this._bot.action(/dexOrderChangePrice_(\d+)/, (ctx) => this.handleChangePriceButton(ctx));
    this._bot.action(/dexOrderChangePercent_(\d+)/, (ctx) => this.handleChangePercentButton(ctx));
    // this._bot.action(/dexOrderManualStop_(\d+)/, (ctx) => this.handleStop(ctx));
  }

  private async handleCleanup(ctx: Context<MountMap['text']>) {
    if (!this.isAdminUser(ctx.from?.id)) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Работа бота доступна только для избранных.'
      );
      return;
    }
    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      'Очищаем данные...'
    );
    await this._googleDriveJobApiService.cleanup();

  }
  private async handleEmulateCommand(ctx: Context<MountMap['text'] & MountMap['message']>): Promise<void>{
    const emulationMessageContext = {}
    emulationMessageContext[ctx.chat.id] = ctx.message.message_id
    const partsMessage = ctx.message.text.split(' ');
    const partsBlocks = partsMessage[1];
    const partHash = partsMessage[2];
    if (!partsBlocks) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Не указан ни один блок кошелька. ${exampleEmulate}`
      );
      return;
    }
    if (!partHash) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Не указан ни один hash кошелька. ${exampleEmulate}`
      );
      return;
    }
    const matchedHash = partHash.match(walletHashRegex);
    if (!matchedHash?.length) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Не указан ни один hash кошелька. ${exampleEmulate}`
      );
      return;
    }
    const blockNumbers = partsBlocks.split(',')
    const walletHashes = []
    walletHashes.push(partHash)
    for (const block of blockNumbers) {
      await this._ethRuntimeWatcherService.handleBlock(Number(block), walletHashes, WathcingTransactionsMode.EMULATION, emulationMessageContext);
    }
  }

  private async handleSubscribeCommand(ctx: Context<MountMap['text'] & MountMap['message']>): Promise<void> {
    console.log(`ctx.message.text: ${ctx.message.text}`);
    const matchedHash = ctx.message.text.match(walletHashRegex);
    if (!matchedHash?.length) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Не указан ни один hash кошелька. ${example}`
      );
      return;
    }
    const walletHash = matchedHash[0];
    const wallet = await this._walletService.getWallet(walletHash);
    if (!wallet) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Кошелек ${walletHash} не найден.`
      );
      return;
    }
    wallet.isWatching = true;
    wallet.walletSubscriptionMessages = wallet.walletSubscriptionMessages || {};
    wallet.walletSubscriptionMessages[ctx.chat.id] = ctx.message.message_id.toString();
    await this._walletService.saveWallet(wallet);
    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      `Вы подписаны на обновления кошелька ${walletHash}.`
    );
  }

  private async handleUnsubscribeCommand(ctx: Context<MountMap['text'] & MountMap['message']>): Promise<void> {
    const matchedHash = ctx.message.text.match(walletHashRegex);
    if (!matchedHash?.length) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Не указан ни один hash кошелька. ${example}`
      );
      return;
    }
    const walletHash = matchedHash[0];
    const wallet = await this._walletService.getWallet(walletHash);
    if (!wallet) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Кошелек ${walletHash} не найден.`
      );
      return;
    }
    wallet.isWatching = false;
    delete wallet.walletSubscriptionMessages[ctx.chat.id];
    await this._walletService.saveWallet(wallet);
    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      `Вы отписаны от обновлений кошелька ${walletHash}.`
    );
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

  private async handleZerionSearch( ctx: Context<MountMap['text']>) {
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
      'Поиск кошельков через zerion запущен'
    );
    await this._walletSearcherService.getNewZerionWallets();
  }

  private async handleEtherscanSearch( ctx: Context<MountMap['text']>) {
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
      'Поиск кошельков через etherscan запущен'
    );
    await this._walletSearcherService.getNewEtherscanWallets();
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

    await this._processWallets(oldWallets, ctx, 'updating', false);
  }

  private async handlePossibleWalletHash(
    ctx: Context<MountMap['text']>
  ): Promise<unknown> {
    if (this._isBotMessage(ctx)) {
      return;
    }
    const userId = ctx.from?.id;
    const messageText = ctx.message.text;

    // Проверяем, ожидает ли пользователь ввода новой цены
    const userState = this.userStates.get(userId);
    if (userState && userState.state === 'awaiting_new_price') {
      const newPriceText = messageText.trim().replace(',', '.');
      const newPrice = parseFloat(newPriceText);
      if (isNaN(newPrice) || newPrice <= 0) {
        await ctx.reply('Пожалуйста, введите корректное число для цены.');
        return;
      }

      const idDexOrder = userState.idDexOrder; // Получаем idDexOrder

      // Обновляем цену в базе данных
      try {
        await this._dexOrderService.dexOrderChangePrice(idDexOrder, newPrice);
        await ctx.reply(`Цена для ордера ${idDexOrder} обновлена на ${newPrice}.`);
      } catch (error) {
        await ctx.reply('Произошла ошибка при обновлении цены.');
        console.error(error);
      }

      // Удаляем состояние пользователя
      this.userStates.delete(userId);
      return;
    }

    if (userState && userState.state === 'awaiting_new_percent') {
      const newPercentText = messageText.trim().replace(',', '.');
      const newPercent = parseFloat(newPercentText);
      if (isNaN(newPercent) || newPercent <= 0) {
        await ctx.reply('Пожалуйста, введите корректное число для процента');
        return;
      }

      const idDexOrder = userState.idDexOrder; // Получаем idDexOrder

      // Обновляем цену в базе данных
      try {
        await this._dexOrderService.dexOrderChangePrice(idDexOrder, newPercent);
        await ctx.reply(`Процент для ордера ${idDexOrder} обновлена на ${newPercent}.`);
      } catch (error) {
        await ctx.reply('Произошла ошибка при обновлении процента');
        console.error(error);
      }

      // Удаляем состояние пользователя
      this.userStates.delete(userId);
      return;
    }
    
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

  private async handleStop(ctx): Promise<void>{
    this._dexOrderService.dexOrderStop(ctx.match[1])
    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      `Лимитная заявка остановлена`
    );
    return;
  }

  private async handleReductionPrice(ctx): Promise<void>{
    await this._dexOrderService.dexOrderReductionPrice(ctx.match[1])
    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      `Цена уменьшена`
    );
    return;
  }

  private async handleRaisePrice(ctx): Promise<void>{
    await this._dexOrderService.dexOrderRaisePrice(ctx.match[1])
    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      `Цена увеличена`
    );
    return;
  }

  private async handleTokenPriceHistoryCommand(ctx: Context<MountMap['text'] & MountMap['message']>): Promise<void> {
    if (!this.isAdminUser(ctx.from?.id)) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Работа бота доступна только для избранных.'
      );
      return;
    }
    const messageText = ctx.message.text.split(' ')
    const tokenHash = messageText[1]
    if (!tokenHash) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Не указан ни один hash токена. ${example}`
      );
      return;
    }
    try {
      const history = await this._tokenPriceHistoryService.getLast15TokenPrices(tokenHash);
      if (history.length === 0) {
        await this._telegramJobApiService.sendMessage(
          ctx.from.id,
          `Токена с таким адресом не найдено`
        );
        return;
      }
      const response = await this._tokenPriceHistoryService.messageTokenPriceHistory(history)
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        response
      );
    } catch (error) {
      ctx.reply('Произошла ошибка при получении данных.');
      console.error(error);
    }
  }

  private async handleGetTokenPriceCommand(ctx: Context<MountMap['text'] & MountMap['message']>): Promise<void> {
    if (!this.isAdminUser(ctx.from?.id)) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Работа бота доступна только для избранных.'
      );
      return;
    }
    const messageText = ctx.message.text.split(' ');
    if (!messageText[1]) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Не указан ни один адрес токена ${example}`
      );
      return;
    }
    const tokenHash = messageText[1];
    const inputParams: SwapTokensArgs = {
      chainId: this._appConfig.countChainId,
      walletAddress: this._appConfig.metamaskWalletAddress,
      tokenInAddress: this._appConfig.etherTokenAddress,
      tokenOutAddress: tokenHash,
      amountInStr: '1',
      alchemyApiToken: this._appConfig.alchemyApiKey,
      privateKey: this._appConfig.metamaskPrivateKey
    };
    
    try {
      const result = await messageTokenPrice(inputParams);
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        result
      );
      return;
    } catch (error) {
      await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        'Ошибка при получении цены токена'
      );
      return;
    }
  }

  private async handleChangePriceButton(ctx): Promise<void> {
    const userId = ctx.from?.id;
    if (!this.isAdminUser(userId)) {
      await this._telegramJobApiService.sendMessage(
        userId,
        'Работа бота доступна только для избранных.',
      );
      return;
    }

    // Устанавливаем состояние пользователя на 'awaiting_new_price'
    const idDexOrder = ctx.match[1]; // Извлекаем idDexOrder
    this.userStates.set(userId, { state: 'awaiting_new_price', idDexOrder });
    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      'Пожалуйста, введите новую цену:'
    );
  }

  private async handleChangePercentButton(ctx): Promise<void> {
    const userId = ctx.from?.id;
    if (!this.isAdminUser(userId)) {
      await this._telegramJobApiService.sendMessage(
        userId,
        'Работа бота доступна только для избранных.',
      );
      return;
    }

    // Устанавливаем состояние пользователя на 'awaiting_new_price'
    const idDexOrder = ctx.match[1]; // Извлекаем idDexOrder
    this.userStates.set(userId, { state: 'awaiting_new_percent', idDexOrder });
    await this._telegramJobApiService.sendMessage(
      ctx.from.id,
      'Пожалуйста, введите новый процент:'
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
    const calculateScore = ctx.message.text.includes('calculate_score');
    const matchedHash = ctx.message.text.match(walletHashRegex);
    if (!matchedHash?.length) {
      return await this._telegramJobApiService.sendMessage(
        ctx.from.id,
        `Не указан ни один hash кошелька. ${example}`
      );
    }
    await this._processWallets(matchedHash, ctx, 'manual', calculateScore);
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
    apiKeyQueueName: ZerionApiQueueName,
    calculateScore,
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
        calculateScore
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

  private handleBotError(error: Error, ctx): void {
    ErrorHandlingService.handleError({ error, message: `Telegraf bot error Context: ${ctx}` });
  }

  private _isBotMessage(ctx: Context<MountMap['text']>): boolean {
    return ctx.message.from.is_bot;
  }

  private isAdminUser(userId: string | number): boolean {
    return this._appConfig.adminChatIds.includes(String(userId));
  }
}