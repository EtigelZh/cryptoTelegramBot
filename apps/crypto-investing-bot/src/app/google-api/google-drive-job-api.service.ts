import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { googleDriveQueueName } from './google-drive.consumer';
import { InjectQueue } from '@nestjs/bull';
import { AppConfig } from '../app.config';

@Injectable()
export class GoogleDriveJobApiService {
  constructor(
    private readonly appConfig: AppConfig,
    @InjectQueue(googleDriveQueueName) private readonly _googleDriveQueue: Queue
  ) {
  }

  async copySpreadSheet(newSheetName: string) {
    const job = await this._googleDriveQueue.add('copySpreadSheet', {
      templateGoogleSheetId: this.appConfig.templateGoogleSheetId,
      newSheetName,
      targetGoogleSheetDirectoryId: this.appConfig.targetGoogleSheetDirectoryId
    });
    return await job.finished();
  }
}
