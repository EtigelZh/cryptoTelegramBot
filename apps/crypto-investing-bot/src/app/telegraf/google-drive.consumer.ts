import { Process, Processor } from '@nestjs/bull';
import { GoogleDriveService } from '../google-sheet/google-drive.service';
import { Job } from 'bull';

export const googleDriveQueueName = 'googleDriveQueue';

export type CopySpreadSheetJob = {
    templateGoogleSheetId: string;
    newSheetName: string;
    targetGoogleSheetDirectoryId: string;
  };

@Processor({
    name: googleDriveQueueName,
})
export class GoogleDriveConsumer {
  constructor(private readonly _googleDrive: GoogleDriveService) {}

  @Process({
    name: 'copySpreadSheet',
    concurrency: 1,
  })
  async copySpreadSheet(
    job: Job<CopySpreadSheetJob>
  ) {
    const document = await this._googleDrive.copySpreadsheet(
      job.data.templateGoogleSheetId,
      job.data.newSheetName,
      job.data.targetGoogleSheetDirectoryId
    );

    return document;
  }
}
