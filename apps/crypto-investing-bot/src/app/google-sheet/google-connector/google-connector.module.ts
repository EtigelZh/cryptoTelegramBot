import { DynamicModule, Module } from '@nestjs/common';
import GoogleSheetConnectorDto from './dto/google-sheet-connector.dto';
import AsyncGoogleSheetConnectorDto from './dto/async.google-sheet-connector.dto';
import { GoogleConnectorService } from './google-connector.service';

@Module({})
export class GoogleConnectorModule {
  static register(options: GoogleSheetConnectorDto): DynamicModule {
    return {
      module: GoogleConnectorModule,
      providers: [
        {
          provide: 'GOOGLE_SHEET_CONNECTOR',
          useValue: options,
        },
        GoogleConnectorService,
      ],
      imports: [],
      exports: [GoogleConnectorService],
    };
  }
  static registerAsync(options: AsyncGoogleSheetConnectorDto): DynamicModule {
    return {
      module: GoogleConnectorModule,
      imports: options.imports,
      providers: [
        {
          provide: 'GOOGLE_SHEET_CONNECTOR',
          useFactory: options.useFactory,
          inject: options.inject,
        },
        GoogleConnectorService,
      ],
      exports: [GoogleConnectorService],
    };
  }
}
