/**
 * Hex string 42 characters long
 */
export type WalletHash = string;

/**
 * Hex string 66 characters long
 */
export type TransactionHash = string;

export enum TransactionType {
  approve = 'approve',
  borrow = 'borrow',
  burn = 'burn',
  cancel = 'cancel',
  claim = 'claim',
  deploy = 'deploy',
  deposit = 'deposit',
  execute = 'execute',
  mint = 'mint',
  receive = 'receive',
  repay = 'repay',
  send = 'send',
  stake = 'stake',
  trade = 'trade',
  unstake = 'unstake',
  withdraw = 'withdraw',
}

export enum TransactionStatus {
  confirmed = 'confirmed',
  failed = 'failed',
  pending = 'pending',
}

export enum TransferDirection {
  in = 'in',
  out = 'out',
  self = 'self',
}

/**
 * Currency symbol
 */
export type CurrencySymbol = string;

export type Quantity = {
  /** big integer as string */
  int: string;
  /** int */
  decimals: number;
  /** float */
  float: number;
  /** numeric as string */
  numeric: '0.001608916307814802';
};

export type InOutTransactionFields = {
  receiveAmount: number;
  receiveCurrency: CurrencySymbol;
  receiveUsd: number;
  receiveUsdRate: number;

  spentAmount: number;
  spentCurrency: CurrencySymbol;
  spentUsd: number;
  spentUsdRate: number;

  /** Поле для фикса багов в расчетах, если нужно пересчитать икрементим версию */
  inOutTransactionFieldsVersion: number;
};

export type AmountGroup = {
  amount: number;
  amountCurrency: CurrencySymbol;
  amountUsd: number | null;
  amountUsdRate: number | null;
};

export type AddIfNotExistsResult = {
  isAdded: boolean;
};

export type AddButchIfNotExistsResult<Key = string, SavedEntity = unknown> = {
  added: SavedEntity[];
  exists: Key[];
};
