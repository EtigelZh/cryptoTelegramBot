import type { ColumnOptions, PrimaryColumnOptions } from "typeorm";

export const WALLET_HASH_COLUMN: PrimaryColumnOptions = { type: 'varchar', length: 42 };
export const TRANSACTION_HASH_COLUMN: PrimaryColumnOptions = { type: 'varchar', length: 66 };
export const CURRENCY_SYMBOL_COLUMN: ColumnOptions = { type: 'varchar', length: 32 };
export const TIMESTAMP_COLUMN: ColumnOptions = { type: 'timestamp without time zone' };
export const UNSIGNED_BIGINT_COLUMN: ColumnOptions = { type: 'integer' };
export const INTEGER_COLUMN: ColumnOptions = { type: 'integer' };
