import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { telegramQueueName } from './queues';
import { Queue } from 'bull';

@Injectable()
export class TelegramJobApiService {
  constructor(@InjectQueue(telegramQueueName) private telegramQueue: Queue) {
    this.telegramQueue.isPaused().then((paused) => {
      if (paused) {
        this.telegramQueue.resume();
      }
    });
  }

  async createOrUpdateLastMessage(
    lastMessageId: number | null,
    messageText: string,
    chatId: number
  ): Promise<number> {
    if (lastMessageId) {
      await this.editMessageText(
        chatId,
        messageText,
        lastMessageId
      );
    } else {
      try {
        const sentMessage = await this.sendMessage(
          chatId,
          messageText
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
    message: string
  ): Promise<{ message_id: number }> {
    try {
      const job = await this.telegramQueue.add(
        'sendMessage',
        {
          chatId,
          message,
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
    inlineMessageId?: string
  ) {
    const jobId = `${chatId}-${messageId}`;
    try {
      const foundJob = await this.telegramQueue.getJob(jobId);
      if (foundJob && (await foundJob.isWaiting())) {
        Logger.log(`Removing old job ${jobId}`);
        try {
          await foundJob.remove();
        } catch (e) {
          Logger.error(`Error removing old job: ${e}`);
        }
      }
      const job = await this.telegramQueue.add(
        'editMessageText',
        {
          chatId,
          message,
          messageId,
          inlineMessageId,
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
    } catch (e) {
      if (e.response && e.response.statusCode === 429) {
        await this.handleRateLimit(e.response.message);
      }
      Logger.error(`Error editing message: ${e}`);
      throw e;
    }
  }

 

  private async handleRateLimit(message: string) {
    Logger.error('Hit rate limit, pausing queue');
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
