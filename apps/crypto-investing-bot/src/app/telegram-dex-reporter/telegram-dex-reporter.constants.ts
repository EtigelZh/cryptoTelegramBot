import { InjectionToken } from "@nestjs/common";

export const TELEGRAF_DEX_REPORTER: InjectionToken = 'TELEGRAF_DEX_REPORTER_INSTANCE';

export const telegrafDexReporterQueueName = 'consumerTelegramDexReporter';