import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './app.config';
import { ZerionApiService } from './zerion-api.service';
import { XlsxService } from './xlsx.service';
import { TelegramBotService } from './telegram-bot.service';
import { GoogleSheetModule } from 'nest-google-sheet-connector';
import { GS_CREDENTIALS } from './google-sheet/credentials.consts';

@Module({
  imports: [AppConfigModule, GoogleSheetModule.register(GS_CREDENTIALS)],
  controllers: [AppController],
  providers: [AppService, ZerionApiService, XlsxService, TelegramBotService],
})
export class AppModule {}
