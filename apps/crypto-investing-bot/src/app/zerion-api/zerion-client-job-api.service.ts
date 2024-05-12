import { Injectable, Logger } from '@nestjs/common';
import { FetchTransactionsJob, zerionApiFetchTransactionsQueueName } from './zerion-api-fetch-transactions.consumer';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { AnalyticsService, Metric } from '../analytics/analytics.service';
import { captureException } from '@sentry/node';

@Injectable()
export class ZerionClientJobApiService {
  constructor(
    @InjectQueue(zerionApiFetchTransactionsQueueName) private _zerionApiFetchTransactionsQueue: Queue,
    private _analyticsService: AnalyticsService
    ) {}

  async getTransactions(jobParams: FetchTransactionsJob) {
    const getTransactionsJob = await this._zerionApiFetchTransactionsQueue.add('getTransactions', jobParams);
    return await getTransactionsJob.finished().finally(() => this._analyticsService.incrementMetric(Metric.zerionRequests).catch(error => {
      Logger.error(`Error incrementing metric: ${error.message}`);
      captureException(error);
    }));
  }

  async getFungiblePositionsCsv(jobParams: FetchTransactionsJob) {
    const job = await this._zerionApiFetchTransactionsQueue.add('getFungiblePositionsCsv', jobParams);
    return await job.finished().finally(() => this._analyticsService.incrementMetric(Metric.zerionRequests).catch(error => {
      Logger.error(`Error incrementing metric: ${error.message}`);
      captureException(error);
    }));
  }
}
