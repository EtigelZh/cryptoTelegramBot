import { Process, Processor } from '@nestjs/bull';
import { ZerionApiService } from './zerion-api.service';
import { Job } from 'bull';

export const zerionApiUpdatingQueueName = `zerion-api-updating`;

@Processor({
  name: zerionApiUpdatingQueueName,
})
export class ZerionApiUpdatingConsumer {
  constructor(private _zerionApiService: ZerionApiService) {}

  @Process({
    name: 'makeRequest',
    concurrency: 1,
  })
  async makeRequest(job: Job<{ url: string }>) {
    return this._zerionApiService.fetchTransactionsChunk(
      job.data.url,
      'updating'
    );
  }
}
