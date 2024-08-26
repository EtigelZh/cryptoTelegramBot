import { Injectable, Module, Logger } from '@nestjs/common';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
import { dataSourceOptions } from '../data-source.options';
import { init } from '@sentry/node';
import { ProfilingIntegration } from "@sentry/profiling-node";

import { inspect } from 'util';
import { QueueOptions } from 'bull';
import * as process from 'node:process';
import { ErrorHandlingService } from './error-handling/error-handling-service';
import { CronExpression } from '@nestjs/schedule';

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
  process.on('uncaughtException', (error) => {
    ErrorHandlingService.handleError({ error });
  });
  process.on('unhandledRejection', (reason, promise) => {
    const unhandledRejection=  new Error(`Unhandled rejection: ${reason} ${inspect(promise)}`);
    ErrorHandlingService.handleError({ error: unhandledRejection });
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
  static readonly newMessageTelegramReportingCron = process.env.NEW_MESSAGE_TELEGRAM_REPORTING_CRON || '0 * * * *';
  static readonly zerionSearcherCron = process.env.ZERION_SEARCHER_CRON || '*/20 * * * *';
  static readonly etherscanSearcherCron = process.env.ETHERSCAN_SEARCHER_CRON || '0 0 * * *';
  static readonly checkMissingBlockCron = process.env.CHECK_MISSING_BLOCK_CRON || CronExpression.EVERY_HOUR;

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

  minTradesLastMonthThreshold: number = +(process.env.MIN_TRADES_LAST_MONTH_THRESHOLD || 60);
  minTradesLastWeekThreshold: number = +(process.env.MIN_TRADES_LAST_WEEK_THRESHOLD || 10);

  zerionUpdatingApiKeys = this._parseApiKeyAndLimits(process.env.ZERION_UPDATING_API_KEYS ?? '');
  zerionManualApiKeys = this._parseApiKeyAndLimits(process.env.ZERION_MANUAL_API_KEYS ?? '');

  walletSearcherZerionSourceWallets: string[] = (process.env.WALLET_SEARCHER_SOURCE_WALLETS || '0xb0999731f7c2581844658a9d2ced1be0077b7397').split(',');
  walletSearcherZerionBatchSize: number = +(process.env.WALLET_SEARCHER_BATCH_SIZE || 1000);
  walletSearcherSourceEtherscanWallets: string[] = (process.env.WALLET_SEARCHER_ETHERSCAN_SOURCE_WALLETS || '0xe592427a0aece92de3edee1f18e0157c05861564,0x3328f7f4a1d1c57c35df56bbf0c9dcafca309c49,0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D,0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad,0x80a64c6d7f12c47b7c66c5b4e20e72bc1fcd5d9e,0x881d40237659c251811cec9c364ef91dc08d300c').split(',');
  walletSearcherEtherscanBatchSize: number = +(process.env.WALLET_SEARCHER_ETHERSCAN_BATCH_SIZE || 10000);

  isWebsocketTransfersWatcherEnabled: boolean = process.env.IS_WEBSOCKET_TRANSFERS_WATCHER_ENABLED === 'true';
  isWebsocketSwapsWatcherEnabled: boolean = process.env.IS_WEBSOCKET_SWAPS_WATCHER_ENABLED === 'true';

  cacheTTL: number = +(process.env.CACHE_TTL || 60_000 * 60 * 24);
  maxWalletsToUpdate: number = +(process.env.MAX_WALLETS_TO_UPDATE || 5);

  summaryWalletsSheetId: string =
    process.env.SUMMARY_WALLETS_SHEET_ID ||
    '10hUgmGxMU6r-s8vGBvLN9Kn018v_dXIKiomFTTJopdQ';
  templateGoogleSheetId: string =
    process.env.TEMPLATE_GOOGLE_SHEET_ID ||
    '1Rey85ZLeJmXZZbpNomMhY78yQigq8BMB0nWYjnibV1g';
  targetGoogleSheetDirectoryId: string =
    process.env.TARGET_GOOGLE_SHEET_DIRECTORY_ID ||
    '1wmv8C1oS2L8D9stREL5-DZ2EoNFcaGu9';

  adminChatIds: string[] = (
    process.env.ADMINS_CHAT_ID || '-4039511820,254372545,341786440'
  )?.split(',');

  dailyUpdateReportChatId: number = +(process.env.DAILY_UPDATE_REPORT_CHAT_ID || '254372545'); // -1002079084911

  devPrefix: string = process.env.DEV_MESSAGE_PREFIX || '';

  network: string = process.env.NETWORK || 'mainnet';
  alchemyApiKey: string = process.env.ALCHEMY_API_KEY || '';
  metamaskPrivateKey: string = process.env.METAMASK_PRIVATE_KEY!;
  metamaskWalletAddress: string = process.env.METAMASK_WALLET_ADDRESS!;
  etherTokenAddress: string = process.env.ETHER_TOKEN_ADDRESS!;

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

  public getAlchemyWebsocketUrl() {
    const network = this.network === 'arbitrum' ? 'arb-mainnet' : 'eth-mainnet';
    if (!this.alchemyApiKey) {
      throw new Error('Alchemy API key is not set');
    }
    return `wss://${network}.g.alchemy.com/v2/${this.alchemyApiKey}`;
  }

  public getAlchemyHttpUrl() {
    const network = this.network === 'arbitrum' ? 'arb-mainnet' : 'eth-mainnet';
    return `https://${network}.alchemyapi.io/v2/${this.alchemyApiKey}`;
  }

  public getEtherscanTxUrl(txHash: string): string {
    const network = this.network === 'arbitrum' ? 'arbiscan.io' : 'etherscan.io';
    return `https://${network}/tx/${txHash}`;
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
