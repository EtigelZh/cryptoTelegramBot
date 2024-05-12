import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { googleDriveQueueName } from './google-drive.consumer';
import { InjectQueue } from '@nestjs/bull';
import { AppConfig } from '../app.config';
import { AnalyticsService, Metric } from '../analytics/analytics.service';
import { captureException } from '@sentry/node';

@Injectable()
export class GoogleDriveJobApiService {
  constructor(
    private _appConfig: AppConfig,
    @InjectQueue(googleDriveQueueName) private readonly _googleDriveQueue: Queue,
    private _analyticsService: AnalyticsService,
  ) {}

  async copySpreadSheet(newSheetName: string) {
    const job = await this._googleDriveQueue.add('copySpreadSheet', {
      templateGoogleSheetId: this._appConfig.templateGoogleSheetId,
      newSheetName,
      targetGoogleSheetDirectoryId: this._appConfig.targetGoogleSheetDirectoryId
    });
    return await job.finished().finally(() => this._analyticsService.incrementMetric(Metric.googleDriveRequests).catch(error => {
      Logger.error(`Error incrementing metric: ${error.message}`);
      captureException(error);
    }));
  }
}
