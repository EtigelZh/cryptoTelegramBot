import { DynamicModule, Module } from '@nestjs/common';
import GoogleSheetConnectorDto from './dto/google-sheet-connector.dto';
import { GoogleSheetsService } from './google-sheets.service';

@Module({})
export class GoogleSheetsModule {
  static register(options: GoogleSheetConnectorDto): DynamicModule {
    return {
      module: GoogleSheetsModule,
      imports: [],
      providers: [
        {
          provide: 'GOOGLE_SHEET_CONNECTOR',
          useValue: options,
        },
        GoogleSheetsService,
      ],
      exports: [GoogleSheetsService],
    };
  }
}
