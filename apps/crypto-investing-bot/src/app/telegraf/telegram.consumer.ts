import { Process, Processor } from '@nestjs/bull';
import { telegramQueueName } from './queues';
import { Inject } from '@nestjs/common';
import { TELEGRAF } from './telegraf.token';
import { Telegraf } from 'telegraf';
import { Job } from 'bull';
import { AppConfig } from '../app.config';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';

@Processor(telegramQueueName)
export class TelegramConsumer {
  constructor(
    @Inject(TELEGRAF)
    private readonly bot: Telegraf
  ) {}

  @Process({
    name: 'sendMessage',
    concurrency: AppConfig.sendTelegramMessageProcessorConcurrency,
  })
  async sendMessage(
    job: Job<{
      chatId: number;
      message: string;
      parentMessageId: number | null;
      extra?: ExtraReplyMessage;
    }>
  ) {
    return await this.bot.telegram.sendMessage(
      job.data.chatId,
      job.data.message,
      job.data.extra
    );
  }

  @Process({
    name: 'editMessageText',
    concurrency: AppConfig.updateTelegramMessageProcessorConcurrency,
  })
  async editMessageText(
    job: Job<{
      chatId: number;
      message: string;
      messageId: number;
      inlineMessageId?: string;
      extra?: unknown;
    }>
  ) {
    return await this.bot.telegram.editMessageText(
      job.data.chatId,
      job.data.messageId,
      job.data.inlineMessageId || null,
      job.data.message,
      job.data.extra
    );
  }

  @Process({
    name: 'pinMessage',
    concurrency: AppConfig.pinTelegramMessageProcessorConcurrency,
  })
  async pingMessage(
    job: Job<{
      chatId: number;
      messageId: number;
    }>
  ) {
    await this.bot.telegram.pinChatMessage(job.data.chatId, job.data.messageId);
  }

  @Process({
    name: 'unpinMessage',
    concurrency: AppConfig.pinTelegramMessageProcessorConcurrency,
  })
  async unpinMessage(
    job: Job<{
      chatId: number;
      messageId?: number;
    }>
  ) {
    await this.bot.telegram.unpinChatMessage(
      job.data.chatId,
      job.data.messageId
    );
  }
}
