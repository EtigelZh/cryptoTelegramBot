import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ZerionClientJobApiService } from '../zerion-api/zerion-client-job-api.service';
import { FetchTransactionsJob } from '../zerion-api/zerion-api-fetch-transactions.consumer';
import { WalletService } from '../wallet/wallet.service';
import { ProcessingWalletsJobApiService } from '../processing-wallets/processing-wallets-job-api.service';
import { captureException } from '@sentry/node';
import { AppConfig } from '../app.config';

@Injectable()
export class WalletSearcherService {
  constructor(
    private _appConfig: AppConfig,
    private _zerionClientJobApiService: ZerionClientJobApiService,
    private _processingWalletsJobApiService: ProcessingWalletsJobApiService,
    private _walletsService: WalletService,
  ) {
  }

  @Cron('*/20 * * * *')
  async getNewWallets() {
    Logger.log('Searching for new wallets');
    for (const walletHash of this._appConfig.walletSearcherSourceWallets) {
      await this._getRelatedWallets(walletHash);
    }
  }

  private async _getRelatedWallets(walletHash: string) {
    const { data: transactions } = await this._zerionClientJobApiService.getReceiveTransactions({
      walletHash,
      apiKeyQueueName: 'updating',
      take: this._appConfig.walletSearcherBatchSize,
    } as FetchTransactionsJob);
    const hashesSet = new Set<string>();
    transactions.forEach((transaction) => {
      hashesSet.add(transaction.attributes.sent_from);
      hashesSet.add(transaction.attributes.sent_to);
    });
    hashesSet.delete(walletHash);
    const { exists, notExits } = await this._walletsService.createWalletsEntitiesIfNotExists(Array.from(hashesSet));
    Logger.log(`Found ${exists.length} existing wallets and ${notExits.length} new wallets`);
    for (const walletHash of notExits) {
      this._processingWalletsJobApiService.processWallet({
        walletHash,
        chatId: this._appConfig.dailyUpdateReportChatId,
        suffix: '',
        parentMessageId: null,
        silent: true,
        apiKeyQueueName: 'updating',
      }).catch((error) => {
        Logger.error(`Error processing wallet: ${error.message}`);
        captureException(error);
      });
    }

  }
}
