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
import { inspect } from 'util';
import { handleSwap } from './domain-logic/handle-swap';
import { Fungible, Log } from './domain-logic/models';

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
    private readonly _etherscanApi: EtherscanClientJobApiService
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

  private _setupWebSocket() {
    this.alchemy.ws.on('block', async (blockNumber) => {
      Logger.log(`Block ${blockNumber} received`);
      // blockNumber = 20370183;      
      // blockNumber = 20369801;      
      try {
        const prevBlock = blockNumber;
        Logger.log(`Fetch logs for block ${prevBlock}`);
        const [block, swaps] = await Promise.all([
          this.alchemy.core.getBlockWithTransactions(blockNumber),
          Promise.race([
            this._etherscanApi.getLogsByBlockRangeAndTopics<Log>(
              prevBlock,
              prevBlock,
              ethers.utils.id(
                'Swap(address,uint256,uint256,uint256,uint256,address)'
              ),
              undefined,
              [12_000, 24_000]
            ).catch((error) => {
              Logger.error(error);
              return [];
            }),
            this._etherscanApi.getLogsByBlockRangeAndTopics<Log>(
              prevBlock,
              prevBlock,
              ethers.utils.id('SwapERC20(uint256,address,address,uint256,uint256,address,address,uint256)'),
              undefined,
              [36_000],
            ).catch((error) => {
              Logger.error(error);
              return [];
            }),
          ]),
        ]);
        const blockTransactions = block.transactions;

        Logger.log(`Block ${blockNumber} - Received ${blockTransactions?.length} transactions ${swaps?.length} swap events`);

        const walletHashes = this._targetWalletAddresses.map(
          (wallet) => wallet.hash?.toLocaleLowerCase()
        );

        const dexTransactions = await this._findDexTransactions(
          block,
          swaps,
          walletHashes,
        );
        Logger.log(
          `Block ${prevBlock} - Found ${dexTransactions.length} DEX transactions`
        );
        Logger.log(
          `Watching wallets: ${this._targetWalletAddresses.length} ${this._targetWalletAddresses.map(({ hash, alias }) => `${hash}(${alias})`).join(', ')}`
        );
        Logger.log(`${inspect(dexTransactions, false, 6)}`);
      } catch (error) {
        Logger.error(`Error processing block ${blockNumber}: ${error.message}`);
      }
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

  private async _findDexTransactions(block: BlockWithTransactions, swaps: Log[], walletHashes: string[]) {
    const dexTransactions = block.transactions.filter((tx) =>
      walletHashes.includes(tx.from?.toLocaleLowerCase()) || walletHashes.includes(tx.to?.toLocaleLowerCase())
    );
    const results = [];
    for (const tx of dexTransactions) {
      const walletEntity = this._targetWalletAddresses.find(
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

  private async _handleSwap(walletEntity: WalletEntity, log: Log) {
    const { action, amountToken, tokenSymbol, amountWETH, amountUSD, tokenPerEth, tokenPerUsd } = await handleSwap(log, this._provider, this._poolsCache, this._tokensMap, this._ethPriceService.price);
    const message = `[${action} ${amountToken} ${tokenSymbol} ${
      action === 'BUY' ? '<=' : '=>'
    } ${amountWETH} WETH (~$${amountUSD}). Price: 1 ETH = ~${tokenPerEth} ${tokenSymbol}, 1$ = ~${tokenPerUsd} ${tokenSymbol}](${this._config.getEtherscanTxUrl(
      log.transactionHash
    )})`;
    Logger.log(message);

    if (walletEntity && walletEntity.walletSubscriptionMessages) {
      const entries = Object.entries(walletEntity.walletSubscriptionMessages);
      Promise.allSettled(
        entries.map(([chatId, messageId]) =>
          this._telegramJobApiService.sendMessage(+chatId, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          })
        )
      );
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
