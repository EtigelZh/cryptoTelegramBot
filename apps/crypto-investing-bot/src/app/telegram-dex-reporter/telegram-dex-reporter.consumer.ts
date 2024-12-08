import { Processor } from '@nestjs/bull';
import {
  TELEGRAF_DEX_REPORTER,
  telegrafDexReporterQueueName,
} from './telegram-dex-reporter.constants';
import { Inject } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { TelegramConsumer } from '../telegraf/telegram.consumer';

@Processor(telegrafDexReporterQueueName)
export class TelegramDexReporterConsumer extends TelegramConsumer {
  constructor(
    @Inject(TELEGRAF_DEX_REPORTER)
    protected override bot: Telegraf
  ) {
    super(bot);
  }
}
