import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ProcessingWalletsConsumer, walletQueueName } from './processing-wallets.consumer';
import { ProcessingWalletsJobApiService } from './processing-wallets-job-api.service';
import { ZerionApiModule } from '../zerion-api/zerion-api.module';
import { GoogleDriveModule } from '../google-api/google-drive.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { WalletModule } from '../wallet/wallet.module';
import { AppConfig, AppConfigModule } from '../app.config';
import { TelegrafModule } from '../telegraf/telegraf.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LongTermProcessingWalletTaskEntity } from './long-term-processing-wallet-task.entity';
import { LongTermProcessingWalletsService } from './long-term-processing-wallets.service';
import { TransactionModule } from '../transaction/transaction.module';
import { EtherscanApiModule } from '../etherscan-api/etherscan-api.module';

@Module({
  imports: [
    AppConfigModule,
    ZerionApiModule,
    GoogleDriveModule,
    AnalyticsModule,
    WalletModule,
    TelegrafModule,
    TransactionModule,
    EtherscanApiModule,
    TypeOrmModule.forFeature([LongTermProcessingWalletTaskEntity]),
    BullModule.registerQueue({
      name: walletQueueName,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: AppConfig.failedJobStorageConfig,
      }
    }),
  ],
  controllers: [],
  providers: [
    LongTermProcessingWalletsService,
    ProcessingWalletsConsumer,
    ProcessingWalletsJobApiService,
  ],
  exports: [
    ProcessingWalletsJobApiService,
  ],
})
export class ProcessingWalletsModule {}
