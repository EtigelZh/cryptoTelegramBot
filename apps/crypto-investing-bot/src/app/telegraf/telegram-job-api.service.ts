import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { telegramQueueName } from './queues';
import { Queue } from 'bull';

@Injectable()
export class TelegramJobApiService {
  constructor(@InjectQueue(telegramQueueName) private telegramQueue: Queue) {}

  async sendMessage(
    chatId: string | number,
    message: string
  ): Promise<{ message_id: number }> {
    const job = await this.telegramQueue.add(
      'sendMessage',
      {
        chatId,
        message,
      },
      { removeOnComplete: true }
    );

    return job.finished();
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
      // remove old jobs for update
      const job = await this.telegramQueue.add(
        'editMessageText',
        {
          chatId,
          message,
          messageId,
          inlineMessageId,
        },
        { removeOnComplete: true, jobId: `${chatId}-${messageId}` }
      );

      return job;
    } catch (e) {
      Logger.error(`Error editing message: ${e}`);
    }
  }
}
