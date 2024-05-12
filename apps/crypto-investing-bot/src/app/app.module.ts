import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfig, AppConfigModule } from './app.config';
import { HealthModule } from './health/health.module';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { ScheduleModule } from '@nestjs/schedule';
import type { RedisClientOptions } from 'redis';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (appConfig: AppConfig) => appConfig.getDbConfig(),
      inject: [AppConfig],
    }),
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (appConfig: AppConfig) => appConfig.getBullConfig(),
      inject: [AppConfig],
    }),
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
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
