import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ProcessingWalletsConsumer, walletQueueName } from './processing-wallets.consumer';
import { ProcessingWalletsJobApiService } from './processing-wallets-job-api.service';
import { ZerionApiModule } from '../zerion-api/zerion-api.module';
import { GoogleDriveModule } from '../google-api/google-drive.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { WalletModule } from '../wallet/wallet.module';
import { AppConfigModule } from '../app.config';
import { TelegrafModule } from '../telegraf/telegraf.module';

@Module({
  imports: [
    AppConfigModule,
    ZerionApiModule,
    GoogleDriveModule,
    AnalyticsModule,
    WalletModule,
    TelegrafModule,
    BullModule.registerQueue({
      name: walletQueueName,
      defaultJobOptions: {
        removeOnComplete: true,
      },
    }),
  ],
  controllers: [],
  providers: [
    ProcessingWalletsConsumer,
    ProcessingWalletsJobApiService,
  ],
  exports: [
    ProcessingWalletsJobApiService,
  ],
})
export class ProcessingWalletsModule {}
