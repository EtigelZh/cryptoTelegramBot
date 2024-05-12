import { Injectable } from '@nestjs/common';
import { FetchTransactionsJob, zerionApiFetchTransactionsQueueName } from './zerion-api-fetch-transactions.consumer';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class ZerionClientJobApiService {
  constructor(@InjectQueue(zerionApiFetchTransactionsQueueName) private _zerionApiFetchTransactionsQueue: Queue) {
  }

  async getTransactions(jobParams: FetchTransactionsJob) {
    const getTransactionsJob = await this._zerionApiFetchTransactionsQueue.add('getTransactions', jobParams);
    return await getTransactionsJob.finished();
  }

  async getFungiblePositionsCsv(jobParams: FetchTransactionsJob) {
    const job = await this._zerionApiFetchTransactionsQueue.add('getFungiblePositionsCsv', jobParams);
    return await job.finished();
  }
}
