import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ethers } from 'ethers';
import { AppConfig } from '../app.config';
import { Subscription, Subject } from 'rxjs';
import { WalletService } from '../wallet/wallet.service';
import { WalletEntity } from '../wallet/wallet.entity';
import { TelegramJobApiService } from '../telegraf/telegram-job-api.service';
import { Alchemy, BlockWithTransactions, Network } from 'alchemy-sdk';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EthPriceService } from './eth-price.service';
import { EtherscanClientJobApiService } from '../etherscan-api/etherscan-client-job-api.service';
import { DexTransactionType, handleSwap } from './domain-logic/handle-swap';
import { Fungible, Log, WathcingTransactionsMode } from './domain-logic/models';
import { DexTransactionService } from '../dex-transactions/dex-transactions.service';
import { calculateTradeProfit } from './domain-logic/calculate-profit';
import { formatTradeProfitResult } from './domain-logic/format-trade-profit';
import { humanizeEconomics } from './domain-logic/humanize-economics';
import { DexOrderService } from '../dex-order/dex-order.service';
import { DexTransactionEntity } from '../dex-transactions/dex-transaction.entity';
import { DexOrderEntity } from '../dex-order/dex-order.entity';
import { DexOrderStatus } from '../dex-order/dex-order.models';
import { Markup } from 'telegraf';
import { DexWalletsService } from '../dex-wallets/dex-wallets.service';

@Injectable()
export class EthRuntimeWatcherService implements OnModuleInit, OnModuleDestroy {
  private alchemy: Alchemy;
  private readonly _targetWalletAddresses: WalletEntity[] = [];
  private readonly _watchingWalletsHashesMap = new Map<
    string,
    Subscription[]
  >();
  private readonly _subscriptions: Subscription[] = [];
  private readonly _tokensMap = new Map<string, Fungible>();
  private readonly _poolsCache = new Map<string, [string, string]>();
  private readonly _provider: ethers.providers.AlchemyProvider;
  private reconnectSubject = new Subject<void>();

  private readonly TRANSFER_EVENT_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ];

  private readonly SWAP_EVENT_API = [
    'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
  ];

  constructor(
    private readonly _config: AppConfig,
    private readonly _walletService: WalletService,
    private readonly _telegramJobApiService: TelegramJobApiService,
    private readonly _ethPriceService: EthPriceService,
    private readonly _etherscanApi: EtherscanClientJobApiService,
    private readonly _dexTransactionService: DexTransactionService,
    private readonly _dexOrderService: DexOrderService,
    private readonly _dexWalletsSevice: DexWalletsService
  ) {
    this._provider = new ethers.providers.AlchemyProvider(
      this._config.network,
      this._config.alchemyApiKey
    );
  }

  async onModuleInit() {
    const settings = {
      apiKey: this._config.alchemyApiKey,
      network:
        this._config.network === 'mainnet'
          ? Network.ETH_MAINNET
          : Network.ARB_MAINNET,
    };
    this.alchemy = new Alchemy(settings);
    this._setupWebSocket();
    this.getActualWatchingWalletsAndTokens();
  }

  async onModuleDestroy() {
    this.alchemy.ws.removeAllListeners();
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  addTargetWalletAddress(walletEntity: WalletEntity) {
    if (!this._watchingWalletsHashesMap.has(walletEntity.hash)) {
      this._watchingWalletsHashesMap.set(walletEntity.hash, []);
      this._targetWalletAddresses.push(walletEntity);
    }
  }

  removeTargetWalletAddress(walletEntity: WalletEntity) {
    if (this._watchingWalletsHashesMap.has(walletEntity.hash)) {
      const subscriptions = this._watchingWalletsHashesMap.get(
        walletEntity.hash
      );
      subscriptions.forEach((sub) => sub.unsubscribe());
      this._watchingWalletsHashesMap.delete(walletEntity.hash);
      const index = this._targetWalletAddresses.findIndex(
        (wallet) => wallet.hash === walletEntity.hash
      );
      if (index !== -1) {
        this._targetWalletAddresses.splice(index, 1);
      }
    }
  }
  public async handleBlock(blockNumber: number, walletHashes: string[], mode: WathcingTransactionsMode, emulationMessageContext: WalletEntity["walletSubscriptionMessages"] = {}): Promise<void>{
    Logger.log(`Block ${blockNumber} received`);
    
    // Для дебага, можно убрать или изменить на env
    // blockNumber = 20487523; 
    // blockNumber = 20453822; 
    // blockNumber = 20468735;
    
    try {
      Logger.log(`Fetch logs for block ${blockNumber}`);
      Logger.log(`Wallets to watch: ${walletHashes.join(', ')}`);
      
      const block = await this.alchemy.core.getBlockWithTransactions(blockNumber);
      await this._dexWalletsSevice.saveWalletAddresses(walletHashes)
      // Параллельно обрабатываем каждый тип свапов
      await Promise.all([
        this._etherscanApi
          .getLogsByBlockRangeAndTopics<Log>(
            blockNumber,
            blockNumber,
            ethers.utils.id(
              'Swap(address,uint256,uint256,uint256,uint256,address)'
            ),
            undefined,
            [8_000, 12_000]
          ).catch((error) => {
            Logger.error(error);
            return [];
          }).then(swaps => this._findDexTransactions(block, swaps, walletHashes, mode, emulationMessageContext)),
        
        this._etherscanApi
          .getLogsByBlockRangeAndTopics<Log>(
            blockNumber,
            blockNumber,
            ethers.utils.id(
              'SwapERC20(uint256,address,address,uint256,uint256,address,address,uint256)'
            ),
            undefined,
            [24_000]
          )
          .catch((error) => {
            Logger.error(error);
            return [];
          }).then(swaps => this._findDexTransactions(block, swaps, walletHashes, mode, emulationMessageContext)),
      ]);
    } catch (error) {
      Logger.error(`Error processing block ${blockNumber}: ${error.message}`);
    }
  }


  private _setupWebSocket() {
    this.alchemy.ws.on('block', (blockNumber) => {
      this.handleBlock(blockNumber, this._targetWalletAddresses.map((walletEntity) => walletEntity.hash), WathcingTransactionsMode.PRODUCTION)
    });

    this.alchemy.ws.on('open', () => {
      this.reconnectSubject.next();
      Logger.log('WebSocket connection established');
    });

    this.alchemy.ws.on('error', (error) => {
      Logger.log(`WebSocket Error: ${error.message}`);
    });

    this.alchemy.ws.on('close', (code) => {
      Logger.log(`WebSocket Closed: ${code}`);
      Logger.log('Attempting to reconnect in 3 seconds...');
      setTimeout(() => {
        this._reconnectWebSocket();
      }, 3000);
    });

    Logger.log(
      'WebSocket connection setup complete, listening for ERC-20 transfers and DEX logs involving target wallets...'
    );
  }

  private async _findDexTransactions(
    block: BlockWithTransactions,
    swaps: Log[],
    walletHashes: string[],
    mode: WathcingTransactionsMode,
    emulationMessageContext: WalletEntity["walletSubscriptionMessages"] = {}
  ) {
    const dexTransactions = block.transactions.filter(
      (tx) =>
        walletHashes.includes(tx.from?.toLocaleLowerCase()) ||
        walletHashes.includes(tx.to?.toLocaleLowerCase())
    );
    const results = [];
    const targetWalletAddresses = mode == WathcingTransactionsMode.PRODUCTION ? this._targetWalletAddresses : [{alias: "emulate", hash: walletHashes[0], walletSubscriptionMessages: emulationMessageContext}]
    for (const tx of dexTransactions) {
      const walletEntity = targetWalletAddresses.find(
        (wallet) =>
          wallet.hash?.toLocaleLowerCase() === tx.from?.toLocaleLowerCase() ||
          wallet.hash?.toLocaleLowerCase() === tx.to?.toLocaleLowerCase()
      );
      const relatedSwap = swaps.filter(
        (swap) => swap.transactionHash === tx.hash
      );

      await Promise.allSettled(
        relatedSwap.map(async (swap) => {
          this._handleSwap(walletEntity, swap);
        })
      );

      results.push({ tx, swap: relatedSwap });
    }
    return results;
  }

  private async _handleSwap(walletEntity: Pick<WalletEntity, "alias" | "hash" | "walletSubscriptionMessages">, log: Log) {
    const economics = await handleSwap(
      log,
      this._provider,
      this._poolsCache,
      this._tokensMap,
      this._ethPriceService.price
    );
    const {
      action,
      tokenAddress,
    } = economics;
    const etherscanTxUrl = this._config.getEtherscanTxUrl(log.transactionHash)
    let message = humanizeEconomics(economics, walletEntity, etherscanTxUrl)
    Logger.log(message);

    if (walletEntity && walletEntity.walletSubscriptionMessages) {
      try {
        if (action === 'SELL') {
          const prevDexTransactions =
            await this._dexTransactionService.findPreviousTransactions(
              walletEntity.hash,
              tokenAddress,
              Number(log.blockNumber)
            );

          message += `\n${formatTradeProfitResult(
            calculateTradeProfit(economics, prevDexTransactions)
          )}`;
        }
      } catch (error) {
        Logger.error(`Error sending message: ${error.message}`);
      }

      const entries = Object.entries(walletEntity.walletSubscriptionMessages);
      const [dexTransaction] = await Promise.allSettled([
        this._dexTransactionService.saveDexTransaction(
          log.blockNumber,
          log.transactionHash,
          walletEntity.hash,
          economics,
          message
        ),
        ...entries.map(([chatId, messageId]) =>
          this._telegramJobApiService.sendMessage(+chatId, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }).catch((error) => {
            Logger.log(`Error sending message: ${error.message}`);
          }),
        ),
      ]);
      if (dexTransaction.status === 'fulfilled') {
        Logger.log(`Dex transaction saved: ${log.transactionHash}`);
        const followingDexTransaction: DexTransactionEntity = dexTransaction.value;
        const sellEnabled = await this._dexWalletsSevice.getIsAutoSellEnabled(followingDexTransaction.wallet.hash)
        if (followingDexTransaction.action == DexTransactionType.SELL && sellEnabled) {
          await this._dexOrderService.handleTokenPriceChangeSellEarly(followingDexTransaction)
        }
        const buyEnabled = await this._dexWalletsSevice.getIsAutoBuyEnabled(followingDexTransaction.wallet.hash);
        if (followingDexTransaction.action == DexTransactionType.BUY && buyEnabled) {
          const newDexOrder = new DexOrderEntity();
          newDexOrder.copyTradingWallet = followingDexTransaction.wallet;
          newDexOrder.wallet = {hash: this._config.metamaskWalletAddress};
          newDexOrder.status = DexOrderStatus.BUYING;
          newDexOrder.completedReason = null;
          newDexOrder.tokenAddress = followingDexTransaction.tokenAddress;
          newDexOrder.sourceBuyingTransactionHash = followingDexTransaction.transactionHash;
          newDexOrder.sourceBuyingTransactionBlockNumber = followingDexTransaction.blockNumber;
          newDexOrder.sourceBuyingTransactionDate = followingDexTransaction.createdAt;
          newDexOrder.sourceBuyingTransactionPrice = followingDexTransaction.economics.ethPerToken;
          newDexOrder.sourceBuyingTransactionAmount = followingDexTransaction.economics.amountToken;
          newDexOrder.sourceBuyingTransactions = [];
          newDexOrder.sourceSellingTransactions = [];
          newDexOrder.targetBuyingPrice = this._config.copyTradingTargetBuyingPriceMultiply * newDexOrder.sourceBuyingTransactionPrice;
          newDexOrder.targetBuyingAmountEth = this._config.copyTradingTargetBuyingAmountEth;
          newDexOrder.targetSellingPrice = this._config.copyTradingTargetSellingPriceMultiply * newDexOrder.sourceBuyingTransactionPrice;
          newDexOrder.targetSellingAmountTokenPercent = 1;
          newDexOrder.buyingTransactions = [];
          newDexOrder.sellingTransactions = [];
          
          // TODO create order
          const savedDexOrder = await this._dexOrderService.createOrder(newDexOrder);
          const entries = Object.entries(walletEntity.walletSubscriptionMessages);
          
          const results = await Promise.allSettled(
            entries.map(async ([chatId, messageId]) => {
              newDexOrder.chatDexOrderId = Number(chatId);
              const buttons = [
                { text: 'Stop', callback_data: `dexOrderManualStop_${savedDexOrder.id}` },
                { text: '-1 %', callback_data: `dexOrderTargetPriceChangeLess_${savedDexOrder.id}` },
                { text: '+1 %', callback_data: `dexOrderTargetPriceChangeMore_${savedDexOrder.id}` },
              ];
        
              // Добавляем кнопку в зависимости от статуса ордера
              if (savedDexOrder.status === DexOrderStatus.SELLING) {
                buttons.push({ text: 'change percent', callback_data: `dexOrderChangePercent_${savedDexOrder.id}` });
              } 
              if (savedDexOrder.status === DexOrderStatus.BUYING) {
                buttons.push({ text: 'change price', callback_data: `dexOrderChangePrice_${savedDexOrder.id}` });
              }
              const result = await this._telegramJobApiService.sendMessage(chatId, `Загрузка...`, {
                reply_markup: {
                  inline_keyboard: [buttons],
                },
              });
              await this._telegramJobApiService.pinMessage(chatId, result.message_id);
              newDexOrder.messageDexOrderId = Number(result.message_id);
            })
          );
          await this._dexOrderService.updateOrderMessageChatId(savedDexOrder.id, newDexOrder.messageDexOrderId, newDexOrder.chatDexOrderId)
        }
      }
      
    }
  }

  private _reconnectWebSocket() {
    Logger.log('Attempting to reconnect WebSocket...');
    this.alchemy.ws.removeAllListeners();
    this._setupWebSocket();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async getActualWatchingWalletsAndTokens() {
    const watchingWallets = await this._walletService.getWatchingWallets();
    watchingWallets.forEach(
      (wallet) => (wallet.hash = wallet.hash?.toLowerCase())
    );
    const watchingWalletsSet = new Set(
      watchingWallets.map((wallet) => wallet.hash)
    );
    const walletsForSubscribe = watchingWallets.filter(
      (wallet) => !this._watchingWalletsHashesMap.has(wallet.hash)
    );
    const walletsForUnsubscribe = this._targetWalletAddresses.filter(
      (wallet) => !watchingWalletsSet.has(wallet.hash)
    );

    walletsForSubscribe.forEach((wallet) =>
      this.addTargetWalletAddress(wallet)
    );
    walletsForUnsubscribe.forEach((wallet) =>
      this.removeTargetWalletAddress(wallet)
    );

    // TODO получить список ассетов -> получаем список адресов токенов для отслеживания realtime цены монета/эфир (скорей всего нужно получить список адресов пулов + перерасчитываем цену на токены в каждом пуле)
  }
}