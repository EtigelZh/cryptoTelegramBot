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

@Module({})
export class TelegrafModule {
  static register() {
    return {
      imports: [
        AppConfigModule,
        ZerionApiModule,
        GoogleDriveModule,
        BullModule.registerQueue({
          name: 'processingWallet',
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
              .catch((e) => Logger.error(`Bot launch error: ${inspect(e)}`));
            await bot.telegram.getMe();
            return bot;
          },
        },
        ProcessingWalletsConsumer,
        TelegramBotService,
      ],
      exports: [TelegramBotService],
      module: TelegrafModule,
    };
  }
}
