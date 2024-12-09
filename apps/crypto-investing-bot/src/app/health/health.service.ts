import { Inject, Injectable } from '@nestjs/common';
import { TelegramBotLogicService } from '../telegram-bot-logic/telegram-bot-logic.service';
import { TELEGRAF_DEX_REPORTER } from '../telegram-dex-reporter/telegram-dex-reporter.constants';
import { Telegraf } from 'telegraf';

@Injectable()
export class HealthService {
  constructor(
    private telegramService: TelegramBotLogicService,
    @Inject(TELEGRAF_DEX_REPORTER) private readonly telegrafDexReporter: Telegraf,
  ) {}


  async checkBotHealth() {
     await Promise.race([
        this.telegramService.getMe(),
        this.telegrafDexReporter.telegram.getMe(),
        new Promise((_, reject) => {
          setTimeout(() => reject('Timeout'), 30000);
        }),
      ]);
  }
}
