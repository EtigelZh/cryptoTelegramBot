import { Module } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service';
import { GS_CREDENTIALS } from './credentials.consts';
import { GoogleSheetsModule } from './google-sheets/google-sheets.module';

@Module({
  imports: [
    GoogleSheetsModule.register(GS_CREDENTIALS),
  ],
  providers: [GoogleDriveService],
  exports: [GoogleDriveService, GoogleSheetsModule],
})
export class GoogleDriveModule {}
