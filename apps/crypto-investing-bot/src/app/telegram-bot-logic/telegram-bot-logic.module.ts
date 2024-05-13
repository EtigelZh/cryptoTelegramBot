import { Module } from '@nestjs/common';
import { TelegramBotLogicService } from './telegram-bot-logic.service';
import { TelegrafModule } from '../telegraf/telegraf.module';
import { ProcessingWalletsModule } from '../processing-wallets/processing-wallets.module';
import { AppConfigModule } from '../app.config';
import { ZerionApiModule } from '../zerion-api/zerion-api.module';
import { GoogleDriveModule } from '../google-api/google-drive.module';
import { TelegramReportingService } from './telegram-reporting.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ErrorHandlingModule } from '../error-handling/error-handling-module';
import { WalletSearcherModule } from '../wallets-searcher/wallet-searcher.module';

@Module({
  imports: [
    AppConfigModule,
    TelegrafModule,
    ZerionApiModule,
    GoogleDriveModule,
    ProcessingWalletsModule,
    AnalyticsModule,
    ErrorHandlingModule,
    WalletSearcherModule,
  ],
  providers: [TelegramBotLogicService, TelegramReportingService],
  exports: [TelegramBotLogicService],
})
export class TelegramBotLogicModule {
}
