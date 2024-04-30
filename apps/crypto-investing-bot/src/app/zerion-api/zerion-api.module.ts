import { Module } from '@nestjs/common';
import { AppConfig, AppConfigModule } from '../app.config';
import { ZerionApiService } from './zerion-api.service';
import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import type { RedisClientOptions } from 'redis';
import { RedisStore, redisStore } from 'cache-manager-redis-store';
import { ZERION_MANUAL_API_KEYS, ZERION_UPDATING_API_KEYS, fillTokenUsage } from './zerion-api-key-day-limiter';
import { TransactionModule } from '../transaction/transaction.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    AppConfigModule,
    CacheModule.registerAsync({
      imports: [AppConfigModule],
      useFactory: async (appConfig: AppConfig) => {
        const store = await redisStore({
            url: appConfig.getRedisUrl(),
            password: appConfig.getRedisConfig().password,
            ttl: 60*60*24,
        });
        return {
            store,
            ttl: appConfig.cacheTTL,
          } as RedisClientOptions
      },
      inject: [AppConfig],
    }),
    WalletModule,
    TransactionModule,
  ],
  providers: [
    ZerionApiService,
    {
      provide: ZERION_MANUAL_API_KEYS,
      useFactory: (appConfig: AppConfig, cacheManager: { store: RedisStore}) => {
        const redisClient = cacheManager.store.getClient();
        return fillTokenUsage(appConfig.zerionManualApiKeys, redisClient);
      },
      inject: [AppConfig, CACHE_MANAGER],
    },
    {
      provide: ZERION_UPDATING_API_KEYS,
      useFactory: (appConfig: AppConfig, cacheManager: { store: RedisStore}) => {
        const redisClient = cacheManager.store.getClient();
        return fillTokenUsage(appConfig.zerionUpdatingApiKeys, redisClient);
      },
      inject: [AppConfig, CACHE_MANAGER],
    }
  ],
  exports: [ZerionApiService],
})
export class ZerionApiModule {}

