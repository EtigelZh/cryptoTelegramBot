import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { etherscanApiQueueName } from './etherscan-api.consumer';
import { Queue } from 'bull';
import { EthTransaction, FetchTransactionsArguments } from './etherscan-api.models';
import { DexTransaction } from '../utils/models';

@Injectable()
export class EtherscanClientJobApiService {

  constructor(@InjectQueue(etherscanApiQueueName) private _etherscanApiQueue: Queue) {
  }

  async fetchTransactions(jobArguments: FetchTransactionsArguments): Promise<EthTransaction[]> {
    const job = await this._etherscanApiQueue.add('fetchTransactions', jobArguments);
    return await job.finished();
  }

  async getDexTransactions(contractAddress: string, blockNo: string): DexTransaction[] {
    // TODO
    return [];
  }

  // 0%, 2.5%, 5%
  //
  //
  /**
   * [0] - Всегда будет покупка нашего чувака, за которым следим
   * endBlockNo - если не задан, то:
   *  - продажи не было
   *  - будет возврашаться 10К транзакций
   *  - если 10К будет отдана последняя транзакция
   */
  async getDexPeriodTransactions(
    contractAddress: string,
    startBlockNo: string,
    endBlockNo?: string
  ): DexTransaction[] {
    // TODO
    return []; // Trale by 0$
  }
}
