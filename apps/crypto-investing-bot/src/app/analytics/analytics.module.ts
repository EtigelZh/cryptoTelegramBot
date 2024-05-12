import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceDataEntity } from './financial-data.entity';
import { AnalyticsService } from './analytics.service';
import { BullModule } from '@nestjs/bull';
import { SaveToDbApiJobService, SaveToDbConsumer, saveToDbQueueName } from './save-to-db.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinanceDataEntity]),
    BullModule.registerQueue({
      name: saveToDbQueueName,
      defaultJobOptions: {
        removeOnComplete: true
      }
    })
  ],
  providers: [AnalyticsService, SaveToDbApiJobService, SaveToDbConsumer],
  exports: [AnalyticsService, SaveToDbApiJobService]
})
export class AnalyticsModule {
}
