import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ZerionClientJobApiService } from '../zerion-api/zerion-client-job-api.service';
import { FetchTransactionsJob } from '../zerion-api/zerion-api-fetch-transactions.consumer';
import { WalletService } from '../wallet/wallet.service';
import { ProcessingWalletsJobApiService } from '../processing-wallets/processing-wallets-job-api.service';
import { captureException } from '@sentry/node';
import { AppConfig } from '../app.config';
import { EtherscanClientJobApiService } from '../etherscan-api/etherscan-client-job-api.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { ErrorHandlingService } from '../error-handling/error-handling-service';

function getLastBlockKey(walletHash: string): string {
  return `last-search-block:${walletHash}`;
}

@Injectable()
export class WalletSearcherService {
  private _lastBlocksMap: Map<string, number> = new Map<string, number>();
  constructor(
    private _appConfig: AppConfig,
    private _zerionClientJobApiService: ZerionClientJobApiService,
    private _processingWalletsJobApiService: ProcessingWalletsJobApiService,
    private _walletsService: WalletService,
    private _etherscanClientJobApiService: EtherscanClientJobApiService,
    @Inject(CACHE_MANAGER) private _cache: Cache,
  ) {
    this._initLastBlocksMap().catch(error => ErrorHandlingService.handleError({ error, message: `Error initializing last blocks map` }));
  }



  @Cron(AppConfig.zerionSearcherCron)
  async getNewZerionWallets() {
    Logger.log('Searching for new wallets using zerion');
    for (const walletHash of this._appConfig.walletSearcherZerionSourceWallets) {
      await this._getRelatedZerionWallets(walletHash);
    }
  }

  @Cron(AppConfig.etherscanSearcherCron)
  async getNewEtherscanWallets() {
    Logger.log('Searching for new wallets using etherscan');
    for (const walletHash of this._appConfig.walletSearcherSourceEtherscanWallets) {
      await this._getRelatedEtherscanWallets(walletHash);
    }
  }

  private async _getRelatedZerionWallets(walletHash: string) {
    const { data: transactions } = await this._zerionClientJobApiService.getReceiveTransactions({
      walletHash,
      apiKeyQueueName: 'updating',
      take: this._appConfig.walletSearcherZerionBatchSize,
    } as FetchTransactionsJob);
    const hashesSet = new Set<string>();
    transactions.forEach((transaction) => {
      hashesSet.add(transaction.attributes.sent_from);
      hashesSet.add(transaction.attributes.sent_to);
    });
    hashesSet.delete(walletHash);
    await this._createWallets(hashesSet);
  }

  private async _createWallets(hashesSet: Set<string>) {
    const { exists, notExits } = await this._walletsService.createWalletsEntitiesIfNotExists(Array.from(hashesSet));
    Logger.log(`Found ${exists.length} existing wallets and ${notExits.length} new wallets`);
    for (const walletHash of notExits) {
      this._processingWalletsJobApiService.addToLongTermProcessingQueue(walletHash,{
        walletHash,
        chatId: this._appConfig.dailyUpdateReportChatId,
        suffix: '',
        parentMessageId: null,
        silent: true,
        apiKeyQueueName: 'updating',
      }).catch((error) => {
        ErrorHandlingService.handleError({ error, message: `Error processing wallet` });
      });
    }
  }

  private async _getRelatedEtherscanWallets(walletHash: string) {
    // TODO переделать получение last block на получение из базы данных из таблицы wallets
    const startblock = +(await this._cache.get(getLastBlockKey(walletHash)) || 0);
    const transactions = await this._etherscanClientJobApiService.fetchTransactions({
      address: walletHash,
      action: 'txlist',
      offset: this._appConfig.walletSearcherEtherscanBatchSize,
      startblock
    });
    if (transactions.length) {
      await this._cache.set(getLastBlockKey(walletHash), transactions[0].blockNumber, 0);
      this._lastBlocksMap.set(walletHash, +transactions[0].blockNumber);
    }

    const hashesSet = new Set<string>();
    transactions.forEach((transaction) => {
      hashesSet.add(transaction.from);
      hashesSet.add(transaction.to);
    });
    hashesSet.delete(walletHash);

    await this._createWallets(hashesSet);
  }

  private async _initLastBlocksMap() {
    for (const walletHash of this._appConfig.walletSearcherSourceEtherscanWallets) {
      const lastBlock = +(await this._cache.get(getLastBlockKey(walletHash)) || 0);
      this._lastBlocksMap.set(walletHash, lastBlock);
    }
  }
}
