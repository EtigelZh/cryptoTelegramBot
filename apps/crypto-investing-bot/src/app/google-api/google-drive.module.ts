import { Module } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service';
import { GS_CREDENTIALS } from './credentials.consts';
import { GoogleSheetsModule } from './google-sheets/google-sheets.module';
import { BullModule } from '@nestjs/bull';
import { GoogleDriveConsumer, googleDriveQueueName } from './google-drive.consumer';
import { GoogleDriveJobApiService } from './google-drive-job-api.service';
import { AppConfigModule } from '../app.config';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    AppConfigModule,
    GoogleSheetsModule.register(GS_CREDENTIALS),
    AnalyticsModule,
    BullModule.registerQueue({
      name: googleDriveQueueName,
      limiter: {
        max: 55,
        duration: 60_000,
      },
      defaultJobOptions: {
        removeOnComplete: true,
      },
    }),
  ],
  providers: [GoogleDriveService, GoogleDriveJobApiService, GoogleDriveConsumer],
  exports: [GoogleDriveService, GoogleDriveJobApiService, GoogleSheetsModule],
})
export class GoogleDriveModule {}
