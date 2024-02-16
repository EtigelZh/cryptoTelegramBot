import { Module } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { GS_CREDENTIALS } from './credentials.consts';
import { GoogleConnectorModule } from './google-connector/google-connector.module';

@Module({
  imports: [
    GoogleConnectorModule.register(GS_CREDENTIALS)
  ],
  providers: [GoogleSheetsService],
  exports: [GoogleSheetsService, GoogleConnectorModule],
})
export class GoogleSheetsModule {}
