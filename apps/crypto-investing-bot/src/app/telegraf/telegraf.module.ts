import { Logger, Module } from '@nestjs/common';
import { AppConfig, AppConfigModule } from '../app.config';
import { Telegraf } from 'telegraf';
import { TELEGRAF } from './telegraf.token';
import { TelegramBotService } from './telegram-bot.service';
import { ZerionApiModule } from '../zerion-api/zerion-api.module';
import { GoogleDriveModule } from '../google-sheet/google-drive.module';
import { inspect } from 'util';
import { ProcessingWalletsConsumer } from './processing-wallets.consumer';
import { BullModule } from '@nestjs/bull';
import { telegramQueueName, walletQueueName } from './queues';
import { TelegramConsumer } from './telegram.consumer';
import { GoogleSheetsConsumer, googleSheetsApiQueueName } from './google-sheets.consumer';
import { GoogleDriveConsumer, googleDriveQueueName } from './google-drive.consumer';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import type { RedisClientOptions } from 'redis';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegramJobApiService } from './telegram-job-api.service';
import { SaveToDbApiJobService, SaveToDbConsumer, saveToDbQueueName } from './save-to-db.consumer';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ZerionApiFetchTransactionsConsumer, zerionApiFetchTransactionsQueueName } from '../zerion-api/zerion-api-fetch-transactions.consumer';
import { ZerionApiManualConsumer, zerionApiManualQueueName } from '../zerion-api/zerion-api-manual.consumer';
import { ZerionApiUpdatingConsumer, zerionApiUpdatingQueueName } from '../zerion-api/zerion-api-updating.consumer';
@Module({})
export class TelegrafModule {
  static register() {
    return {
      imports: [
        AppConfigModule,
        ZerionApiModule,
        GoogleDriveModule,
        AnalyticsModule,
        BullModule.registerQueue({
          name: walletQueueName,
          defaultJobOptions: {
            removeOnComplete: true,
          },
        }),
        BullModule.registerQueue({
          name: telegramQueueName,
          limiter: {
            max: 10, // Максимальное количество задач, которые могут быть обработаны
            duration: 2_000, // Период в миллисекундах (60 секунд)
          },
          defaultJobOptions: {
            removeOnComplete: true,
          },
        }),
        BullModule.registerQueue({
          name: googleDriveQueueName,
          limiter: {
            max: 60,
            duration: 60_000,
          },
          defaultJobOptions: {
            removeOnComplete: true,
          },
        }),
        BullModule.registerQueue({
          name: googleSheetsApiQueueName,
          limiter: {
            max: 300,
            duration: 60_000,
          },
          defaultJobOptions: {
            removeOnComplete: true,
          },
        }),
        BullModule.registerQueue({
          name: saveToDbQueueName,
          defaultJobOptions: {
            removeOnComplete: true,
          }
        }),
        BullModule.registerQueue({
          name: zerionApiFetchTransactionsQueueName,
          defaultJobOptions: {
            removeOnComplete: true,
          },
        }),
        BullModule.registerQueue({
          name: zerionApiManualQueueName,
          limiter: {
            max: 55,
            duration: 60_000,
          },
          defaultJobOptions: {
            removeOnComplete: true,
          },
        }),
        BullModule.registerQueue({
          name: zerionApiUpdatingQueueName,
          limiter: {
            max: 55,
            duration: 60_000,
          },
          defaultJobOptions: {
            removeOnComplete: true,
          },
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
        }),
        ScheduleModule.forRoot(),
      ],
      providers: [
        {
          provide: TELEGRAF,
          inject: [AppConfig],
          useFactory: async (appConfig: AppConfig) => {
            const bot = new Telegraf(appConfig.telegramBotToken);
            bot
              .launch()
              .catch((e) => Logger.error(`Bot launch error: ${inspect(e)}`));
            await bot.telegram.getMe();
            return bot;
          },
        },
        TelegramConsumer,
        ProcessingWalletsConsumer,
        GoogleDriveConsumer,
        GoogleSheetsConsumer,
        SaveToDbConsumer,
        SaveToDbApiJobService,
        TelegramBotService,
        TelegramJobApiService,
        ZerionApiFetchTransactionsConsumer,
        ZerionApiManualConsumer,
        ZerionApiUpdatingConsumer,
      ],
      exports: [TelegramBotService],
      module: TelegrafModule,
    };
  }
}
