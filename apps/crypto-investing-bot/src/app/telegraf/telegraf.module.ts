import { Logger, Module } from '@nestjs/common';
import { AppConfig, AppConfigModule } from '../app.config';
import { Telegraf } from 'telegraf';
import { TELEGRAF } from './telegraf.token';
import { inspect } from 'util';
import { BullModule } from '@nestjs/bull';
import { telegramQueueName } from './queues';
import { TelegramConsumer } from './telegram.consumer';
import { TelegramJobApiService } from './telegram-job-api.service';
import { ErrorHandlingService } from '../error-handling/error-handling-service';

@Module({
  imports: [
    AppConfigModule,
    BullModule.registerQueue({
      name: telegramQueueName,
      limiter: {
        max: 55, // Максимальное количество задач, которые могут быть обработаны
        duration: 60_000, // Период в миллисекундах (60 секунд)
      },
      defaultJobOptions: {
        removeOnComplete: true,
      },
    }),
  ],
  providers: [
    {
      provide: TELEGRAF,
      inject: [AppConfig],
      useFactory: async (appConfig: AppConfig) => {
        const bot = new Telegraf(appConfig.telegramBotToken);
        bot
          .launch()
          .catch((error) => ErrorHandlingService.handleError({ error, message: `Bot launch error` }));
        await bot.telegram.getMe();
        return bot;
      },
    },
    TelegramConsumer,
    TelegramJobApiService,
  ],
  exports: [TelegramJobApiService, TELEGRAF],
})
export class TelegrafModule {}
