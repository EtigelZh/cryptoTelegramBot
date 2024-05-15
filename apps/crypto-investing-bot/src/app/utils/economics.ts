import { CurrencySymbol, InOutTransactionFields } from './models';
import { FinanceData } from '../google-api/google-sheets/google-sheets.models';
import { daysDiff } from './dates';

/** Аттрибуты нужные для расчета, но не попадающие в итоговый jsonb */
export type TemporaryCalculatingAttributes = {
  transactions?: TransactionTradeInfo[];
  sellTransactions?: TransactionTradeInfo[];
  buyTransactions?: TransactionTradeInfo[];
}

export type CurrencyTradeStats = TemporaryCalculatingAttributes & {
  // Количество монет
  /** Всего купили */
  buyAmount: number;
  /** Всего продали */
  sellAmount: number;
  /** Дельта */
  diffAmount: number;
  /** Дельта % */
  diffAmountPercent: number;
  /** RR, % - процент реализованных */
  RR: number;

  // Сумма в usd
  /** Сумма покупок, usd */
  buyUsd: number;
  /** Сумма продаж, usd */
  sellUsd: number;
  /** Дельта, usd */
  diffUsd: number;
  /** Дельта, % usd */
  diffUsdPercent: number;

  // Сумма в eth
  /** Сумма покупок, eth */
  buyEth: number;
  /** Сумма продаж, eth */
  sellEth: number;
  /** Дельта, eth */
  diffEth: number;
  /** Дельта, % eth */
  diffEthPercent: number;

  /** Покупок */
  buyCount: number;
  /** Продаж */
  sellCount: number;

  // Комиссии
  commissionAmount: number;
  commissionsUsd: number;

  // Статистика
  startTransactionDate?: Date;
  endTransactionDate?: Date;
  startTransactionHash?: string;
  endTransactionHash?: string;
  transactionsCount: number;

  /** Первая покупка */
  firstBuy?: Date;
  /** Последняя продажа */
  lastSell?: Date;
  /** срок сделки */
  tradingPeriod?: number;
  /** срок сделки (для доходности) */
  tradingPeriodForIncome?: number;
  /** Доходность годовых usd, % */
  annualYieldUsdPercent?: number;
  /** Доходность годовых eth, % */
  annualYieldEthPercent?: number;
}

export type CurrencyTradeStatsBySymbol = Record<CurrencySymbol, CurrencyTradeStats>;

export type WalletFinancialCalculatedAttributes = Record<keyof Pick<FinanceData, 'tradedCoins' | 'averageEntry'>, number>;

export type WalletTradeStatsSummary = {
  source: CurrencyTradeStatsBySymbol;

  attributes: WalletFinancialCalculatedAttributes;

  startTransactionDate?: Date;
  endTransactionDate?: Date;
  startTransactionHash?: string;
  endTransactionHash?: string;
  transactionsCount: number;
}

export type TransactionTradeInfo = InOutTransactionFields & {
  id: string;
  date: Date;
  fee: number;
  feeUsd: number;
};

const stableCoins = [
  'BNB',
  'BUSD',
  'USDC',
  'USDT',
  'WETH',
  'BITCOIN',
  'USDC.E'
];

export function calculateWalletStats(transactions: TransactionTradeInfo[]): WalletTradeStatsSummary {
  // TODO подумать как обрабатывать транзакции где токены покупаются за другую токены
  // TODO подумать как обрабатывать транзакции где токены покупаются за стейбкоины
  // Группируем sell и buy по валютам
  const currenciesSet = new Set<string>();
  for (const transaction of transactions) {
    currenciesSet.add(transaction.receiveCurrency);
    currenciesSet.add(transaction.spentCurrency);
  }
  const baseCurrency = 'ETH';
  // исключаем эфир и стейблкоины
  for (const stableCoin of stableCoins) {
    currenciesSet.delete(stableCoin);
  }
  currenciesSet.delete(baseCurrency);

  const tradesWithBaseCurrency = transactions.filter(transaction => transaction.receiveCurrency === baseCurrency || transaction.spentCurrency === baseCurrency);

  const source: Record<string, CurrencyTradeStats> = {};

  for (const transaction of tradesWithBaseCurrency) {
    const isBuy = transaction.spentCurrency === baseCurrency;
    const symbol = isBuy ? transaction.receiveCurrency : transaction.spentCurrency;
    if (!source[symbol]) {
      source[symbol] = {
        transactions: [],
        sellTransactions: [],
        buyTransactions: [],

        buyAmount: 0,
        sellAmount: 0,
        diffAmount: 0,
        diffAmountPercent: 0,

        buyUsd: 0,
        sellUsd: 0,
        diffUsd: 0,
        diffUsdPercent: 0,

        buyEth: 0,
        sellEth: 0,
        diffEth: 0,
        diffEthPercent: 0,

        buyCount: 0,
        sellCount: 0,
        commissionAmount: 0,
        commissionsUsd: 0,
        transactionsCount: 0,
        RR: 0,
      };
    }
    source[symbol].transactions.push(transaction);
    source[symbol].commissionAmount += transaction.fee;
    source[symbol].commissionsUsd += transaction.feeUsd;
    if (isBuy) {
      source[symbol].buyAmount += transaction.receiveAmount;
      source[symbol].sellUsd += transaction.spentUsd;
      source[symbol].sellEth += transaction.spentAmount;
      source[symbol].buyTransactions.push(transaction);
    } else {
      source[symbol].sellAmount += transaction.spentAmount;
      source[symbol].buyUsd += transaction.receiveUsd;
      source[symbol].buyEth += transaction.receiveAmount;
      source[symbol].sellTransactions.push(transaction);
    }
  }

  for (const symbolStats of Object.values(source)) {
    symbolStats.startTransactionHash = symbolStats.transactions[0]?.id;
    symbolStats.endTransactionHash = symbolStats.transactions[symbolStats.transactions.length - 1]?.id;
    symbolStats.startTransactionDate = symbolStats.transactions[0]?.date;
    symbolStats.endTransactionDate = symbolStats.transactions[symbolStats.transactions.length - 1]?.date;

    symbolStats.transactionsCount = symbolStats.transactions.length;
    symbolStats.buyCount = symbolStats.buyTransactions.length;
    symbolStats.sellCount = symbolStats.sellTransactions.length;

    symbolStats.firstBuy = symbolStats.buyTransactions[0]?.date || new Date();
    symbolStats.lastSell = symbolStats.sellTransactions[symbolStats.sellTransactions.length - 1]?.date || new Date();
    symbolStats.tradingPeriod = daysDiff(symbolStats.lastSell, symbolStats.firstBuy);
    symbolStats.tradingPeriodForIncome = daysDiff(symbolStats.endTransactionDate, symbolStats.startTransactionDate) || 1;

    symbolStats.diffAmount = symbolStats.buyAmount - symbolStats.sellAmount;
    symbolStats.diffAmountPercent = 1 - symbolStats.diffAmount / symbolStats.sellAmount;
    symbolStats.RR = 1 - symbolStats.diffAmount / symbolStats.buyAmount;

    symbolStats.diffUsd = symbolStats.buyUsd - symbolStats.sellUsd;
    symbolStats.diffUsdPercent = 1 - symbolStats.diffUsd / symbolStats.sellUsd;
    symbolStats.annualYieldUsdPercent = symbolStats.diffUsdPercent / symbolStats.tradingPeriodForIncome * 365;

    symbolStats.diffEth = symbolStats.buyEth - symbolStats.sellEth;
    symbolStats.diffEthPercent = 1 - symbolStats.diffEth / symbolStats.sellEth;
    symbolStats.annualYieldEthPercent = symbolStats.diffEthPercent / symbolStats.tradingPeriodForIncome * 365;

    // считаем стату для монет у который RR > 0.95 -> сумма реализованных монет больше 95%
    if (symbolStats.RR > 0.95) {
      // Win Rate R (CT)
      // P&L R (CT)
      // RR, %
      // Win Rate R
      // P&L R
      // Avg lose
      // Median lose
      // Avg win
      // Median win
      // Доходность годовых R
    }
    // Это считаем по всем монетам
    // Win Rate Total
    // Медианный вход
    // Средний вход
    // P&L Total
    // Средний срок, д
    // Профиль риска
    // Доходность годовых
    // Медианное кол-во покупок
    // Монет проторговано
    // Комиссий
    // Ср.комиссия

    // транзакции больше не нужны удаляем их из статы что бы не попали в jsonb
    delete symbolStats.transactions;
    delete symbolStats.sellTransactions;
    delete symbolStats.buyTransactions;
  }

  return {
    source,
    attributes: {
      tradedCoins: currenciesSet.size,
      averageEntry: 0
    },
    startTransactionDate: transactions[0]?.date,
    endTransactionDate: transactions[transactions.length - 1]?.date,
    startTransactionHash: transactions[0]?.id,
    endTransactionHash: transactions[transactions.length - 1]?.id,
    transactionsCount: transactions.length,
  };
  // торговля парами валют ETH DODO -> DODO ETH
  // Считаем сколько плюс сколько минус
  // Группируем транзакции по валютам
  // потом считаем стату по каждой группе считаем что чувак зашел в монету вышел из нее
  // исключаем эфир и стейблкоины
  // считаем стату
}
