import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { migrations } from './app/migrations';
import { NamingStrategy } from './app/utils/naming-strategy';
import { entities } from './app/app.entities';

export function dataSourceOptions(override: Partial<Pick<PostgresConnectionOptions, 'host' | 'username' | 'password' | 'database'> & {port: string}> = {}): PostgresConnectionOptions {
  return {
    type: 'postgres',
    port: +(override.port || 5449),
    username: override.username || 'invest_bot',
    password: override.password || 'fdgdfsgds',
    database: override.database || 'invest_bot_dev',
    host: override.host || 'localhost',
    logging: ['schema', 'error', 'warn', 'info', 'log'],
    dropSchema: false,
    entities,
    synchronize: false,
    migrationsRun: true,
    migrationsTransactionMode: 'each',
    migrations,
    namingStrategy: new NamingStrategy(),
  } as PostgresConnectionOptions;
}
