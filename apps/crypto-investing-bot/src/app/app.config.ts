import { Injectable, Module, Logger } from '@nestjs/common';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
import { dataSourceOptions } from '../data-source.options';

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

@Injectable()
export class AppConfig {
  minioEndpoint: string = process.env.MINIO_ENDPOINT || '';
  minioEndpointPort: number = +(process.env.MINIO_ENDPOINT_PORT || 9000);
  minioAccessKey: string = process.env.MINIO_ACCESS_KEY || '';
  minioSecretKey: string = process.env.MINIO_SECRET_KEY || '';
  telegramBotToken: string = process.env.TELEGRAM_BOT_TOKEN || '';
  etherscanApiKey: string = process.env.ETHERSCAN_API_KEY || '';
  coinmarketCupApiKey: string = process.env.COINMARKETCUP_API_KEY || '';
  zerionApiKey: string = process.env.ZERION_API_KEY || '';

  templateGoogleSheetId: string = process.env.TEMPLATE_GOOGLE_SHEET_ID || '';
  targetGoogleSheetDirectoryId: string = process.env.TARGET_GOOGLE_SHEET_DIRECTORY_ID || '';

  adminChatIds: string[] = (
    process.env.ADMINS_CHAT_ID || '-4039511820,254372545,341786440'
  )?.split(',');
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
}

@Module({
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
