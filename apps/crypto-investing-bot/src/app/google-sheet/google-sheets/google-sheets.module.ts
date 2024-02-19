import { DynamicModule, Module } from '@nestjs/common';
import GoogleSheetConnectorDto from './dto/google-sheet-connector.dto';
import AsyncGoogleSheetConnectorDto from './dto/async.google-sheet-connector.dto';
import { GoogleSheetsService } from './google-sheets.service';

@Module({})
export class GoogleSheetsModule {
  static register(options: GoogleSheetConnectorDto): DynamicModule {
    return {
      module: GoogleSheetsModule,
      providers: [
        {
          provide: 'GOOGLE_SHEET_CONNECTOR',
          useValue: options,
        },
        GoogleSheetsService,
      ],
      imports: [],
      exports: [GoogleSheetsService],
    };
  }
  static registerAsync(options: AsyncGoogleSheetConnectorDto): DynamicModule {
    return {
      module: GoogleSheetsModule,
      imports: options.imports,
      providers: [
        {
          provide: 'GOOGLE_SHEET_CONNECTOR',
          useFactory: options.useFactory,
          inject: options.inject,
        },
        GoogleSheetsService,
      ],
      exports: [GoogleSheetsService],
    };
  }
}
