import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './app.config';
import { ZerionApiService } from './zerion-api.service';
import { XlsxService } from './xlsx.service';
import { TelegramBotService } from './telegram-bot.service';
import { GoogleSheetsModule } from './google-sheet/google-sheets.module';

@Module({
  imports: [AppConfigModule, GoogleSheetsModule],
  controllers: [AppController],
  providers: [AppService, ZerionApiService, XlsxService, TelegramBotService],
})
export class AppModule {}
