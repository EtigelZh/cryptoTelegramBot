import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceDataEntity } from './financial-data.entity';
import { AnalyticsService } from './analytics.service';
import { BullModule } from '@nestjs/bull';
import { SaveToDbApiJobService, SaveToDbConsumer, saveToDbQueueName } from './save-to-db.consumer';
import { AppConfig } from '../app.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinanceDataEntity]),
    BullModule.registerQueue({
      name: saveToDbQueueName,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: AppConfig.failedJobStorageConfig,
      }
    }),
  ],
  providers: [AnalyticsService, SaveToDbApiJobService, SaveToDbConsumer],
  exports: [AnalyticsService, SaveToDbApiJobService]
})
export class AnalyticsModule {
}
