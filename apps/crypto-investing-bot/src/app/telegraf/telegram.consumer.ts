import { Process, Processor } from '@nestjs/bull';
import { telegramQueueName } from './queues';
import { Inject } from '@nestjs/common';
import { TELEGRAF } from './telegraf.token';
import { Telegraf } from 'telegraf';
import { Job } from 'bull';

@Processor(telegramQueueName)
export class TelegramConsumer {
  constructor(
    @Inject(TELEGRAF)
    private readonly bot: Telegraf
  ) {}

  @Process({
    name: 'sendMessage',
    concurrency: +(process.env.WALLET_PROCESSOR_CONCURRENCY || 4),
  })
  async sendMessage(
    job: Job<{
      chatId: number;
      message: string;
      parentMessageId: number | null;
    }>
  ) {
    return await this.bot.telegram.sendMessage(job.data.chatId, job.data.message);
  }

    @Process({
        name: 'editMessageText',
        concurrency: +(process.env.WALLET_PROCESSOR_CONCURRENCY || 4),
    })
    async editMessageText(
        job: Job<{
            chatId: number;
            message: string;
            messageId: number;
            inlineMessageId?: string;
        }>
    ) {
        return await this.bot.telegram.editMessageText(job.data.chatId, job.data.messageId, job.data.inlineMessageId || null, job.data.message);
    }
}
