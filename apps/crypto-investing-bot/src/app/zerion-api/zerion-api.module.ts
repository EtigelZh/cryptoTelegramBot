import { Module } from '@nestjs/common';
import { AppConfig, AppConfigModule } from '../app.config';
import { ZerionApiService } from './zerion-api.service';
import { CacheModule } from '@nestjs/cache-manager';
import type { RedisClientOptions } from 'redis';
import { redisStore } from 'cache-manager-redis-store';

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
  ],
  providers: [ZerionApiService],
  exports: [ZerionApiService],
})
export class ZerionApiModule {}

