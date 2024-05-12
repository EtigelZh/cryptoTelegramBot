import { Injectable } from '@nestjs/common';
import { TelegramBotLogicService } from '../telegram-bot-logic/telegram-bot-logic.service';

@Injectable()
export class HealthService {
  constructor(
    private telegramService: TelegramBotLogicService
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
