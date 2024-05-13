import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { ZerionApiService } from './zerion-api.service';
import { Job, Queue } from 'bull';
import { FungiblePosition, ZerionApiQueueName } from './zerion-api.models';
import { zerionApiManualQueueName } from './zerion-api-manual.consumer';
import { zerionApiUpdatingQueueName } from './zerion-api-updating.consumer';
import { AppConfig } from '../app.config';
import { fungiblePositionsUrlTemplate, receiveTransactionsUrlTemplate } from './zerion-api.url-templates';

export const zerionApiFetchTransactionsQueueName = `zerion-api-fetch-transactions`;

export type FetchTransactionsJob = {
  walletHash: string;
  apiKeyQueueName: ZerionApiQueueName;
  take?: number;
  messagingInfo?: {
    globalPrefix: string;
    lastApiCallMessageId: number;
    chatId: number;
  };
}

@Processor({
  name: zerionApiFetchTransactionsQueueName
})
export class ZerionApiFetchTransactionsConsumer {
  constructor(
    private _zerionApiService: ZerionApiService,
    @InjectQueue(zerionApiManualQueueName) private _zerionApiManualQueue: Queue,
    @InjectQueue(zerionApiUpdatingQueueName) private _zerionApiUpdatingQueue: Queue
  ) {
  }

  @Process({
    name: 'getTransactions',
    concurrency: AppConfig.walletProcessorConcurrency
  })
  async getTransactions(job: Job<FetchTransactionsJob>) {
    const { walletHash: walletId, take = 0, apiKeyQueueName } = job.data;

    const transactions = await this._zerionApiService.getTransactions({
      walletHash: walletId,
      take,
      apiKeyQueueName,
      requestType: 'transactions',
      getNextChunk: this._makeRequest.bind(this),
    });

    return transactions;
  }

  @Process({
    name: 'getFungiblePositionsCsv'
  })
  async getFungiblePositionsCsv(job: Job<FetchTransactionsJob>) {
    const { walletHash, take = 0, apiKeyQueueName } = job.data;

    const fungiblePositions = await this._zerionApiService.getTransactions<FungiblePosition>({
      walletHash,
      take,
      urlTemplate: fungiblePositionsUrlTemplate,
      requestType: 'fungible_positions',
      apiKeyQueueName,
      getNextChunk: this._makeRequest.bind(this),
    });
    return this._zerionApiService.convertFungiblePositionsToCsvEntries(fungiblePositions.data);
  }

  @Process({
    name: 'getReceiveTransactions',
  })
  async getReceiveTransactions(job: Job<FetchTransactionsJob>) {
    const { walletHash: walletId, take = 0, apiKeyQueueName } = job.data;

    const transactions = await this._zerionApiService.getTransactions({
      walletHash: walletId,
      take,
      apiKeyQueueName,
      requestType: 'receive_transactions',
      urlTemplate: receiveTransactionsUrlTemplate,
      getNextChunk: this._makeRequest.bind(this),
    });

    return transactions;
  }

  private async _makeRequest(url: string, apiKeyQueueName: ZerionApiQueueName) {
    switch (apiKeyQueueName) {
      case 'updating': {
        const job = await this._zerionApiUpdatingQueue.add('makeRequest', { url });
        return await job.finished();
      }
      default:
      case 'manual': {
        const job = await this._zerionApiManualQueue.add('makeRequest', { url });
        return await job.finished();
      }
    }
  }
}
