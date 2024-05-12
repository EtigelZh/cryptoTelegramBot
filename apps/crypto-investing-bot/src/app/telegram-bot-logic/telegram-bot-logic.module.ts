import { Module } from '@nestjs/common';
import { TelegramBotLogicService } from './telegram-bot-logic.service';
import { TelegrafModule } from '../telegraf/telegraf.module';
import { ProcessingWalletsModule } from '../processing-wallets/processing-wallets.module';
import { AppConfigModule } from '../app.config';
import { ZerionApiModule } from '../zerion-api/zerion-api.module';
import { GoogleDriveModule } from '../google-api/google-drive.module';

@Module({
  imports: [
    AppConfigModule,
    TelegrafModule,
    ZerionApiModule,
    GoogleDriveModule,
    ProcessingWalletsModule,
  ],
  providers: [TelegramBotLogicService],
  exports: [TelegramBotLogicService],
})
export class TelegramBotLogicModule {
}
