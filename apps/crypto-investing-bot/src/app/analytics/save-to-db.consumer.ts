import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { FinanceData } from '../google-api/google-sheets/google-sheets.models';
import { TransformMethodArguments } from '../utils/type.helpers';
import { AnalyticsService } from './analytics.service';
import { FinanceDataEntity } from './financial-data.entity';

export const saveToDbQueueName = 'saveToDbQueue';

@Processor(saveToDbQueueName)
export class SaveToDbConsumer {
  constructor(private readonly _analyticsService: AnalyticsService) {}

  @Process({
    name: 'saveToDbFinancialData',
  })
  async saveToDbFinancialData(job: Job<FinanceData>): Promise<FinanceDataEntity> {
    return await this._analyticsService.saveFinancialData(job.data);
  }
}

@Injectable()
export class SaveToDbApiJobService
  implements TransformMethodArguments<SaveToDbConsumer>
{
  constructor(@InjectQueue(saveToDbQueueName) private telegramQueue: Queue) {}

  async saveToDbFinancialData(data: FinanceData) {
    return await this.telegramQueue.add('saveToDbFinancialData', data, {
      removeOnComplete: true,
    });
  }
}
