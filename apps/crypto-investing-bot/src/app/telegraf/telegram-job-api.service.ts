import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { telegramQueueName } from './queues';
import { Queue } from 'bull';
import { ErrorHandlingService } from '../error-handling/error-handling-service';
import { Telegraf } from 'telegraf';
import { TELEGRAF } from './telegraf.token';

@Injectable()
export class TelegramJobApiService {
  constructor(
    @InjectQueue(telegramQueueName) private telegramQueue: Queue,
    @Inject(TELEGRAF) private readonly _bot: Telegraf,
  ) {
    this.telegramQueue.isPaused().then((paused) => {
      if (paused) {
        this.telegramQueue.resume();
      }
    });
  }

  async getWaitingQueueSize() {
    return await this.telegramQueue.getWaitingCount();
  }

  async createOrUpdateLastMessage(
    lastMessageId: number | null,
    messageText: string,
    chatId: number,
    extra?: unknown
  ): Promise<number> {
    if (lastMessageId) {
      await this.editMessageText(
        chatId,
        messageText,
        lastMessageId,
        undefined,
        extra
      );
    } else {
      try {
        const sentMessage = await this.sendMessage(
          chatId,
          messageText,
          extra
        );
        lastMessageId = sentMessage.message_id;
      } catch (error) {
        if (error.response && error.response.statusCode === 429) {
          await this.handleRateLimit(error.response.message);
        } else {
          throw error;
        }
      }
    }
    return lastMessageId;
  }

  async sendMessage(
    chatId: string | number,
    message: string,
    extra?: unknown
  ): Promise<{ message_id: number }> {
    try {
      const job = await this.telegramQueue.add(
        'sendMessage',
        {
          chatId,
          message,
          extra,
        },
        {
          removeOnComplete: true,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000,
          }
        }
      );
      return job.finished();
    } catch (error) {
      if (error.response && error.response.statusCode === 429) {
        await this.handleRateLimit(error.response.message);
      }
      throw error;
    }
  }

  async editMessageText(
    chatId: number,
    message: string,
    messageId: number,
    inlineMessageId?: string,
    extra?: unknown
  ) {
    const jobId = `${chatId}-${messageId}`;
    try {
      const foundJob = await this.telegramQueue.getJob(jobId);
      if (foundJob && (await foundJob.isWaiting())) {
        Logger.log(`Removing old job ${jobId}`);
        try {
          await foundJob.remove();
        } catch (error) {
          ErrorHandlingService.handleError({ error, message: `Error removing old job` });
        }
      }
      const job = await this.telegramQueue.add(
        'editMessageText',
        {
          chatId,
          message,
          messageId,
          inlineMessageId,
          extra
        },
        {
          removeOnComplete: true,
          jobId: `${chatId}-${messageId}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        }
      );
      return job;
    } catch (error) {
      if (error.response && error.response.statusCode === 429) {
        await this.handleRateLimit(error.response.message);
      }
      ErrorHandlingService.handleError({ error, message: `Error editing message` });
      throw error;
    }
  }

  async pinMessage(
    chatId: string | number,
    messageId: number
  ): Promise<void> {
    try {
      await this._bot.telegram.pinChatMessage(chatId, messageId);
      await this.telegramQueue.add(
        'pinChatMessage',
        {
          chatId,
          messageId,
        },
        {
          removeOnComplete: true,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          }
        }
      );
    } catch (error) {
      if (error.response && error.response.statusCode === 429) {
        await this.handleRateLimit(error.response.message);
      }
      ErrorHandlingService.handleError({ error, message: `Error pinning message` });
      throw error;
    }
  }

  private async handleRateLimit(message: string) {
    Logger.warn('Hit rate limit, pausing queue');
    await this.telegramQueue.pause();
    const pauseSeconds = this._extractRetrySeconds(message) + 10;
    setTimeout(() => this.telegramQueue.resume(), 1000 * pauseSeconds);
  }

  private _extractRetrySeconds(message: string): number {
    const regex = /retry after (\d+)/;
    const match = (message || '').match(regex);
    return match ? parseInt(match[1], 10) : 0;
}
}
