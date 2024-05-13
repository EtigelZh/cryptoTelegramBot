import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { etherscanApiQueueName } from './etherscan-api.consumer';
import { Queue } from 'bull';
import { EthTransaction, FetchTransactionsArguments } from './etherscan-api.models';

@Injectable()
export class EtherscanClientJobApiService {

  constructor(@InjectQueue(etherscanApiQueueName) private _etherscanApiQueue: Queue) {}

  async fetchTransactions(jobArguments: FetchTransactionsArguments): Promise<EthTransaction[]> {
    const job = await this._etherscanApiQueue.add('fetchTransactions', jobArguments);
    return await job.finished();
  }
}
