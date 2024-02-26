import { Logger, Module } from '@nestjs/common';
import { AppConfig, AppConfigModule } from '../app.config';
import { Telegraf } from 'telegraf';
import { TELEGRAF } from './telegraf.token';
import { TelegramBotService } from './telegram-bot.service';
import { ZerionApiModule } from '../zerion-api/zerion-api.module';
import { GoogleDriveModule } from '../google-sheet/google-drive.module';
import { inspect } from 'util';

@Module({})
export class TelegrafModule {
  static forRootAsync() {
    return {
      imports: [AppConfigModule, ZerionApiModule, GoogleDriveModule],
      providers: [
        {
          provide: TELEGRAF,
          inject: [AppConfig],
          useFactory: async (appConfig: AppConfig) => {
            const bot = new Telegraf(appConfig.telegramBotToken);
            bot.launch().catch((e) => Logger.error(`Bot launch error: ${inspect(e)}`));
            const result = await bot.telegram.getMe();
            Logger.log(`Bot started ${inspect(result)}`);
            return bot;
          },
        },
        TelegramBotService,
      ],
      exports: [TelegramBotService],
      module: TelegrafModule,
    };
  }
}
