import { WalletTradeStatsSummary } from '../utils/economics';

export enum Period {
  ONE_WEEK = 'ONE_WEEK',
  ONE_MONTH = 'ONE_MONTH',
  THREE_MONTHS = 'THREE_MONTHS',
}

export type WalletFinancialStats = {
  periods: {
    [Period.ONE_WEEK]: WalletTradeStatsSummary;
    [Period.ONE_MONTH]: WalletTradeStatsSummary;
    [Period.THREE_MONTHS]: WalletTradeStatsSummary;
  };
  calculatedAt: Date;
};
