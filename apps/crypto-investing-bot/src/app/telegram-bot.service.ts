import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { AppConfig } from './app.config';
import { inspect } from 'util';
import { XlsxService } from './xlsx.service';
import { ZerionApiService } from './zerion-api.service';
import { AxiosError } from 'axios';
@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly bot: Telegraf;
  constructor(
    private readonly appConfig: AppConfig,
    private readonly zerionService: ZerionApiService,
    private readonly xlsxService: XlsxService
  ) {
    this.bot = new Telegraf(this.appConfig.telegramBotToken);
  }

  onModuleInit() {
    console.log('Telegram bot is running');
    this.bot.command('start', async (ctx) => {
      const hasAccess = this.appConfig.adminChatIds.some(
        (id) => id === String(ctx.from?.id)
      );
      if (hasAccess) {
        ctx.reply(
          'Отправь мне команду /transactions <hash_кошелька>, чтобы я отправил аналитику по транзакциям'
        );
      } else {
        console.log(ctx.from?.id);
        ctx.reply('Работа бота доступна только для избранных ' + ctx.from?.id);
      }
    });

    this.bot.command('transactions', async (ctx) => {
      const hasAccess = this.appConfig.adminChatIds.some(
        (id) => id === String(ctx.from?.id)
      );
      if (!hasAccess) {
        return ctx.reply('Работа бота доступна только для избранных ');
      }
      const id = ctx.message.text.split(' ')[1];
      if (!id) {
        return ctx.reply('Не указан hash кошелька пример команды: `/transactions 0xb585cEb627ef3edbF07b77Ba679b1b26181c579E`');
      }
      ctx.reply('Скачиваю транзакции для кошелька ' + id);
      try {
        const data = await this.zerionService.getTransactions(id);
        const csvData = await this.zerionService.getCsvTransactions(data.data);
        const xlsxBuffer = await this.xlsxService.addDataToWalletParser(csvData);
        ctx.sendDocument({ source: xlsxBuffer, filename: `data-${id}.xlsx` });
      } catch (e) {
        console.error(e);
        if (e instanceof AxiosError) {
            return ctx.reply('Ошибка при скачивании транзакций ' + e.response?.data?.message);
        }
        return ctx.reply('Ошибка при скачивании транзакций ' + e?.toString());
      }
      
      
    });

    this.bot.start(async (ctx) => {
      const mention = `@${ctx.botInfo.username} /stats`;
      if (
        ctx.message.text.includes(mention) &&
        this.appConfig.adminChatIds.some((id) => id === String(ctx.from!.id))
      ) {
        ctx.reply(
          'Отправь мне hash кошелька, чтобы я мог отслеживать твои транзакции'
        );
      } else {
        ctx.reply('Работа бота доступна только для избранных');
      }
    });
    this.bot.launch();

    this.bot.catch(async (err: any, ctx) => {
      Logger.error(`Telegraf review bot Error: ${err} ${inspect(ctx)}`);
      // Terminate the process
      const userId = ctx.from!.id || -1;
      if (err?.response && err?.response?.statusCode === 403) {
        // Обрабатываем ошибку, например, удаляем пользователя из списка рассылки
        Logger.warn(`User ${userId} has blocked the bot`);
      } else {
        process.exit(1);
      }
    });
  }
}
