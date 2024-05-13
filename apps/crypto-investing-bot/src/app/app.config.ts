import { Injectable, Module, Logger } from '@nestjs/common';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
import { dataSourceOptions } from '../data-source.options';
import { init, captureException } from '@sentry/node';
import { ProfilingIntegration } from "@sentry/profiling-node";

import { inspect } from 'util';
import { QueueOptions } from 'bull';
import * as process from 'node:process';

let defaultEnvPath = resolve(__dirname, 'assets', 'config', 'default.env');
let privateEnvPath = resolve(__dirname, 'assets', 'config', 'private.env');

if (process.env.NODE_ENV === 'production') {
  defaultEnvPath = '/usr/app/config/default.env';
  privateEnvPath = '/usr/app/config/private.env';
}

Logger.verbose(`Loading default env from ${defaultEnvPath} ${privateEnvPath}`);

const defaultEnv = dotenv.config({ path: defaultEnvPath });
const privateEnv = dotenv.config({ path: privateEnvPath });

const allEnvs: Record<string, string> = {
  ...defaultEnv.parsed,
  ...privateEnv.parsed,
};
for (const key in allEnvs) {
  if (!process.env[key]) {
    process.env[key] = allEnvs[key];
  }
}

if (allEnvs.SENTRY_DSN) {
  Logger.verbose('Sentry initialized');
} else {
  Logger.verbose('Sentry not initialized, empty SENTRY_DSN');
}

init({
  dsn: allEnvs.SENTRY_DSN,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  enabled: !!allEnvs.SENTRY_DSN,
  environment: allEnvs.SENTRY_ENV,
  integrations: [
    // Add profiling integration to list of integrations
    new ProfilingIntegration(),
  ],
});
if (typeof process.on === 'function') {
  process.on('uncaughtException', (err) => {
    Logger.error(`Uncaught exception: ${err}`);
    captureException(err);
  });
  process.on('unhandledRejection', (reason, promise) => {
    Logger.error(`Unhandled rejection: ${reason}`);
    captureException(reason, {
      extra: {
        promise: inspect(promise),
      },
    });
  });
}


export type ApiKeyAndLimit = { token: string; limit: number };

@Injectable()
export class AppConfig {
  static readonly walletProcessorConcurrency = +(process.env.WALLET_PROCESSOR_CONCURRENCY || 4);
  static readonly sendTelegramMessageProcessorConcurrency = +(process.env.SEND_TELEGRAM_MESSAGE_CONCURRENCY || 4);
  static readonly updateTelegramMessageProcessorConcurrency = +(process.env.UPDATE_TELEGRAM_MESSAGE_CONCURRENCY || 4);
  static readonly updateOldWalletsCron = process.env.UPDATE_OLD_WALLETS_CRON || '10 */6 * * *';
  static readonly longTermProcessingCron = process.env.LONG_TERM_PROCESSING_CRON || '*/1 * * * *';
  static readonly telegramReportingCron = process.env.TELEGRAM_REPORTING_CRON || '*/1 * * * *';
  static readonly newMessageTelegramReportingCron = process.env.TELEGRAM_REPORTING_CRON || '0 * * * *';

  minioEndpoint: string = process.env.MINIO_ENDPOINT || '';
  minioEndpointPort: number = +(process.env.MINIO_ENDPOINT_PORT || 9000);
  minioAccessKey: string = process.env.MINIO_ACCESS_KEY || '';
  minioSecretKey: string = process.env.MINIO_SECRET_KEY || '';
  telegramBotToken: string = process.env.TELEGRAM_BOT_TOKEN || '';
  etherscanApiKey: string = process.env.ETHERSCAN_API_KEY || '';
  coinmarketCupApiKey: string = process.env.COINMARKETCUP_API_KEY || '';
  zerionApiKey: string = process.env.ZERION_API_KEY || '';
  longTermProcessingBatchSize: number = +(process.env.LONG_TERM_PROCESSING_BATCH_SIZE || 10);
  thresholdForLongTermProcessing: number = +(process.env.THRESHOLD_FOR_LONG_TERM_PROCESSING || 50);

  zerionUpdatingApiKeys = this._parseApiKeyAndLimits(process.env.ZERION_UPDATING_API_KEYS ?? '');
  zerionManualApiKeys = this._parseApiKeyAndLimits(process.env.ZERION_MANUAL_API_KEYS ?? '');

  cacheTTL: number = +(process.env.CACHE_TTL || 60_000 * 60 * 24);
  maxWalletsToUpdate: number = +(process.env.MAX_WALLETS_TO_UPDATE || 5);

  summaryWalletsSheetId: string =
    process.env.SUMMARY_WALLETS_SHEET_ID ||
    '10hUgmGxMU6r-s8vGBvLN9Kn018v_dXIKiomFTTJopdQ';
  templateGoogleSheetId: string =
    process.env.TEMPLATE_GOOGLE_SHEET_ID ||
    '1eK8MiKcSbDup0nghJ5_TI5Bd19B5ZpD784yoyP71gEk';
  targetGoogleSheetDirectoryId: string =
    process.env.TARGET_GOOGLE_SHEET_DIRECTORY_ID ||
    '1wmv8C1oS2L8D9stREL5-DZ2EoNFcaGu9';

  adminChatIds: string[] = (
    process.env.ADMINS_CHAT_ID || '-4039511820,254372545,341786440'
  )?.split(',');

  dailyUpdateReportChatId: number = +(process.env.DAILY_UPDATE_REPORT_CHAT_ID || '-1002079084911');

  devPrefix: string = process.env.DEV_MESSAGE_PREFIX || '';
  public async getDbConfig() {
    return dataSourceOptions({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      username: process.env.POSTGRES_USERNAME,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.DB_NAME,
    });
  }

  public getRedisConfig() {
    const conf = {
      host: process.env.REDIS_HOST || 'localhost',
      port: +(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || 'asfsaw123dsj',
    };
    return conf;
  }

  public getRedisUrl() {
    const { host, port } = this.getRedisConfig();
    return `redis://${host}:${port}/8`;
  }

  public getBullConfig(): QueueOptions {
    return {
      redis: this.getRedisConfig(),
    };
  }

  private _parseApiKeyAndLimits(apiKeyAndLimits: string): ApiKeyAndLimit[] {
    return apiKeyAndLimits.split(',').map(tokenAndLimit => tokenAndLimit.split(':')).map(([token, limit]) => ({token, limit: +(limit || 0)})).filter(({token, limit}) => token && limit);
  }
}

@Module({
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
