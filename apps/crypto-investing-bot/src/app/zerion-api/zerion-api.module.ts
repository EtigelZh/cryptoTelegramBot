import { Module } from '@nestjs/common';
import { AppConfig, AppConfigModule } from '../app.config';
import { ZerionApiService } from './zerion-api.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RedisStore } from 'cache-manager-redis-store';
import { ZERION_MANUAL_API_KEYS, ZERION_UPDATING_API_KEYS, fillTokenUsage } from './zerion-api-key-day-limiter';
import { TransactionModule } from '../transaction/transaction.module';
import { WalletModule } from '../wallet/wallet.module';
import { BullModule } from '@nestjs/bull';
import {
  ZerionApiFetchTransactionsConsumer,
  zerionApiFetchTransactionsQueueName
} from './zerion-api-fetch-transactions.consumer';
import { ZerionApiManualConsumer, zerionApiManualQueueName } from './zerion-api-manual.consumer';
import { ZerionApiUpdatingConsumer, zerionApiUpdatingQueueName } from './zerion-api-updating.consumer';
import { ZerionClientJobApiService } from './zerion-client-job-api.service';
import { ErrorHandlingModule } from '../error-handling/error-handling-module';

@Module({
  imports: [
    AppConfigModule,
    BullModule.registerQueue({
      name: zerionApiFetchTransactionsQueueName,
      defaultJobOptions: {
        removeOnComplete: true
      }
    }),
    BullModule.registerQueue({
      name: zerionApiManualQueueName,
      limiter: {
        max: 55,
        duration: 60_000
      },
      defaultJobOptions: {
        removeOnComplete: true
      }
    }),
    BullModule.registerQueue({
      name: zerionApiUpdatingQueueName,
      limiter: {
        max: 55,
        duration: 60_000
      },
      defaultJobOptions: {
        removeOnComplete: true
      }
    }),
    WalletModule,
    TransactionModule,
    ErrorHandlingModule,
  ],
  providers: [
    ZerionApiService,
    {
      provide: ZERION_MANUAL_API_KEYS,
      useFactory: (appConfig: AppConfig, cacheManager: { store: RedisStore }) => {
        const redisClient = cacheManager.store.getClient();
        return fillTokenUsage(appConfig.zerionManualApiKeys, redisClient);
      },
      inject: [AppConfig, CACHE_MANAGER]
    },
    {
      provide: ZERION_UPDATING_API_KEYS,
      useFactory: (appConfig: AppConfig, cacheManager: { store: RedisStore }) => {
        const redisClient = cacheManager.store.getClient();
        return fillTokenUsage(appConfig.zerionUpdatingApiKeys, redisClient);
      },
      inject: [AppConfig, CACHE_MANAGER]
    },
    ZerionApiFetchTransactionsConsumer,
    ZerionApiManualConsumer,
    ZerionApiUpdatingConsumer,
    ZerionClientJobApiService,
  ],
  exports: [ZerionApiService, ZerionClientJobApiService]
})
export class ZerionApiModule {
}

