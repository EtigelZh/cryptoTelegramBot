import { DynamicModule, Module } from '@nestjs/common';
import GoogleSheetConnectorDto from './dto/google-sheet-connector.dto';
import { GoogleSheetsService } from './google-sheets.service';
import { googleSheetsApiQueueName, GoogleSheetsConsumer } from './google-sheets.consumer';
import { GoogleSheetsJobApiService } from './google-sheets-job-api.service';
import { WalletModule } from '../../wallet/wallet.module';
import { BullModule } from '@nestjs/bull';
import { AppConfig, AppConfigModule } from '../../app.config';
import { AnalyticsModule } from '../../analytics/analytics.module';

@Module({})
export class GoogleSheetsModule {
  static register(options: GoogleSheetConnectorDto): DynamicModule {
    return {
      module: GoogleSheetsModule,
      imports: [
        AppConfigModule,
        WalletModule,
        AnalyticsModule,
        BullModule.registerQueue({
          name: googleSheetsApiQueueName,
          limiter: {
            max: 280,
            duration: 60_000,
          },
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: AppConfig.failedJobStorageConfig,
          }
        }),
      ],
      providers: [
        {
          provide: 'GOOGLE_SHEET_CONNECTOR',
          useValue: options,
        },
        GoogleSheetsService,
        GoogleSheetsConsumer,
        GoogleSheetsJobApiService,
      ],
      exports: [GoogleSheetsService, GoogleSheetsJobApiService],
    };
  }
}
