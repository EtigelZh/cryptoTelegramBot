import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../telegraf/telegram-bot.service';

@Injectable()
export class HealthService {
  constructor(
    private telegramService: TelegramBotService
  ) {}


  async checkBotHealth() {
     await Promise.race([
        this.telegramService.getMe(),
        new Promise((_, reject) => {
          setTimeout(() => reject('Timeout'), 30000);
        }),
      ]);
  }
}
