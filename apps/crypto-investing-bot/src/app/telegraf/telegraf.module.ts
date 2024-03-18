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
@Module({})
export class TelegrafModule {
  static register() {
    return {
      imports: [
        AppConfigModule,
        ZerionApiModule,
        GoogleDriveModule,
        BullModule.registerQueue({
          name: walletQueueName,
          defaultJobOptions: {
            removeOnComplete: true,
          },
        }),
        BullModule.registerQueue({
          name: telegramQueueName,
          limiter: {
            max: 20, // Максимальное количество задач, которые могут быть обработаны
            duration: 1000, // Период в миллисекундах (60 секунд)
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
        TelegramBotService,
      ],
      exports: [TelegramBotService],
      module: TelegrafModule,
    };
  }
}
