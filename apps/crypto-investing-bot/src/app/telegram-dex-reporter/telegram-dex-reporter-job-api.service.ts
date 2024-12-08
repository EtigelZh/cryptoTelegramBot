import { Injectable } from '@nestjs/common';
import { TelegramJobApiService } from '../telegraf/telegram-job-api.service';
import { Queue } from 'bull';
import { telegrafDexReporterQueueName } from './telegram-dex-reporter.constants';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class TelegramDexReporterJobApiService extends TelegramJobApiService {
  constructor(
    @InjectQueue(telegrafDexReporterQueueName)
    protected override telegramQueue: Queue
  ) {
    super(telegramQueue);
  }
}
