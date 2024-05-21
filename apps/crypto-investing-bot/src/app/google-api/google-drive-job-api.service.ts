import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { googleDriveQueueName } from './google-drive.consumer';
import { InjectQueue } from '@nestjs/bull';
import { AppConfig } from '../app.config';
import { AnalyticsService, Metric } from '../analytics/analytics.service';
import { ErrorHandlingService } from '../error-handling/error-handling-service';

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
      ErrorHandlingService.handleError({ error, message: `Error incrementing metric` });
    }));
  }

  async cleanup() {
    const job = await this._googleDriveQueue.add('cleanup');
    return job.finished();
  }
}
