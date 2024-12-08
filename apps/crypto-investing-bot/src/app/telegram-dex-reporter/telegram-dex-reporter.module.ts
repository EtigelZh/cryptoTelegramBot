import { Logger, Module } from "@nestjs/common";
import { TelegramDexReporterConsumer } from "./telegram-dex-reporter.consumer";
import { TELEGRAF_DEX_REPORTER, telegrafDexReporterQueueName } from "./telegram-dex-reporter.constants";
import { BullModule } from "@nestjs/bull";
import { AppConfig, AppConfigModule } from "../app.config";
import { TelegramDexReporterJobApiService } from "./telegram-dex-reporter-job-api.service";
import { Telegraf } from "telegraf";
import { ErrorHandlingService } from "../error-handling/error-handling-service";

@Module({
  imports: [
    AppConfigModule,
    BullModule.registerQueue({
      name: telegrafDexReporterQueueName,
      limiter: {
        max: 1,
        duration: 1_200,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: AppConfig.failedJobStorageConfig,
      },
    }),
  ],
  providers: [
    {
        provide: TELEGRAF_DEX_REPORTER,
        inject: [AppConfig],
        useFactory: async (appConfig: AppConfig) => {
          const bot = new Telegraf(appConfig.telegramDexReporterBotToken);
          bot
            .launch()
            .then(() => bot.telegram.getMe())
            .then(() => Logger.log(`TELEGRAF_DEX_REPORTER bot launched`))
            .catch((error) => ErrorHandlingService.handleError({ error, message: `Bot launch error` }));
          return bot;
        },
      },
    TelegramDexReporterConsumer, TelegramDexReporterJobApiService],
  exports: [TelegramDexReporterJobApiService, TELEGRAF_DEX_REPORTER],
})
export class TelegramDexReporterModule {}