import { CurrencySymbol, InOutTransactionFields } from './models';
import { FinanceData } from '../google-api/google-sheets/google-sheets.models';
import { daysDiff } from './dates';
import { avg, median } from './math';

/** TODO Описать все экономические параметры */
// export const EconomicParameters = {
//   buyAmount = 'Всего купили',
//   sellAmount = 'Всего продали',
//   diffAmount = 'Дельта',
//   diffAmountPercent = 'Дельта %',
//   RR = 'RR',
//   buyUsd = 'Сумма покупок, usd',
//   sellUsd = 'Сумма продаж, usd',
//   diffUsd = 'Дельта, usd',
//   diffUsdPercent = 'Дельта, % usd',
//   buyEth = 'Сумма покупок, eth',
//   sellEth = 'Сумма продаж, eth',
//   diffEth = 'Дельта, eth',
//   diffEthPercent = 'Дельта, % eth',
//   buyCount = 'Покупок',
//   sellCount = 'Продаж',
//   commissionAmount = 'Комиссия',
//   commissionsUsd = 'Комиссии, usd',
//   startTransactionDate = 'Первая покупка',
//   endTransactionDate = 'Последняя продажа',
//   transactionsCount = 'Количество сделок',
//   firstBuy = 'Первая покупка',
//   lastSell = 'Последняя продажа',
//   tradingPeriod = 'Срок сделки',
//   tradingPeriodForIncome = 'Срок сделки (для доходности)',
//   annualYieldUsdPercent = 'Доходность годовых usd, %',
//   annualYieldEthPercent = 'Доходность годовых eth, %',
//   tradeResultEth = 'Торговля в плюс или в минус eth',
//   tradeResultUsd = 'Торговля в плюс или в минус usd',
//   tradedCoinsRCount = 'Количество реализованных монет',
//   avgWin = 'Средний выигрыш',
//   medianWin = 'Медианный выигрыш',
//   avgLose = 'Средний проигрыш',
//   medianLose = 'Медианный проигрыш',
//   commissionsEth = 'Сумма коммисий в эфирах',
//   averageCommissionEth = 'Средняя комиссия в эфирах',
//   tradedCoins = 'Количество торговых пар',
//   averageEntry = 'Средний вход',
//   medianEntry = 'Медианный вход',
//   winRateTotal = 'Win Rate Total',
//   PLTotal = 'P&L Total',
//   riskProfile = 'Профиль риска',
//   annualYield = 'Доходность годовых',
//   medianPurchaseCount = 'Медианное кол-во покупок',
//   PLRCT = 'P&L R (CT) - сумма diffs в эфирах',
//   winRateRCT = 'Win Rate R (CT) - вин рейт по реализованным в эфирах',
//   winRateR = 'Win Rate R - вин рейт по реализованным в usd',
//   PLR = 'P&L R - сумма diffs в usd',
//   avgLoseEth = 'Средний проигрыш в эфирах',
//   medianLoseEth = 'Медианный проигрыш в эфирах',
//   avgWinEth = 'Средний выигрыш в эфирах',
//   annualYieldR = 'Доходность годовых R',
//   loseCounter = 'Lose Counter',
//   winCounter = 'Win Counter',
//   usdEntries = 'USD Entries',
//   averageTermDaysSum = 'Average Term Days Sum',
//   diffUsdTotalPercent = 'Diff USD Total Percent',
// }
//
// export type EconomicParameter = keyof typeof EconomicParameterLabel;

/** Аттрибуты нужные для расчета, но не попадающие в итоговый jsonb */
export type TemporaryCalculatingAttributes = {
  transactions?: TransactionTradeInfo[];
  sellTransactions?: TransactionTradeInfo[];
  buyTransactions?: TransactionTradeInfo[];
};

export enum TradeResult {
  WIN = 'WIN',
  LOSE = 'LOSE',
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
  /** Торговля в плюс или в минус */
  tradeResultEth?: TradeResult;
  tradeResultUsd?: TradeResult;
};

export type CurrencyTradeStatsBySymbol = Record<
  CurrencySymbol,
  CurrencyTradeStats
>;

export type WalletFinancialCalculatedAttributes = Record<
  keyof Pick<
    FinanceData,
    | 'tradedCoins'
    | 'averageEntry'
    | 'medianEntry'
    | 'winRateTotal'
    | 'PLTotal'
    | 'averageTermDays'
    | 'annualYield'
    | 'medianPurchaseCount'
    | 'commissions'
    | 'averageCommission'
    | 'winRateRCT'
    | 'PLRCT'
    | 'RR'
    | 'winRateR'
    | 'PLR'
    | 'avgWin'
    | 'medianWin'
    | 'avgLose'
    | 'medianLose'
    | 'annualYieldR'
    | 'riskProfile'
  >,
  number
> & {
  /** Доходность годовых в эфирах */
  annualYieldEthPercent: number;
  /** Медианное кол-во продаж */
  medianSellsCount: number;

  /** Сумма коммисий в эфирах */
  commissionsEth: number;
  /** Средняя комиссия в эфирах */
  averageCommissionEth: number;

  /** Количество реализованных монет */
  tradedCoinsRCount: number;

  avgWinEth: number;
  medianWinEth: number;
  avgLoseEth: number;
  medianLoseEth: number;
  /** Оборотный капитал */
  minBalance: number;
  medianBalance: number;

  // Balance - для расчета объема и оборота оборотного капитала
  balances: number[];
};

/** Промежуточные вычисления */
export type InnerAttributes = {
  // Win Rate counters
  loseCounter: number;
  winCounter: number;
  // Медианный вход
  usdEntries: number[];
  // P&L Total
  PLTotal: number;
  // Средний срок, д
  averageTermDaysSum: number;
  // Доходность годовых
  diffUsdTotalPercent: number;
  diffEthTotalPercent: number;
  // Медианное кол-во покупок
  buyCounts: number[];
  sellCounts: number[];
  // Комиссий
  commissions: number;
  commissionsEth: number;

  /** Глобальные каунтеры для реализованных монет RR > 95% */
  //  Win Rate R (CT) - вин рейт по реализованным в эфирах
  ethWinCounter: number;
  ethLoseCounter: number;
  // P&L R (CT) - сумма diffs в эфирах
  PLRCT: number;
  // RR, % процент реализованных монет
  tradedCoinsRCount: number;
  // Win Rate R
  usdLosesR: number;
  usdWinsR: number;
  // P&L R
  PLR: number;

  // Avg lose
  // Median lose
  losesUsd: number[];
  losesEth: number[];
  // Avg win
  // Median win
  winsUsd: number[];
  winsEth: number[];

  // Доходность годовых R
  annualYieldRTotal: number;
  annualYieldRCount: number;
};

export type WalletTradeStatsSummary = {
  source: CurrencyTradeStatsBySymbol;

  attributes: WalletFinancialCalculatedAttributes;
  innerAttributes: InnerAttributes;

  startTransactionDate?: Date;
  endTransactionDate?: Date;
  startTransactionHash?: string;
  endTransactionHash?: string;
  transactionsCount: number;
};

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
  'USDC.E',
];

export function calculateWalletStats(
  transactions: TransactionTradeInfo[],
  now = new Date(),
  RRThreshold = 0.95
): WalletTradeStatsSummary {
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

  const tradesWithBaseCurrency = transactions.filter(
    (transaction) =>
      (currenciesSet.has(transaction.receiveCurrency) &&
        transaction.spentCurrency === baseCurrency) ||
      (currenciesSet.has(transaction.spentCurrency) &&
        transaction.receiveCurrency === baseCurrency)
  );

  const source: Record<string, CurrencyTradeStats> = {};
  // balances для расчета оборотного капитала
  const balances = [0];
  let currentBalance = 0;
  for (const transaction of tradesWithBaseCurrency) {
    const isBuy = transaction.spentCurrency === baseCurrency;
    const symbol = isBuy
      ? transaction.receiveCurrency
      : transaction.spentCurrency;
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
    source[symbol].commissionAmount += +transaction.fee;
    source[symbol].commissionsUsd += +transaction.feeUsd;
    
    if (isBuy) {
      source[symbol].buyAmount += +transaction.receiveAmount;
      source[symbol].buyUsd += +transaction.spentUsd;
      source[symbol].buyEth += +transaction.spentAmount;
      source[symbol].buyTransactions.push(transaction);
      currentBalance -= +transaction.spentAmount;
      balances.push(currentBalance);
    } else {
      source[symbol].sellAmount += +transaction.spentAmount;
      source[symbol].sellUsd += +transaction.receiveUsd;
      source[symbol].sellEth += +transaction.receiveAmount;
      source[symbol].sellTransactions.push(transaction);
      currentBalance += +transaction.receiveAmount;
      balances.push(currentBalance);
    }
  }

  /** Глобальные каунтеры для расчета показателей по всем монетам */
  // Win Rate counters
  let loseCounter = 0;
  let winCounter = 0;
  // Медианный вход
  const usdEntries: number[] = [];
  // P&L Total
  let PLTotal = 0;
  // Средний срок, д
  let averageTermDaysSum = 0;
  // Доходность годовых
  let diffUsdTotalPercent = 0;
  let diffEthTotalPercent = 0;
  // Медианное кол-во покупок
  const buyCounts: number[] = [];
  const sellCounts: number[] = [];
  // Комиссий
  let commissions = 0;
  let commissionsEth = 0;

  /** Глобальные каунтеры для реализованных монет RR > 95% */
  //  Win Rate R (CT) - вин рейт по реализованным в эфирах
  let ethWinCounter = 0;
  let ethLoseCounter = 0;
  // P&L R (CT) - сумма diffs в эфирах
  let PLRCT = 0;
  // RR, % процент реализованных монет
  let tradedCoinsRCount = 0;
  // Win Rate R
  let usdLosesR = 0;
  let usdWinsR = 0;
  // P&L R
  let PLR = 0;

  // Avg lose
  // Median lose
  const losesUsd: number[] = [];
  const losesEth: number[] = [];
  // Avg win
  // Median win
  const winsUsd: number[] = [];
  const winsEth: number[] = [];

  // Доходность годовых R
  let annualYieldRTotal = 0;
  let annualYieldRCount = 0;

  for (const symbolStats of Object.values(source)) {
    symbolStats.startTransactionHash = symbolStats.transactions[0]?.id;
    symbolStats.endTransactionHash =
      symbolStats.transactions[symbolStats.transactions.length - 1]?.id;
    symbolStats.startTransactionDate = symbolStats.transactions[0]?.date;
    symbolStats.endTransactionDate =
      symbolStats.transactions[symbolStats.transactions.length - 1]?.date;

    symbolStats.transactionsCount = symbolStats.transactions.length;
    symbolStats.buyCount = symbolStats.buyTransactions.length;
    symbolStats.sellCount = symbolStats.sellTransactions.length;

    symbolStats.firstBuy = symbolStats.buyTransactions[0]?.date || new Date();
    symbolStats.lastSell =
      symbolStats.sellTransactions[symbolStats.sellTransactions.length - 1]
        ?.date || new Date();
    symbolStats.tradingPeriod = Math.round(
      daysDiff(symbolStats.lastSell || now, symbolStats.firstBuy || now)
    );
    symbolStats.tradingPeriodForIncome = Math.max(symbolStats.tradingPeriod, 1);

    symbolStats.diffAmount = symbolStats.buyAmount - symbolStats.sellAmount;
    symbolStats.diffAmountPercent =
      1 - symbolStats.diffAmount / symbolStats.sellAmount;
    symbolStats.RR = 1 - symbolStats.diffAmount / (symbolStats.buyAmount || 1); // фикс деления на 0

    symbolStats.diffUsd =
      symbolStats.sellUsd - symbolStats.buyUsd - symbolStats.commissionsUsd;
    symbolStats.diffUsdPercent =
      symbolStats.diffUsd / (symbolStats.buyUsd || 1); // фикс деления на 0
    symbolStats.annualYieldUsdPercent =
      (symbolStats.diffUsdPercent / (symbolStats.tradingPeriodForIncome || 1)) *
      365; // фикс деления на 0

    symbolStats.diffEth =
      symbolStats.sellEth - symbolStats.buyEth - symbolStats.commissionAmount;
    symbolStats.diffEthPercent =
      symbolStats.diffEth / (symbolStats.buyEth || 1); // фикс деления на 0
    symbolStats.annualYieldEthPercent =
      (symbolStats.diffEthPercent / (symbolStats.tradingPeriodForIncome || 1)) *
      365; // фикс деления на 0

    symbolStats.tradeResultUsd =
      symbolStats.diffUsd > 0 ? TradeResult.WIN : TradeResult.LOSE;
    symbolStats.tradeResultEth =
      symbolStats.diffEth > 0 ? TradeResult.WIN : TradeResult.LOSE;

    // Win Rate Total
    symbolStats.diffUsd > 0 ? winCounter++ : loseCounter++;

    // Медианный вход
    // Средний вход
    usdEntries.push(symbolStats.buyUsd);

    // P&L Total
    PLTotal += +symbolStats.diffUsd;

    // Средний срок, д
    averageTermDaysSum += +symbolStats.tradingPeriod;

    // Доходность годовых
    diffUsdTotalPercent += +symbolStats.diffUsdPercent;
    diffEthTotalPercent += +symbolStats.diffEthPercent;
    // Медианное кол-во покупок
    buyCounts.push(symbolStats.buyCount);
    sellCounts.push(symbolStats.sellCount);
    // Комиссий
    commissions = symbolStats.commissionsUsd;
    commissionsEth = symbolStats.commissionAmount;

    // считаем стату для монет у который RR > 0.95 -> сумма реализованных монет больше 95%
    if (symbolStats.RR > RRThreshold) {
      // Win Rate R (CT) - вин рейт по победам в эфирах
      symbolStats.tradeResultEth === TradeResult.WIN
        ? ethWinCounter++
        : ethLoseCounter++;

      // P&L R (CT) - сумма diffs в эфирах
      PLRCT += symbolStats.diffEth;

      // RR, % - процент реализованных монет
      tradedCoinsRCount++;

      // Win Rate R
      symbolStats.tradeResultUsd === TradeResult.WIN ? usdWinsR++ : usdLosesR++;

      // P&L R
      PLR += symbolStats.diffUsd;

      // Avg lose
      // Median lose
      // Avg win
      // Median win
      symbolStats.tradeResultUsd === TradeResult.WIN
        ? winsUsd.push(symbolStats.diffUsd)
        : losesUsd.push(symbolStats.diffUsd);
      symbolStats.tradeResultEth === TradeResult.WIN
        ? winsEth.push(symbolStats.diffEth)
        : losesEth.push(symbolStats.diffEth);

      // Доходность годовых R - по выигранным сделкам
      if (symbolStats.tradeResultUsd === TradeResult.WIN) {
        annualYieldRTotal += symbolStats.annualYieldUsdPercent;
        annualYieldRCount++;
      }
      // Профиль риска
    }

    // транзакции больше не нужны удаляем их из статы что бы не попали в jsonb
    symbolStats.transactions = symbolStats.transactions.map(
      (transaction) =>
        <TransactionTradeInfo>{
          date: transaction.date,
          fee: transaction.fee,
          feeUsd: transaction.feeUsd,
          id: transaction.id,
          receiveAmount: transaction.receiveAmount,
          receiveCurrency: transaction.receiveCurrency,
          receiveUsd: transaction.receiveUsd,
          receiveUsdRate: transaction.receiveUsdRate,
          spentAmount: transaction.spentAmount,
          spentCurrency: transaction.spentCurrency,
          spentUsd: transaction.spentUsd,
          spentUsdRate: transaction.spentUsdRate,
        }
    );
    symbolStats.sellTransactions = symbolStats.sellTransactions.map(
      (transaction) => ({ id: transaction.id } as TransactionTradeInfo)
    );
    symbolStats.buyTransactions = symbolStats.buyTransactions.map(
      (transaction) => ({ id: transaction.id } as TransactionTradeInfo)
    );
  }

  const currenciesCount = currenciesSet.size || 1; // Фикс деления на 0
  const medianWin = median(winsUsd);
  const medianLose = median(losesUsd);
  return {
    source,
    attributes: {
      // Win Rate Total
      winRateTotal: winCounter / (winCounter + loseCounter || 1), // фикс деления на 0
      // Монет проторговано
      tradedCoins: currenciesSet.size,
      // Медианный вход
      // Средний вход
      averageEntry: avg(usdEntries),
      medianEntry: median(usdEntries),
      // P&L Total
      PLTotal,
      // Средний срок, д
      averageTermDays: averageTermDaysSum / currenciesCount,
      // Доходность годовых
      annualYield: (diffUsdTotalPercent / currenciesCount) * 365,
      annualYieldEthPercent: (diffEthTotalPercent / currenciesCount) * 365,
      // Медианное кол-во покупок
      medianPurchaseCount: median(buyCounts),
      medianSellsCount: median(sellCounts),
      // Комиссий
      commissions,
      commissionsEth,
      // Ср.комиссия
      averageCommission: commissions / currenciesCount,
      averageCommissionEth: commissionsEth / currenciesCount,
      // Win Rate R (CT) - вин рейт по реализованным в эфирах
      winRateRCT: ethWinCounter / (ethWinCounter + ethLoseCounter),
      // P&L R (CT) - сумма diffs в эфирах - сколько заработали или проиграли эфиров
      PLRCT,
      // RR, % процент реализованных монет
      tradedCoinsRCount,
      RR: tradedCoinsRCount / currenciesCount,
      // Win Rate R
      winRateR: usdWinsR / (usdWinsR + usdLosesR || 1), // фикс деления на 0
      // P&L R
      PLR,
      // Avg lose
      avgLose: avg(losesUsd),
      avgLoseEth: avg(losesEth),
      // Median lose
      medianLose,
      medianLoseEth: median(losesEth),
      // Avg win
      avgWin: avg(winsUsd),
      avgWinEth: avg(winsEth),
      // Median win
      medianWin,
      medianWinEth: median(winsEth),
      // Доходность годовых R
      annualYieldR: annualYieldRTotal / (annualYieldRCount || 1), // фикс деления на 0
      // Профиль риска
      riskProfile: medianWin / (Math.abs(medianLose) || 1), // фикс деления на 0

      balances,
      medianBalance: median(balances),
      minBalance: Math.min(...balances),
    },
    /** переменные используемые во внутренних вычислениях */
    innerAttributes: {
      // Win Rate counters
      loseCounter,
      winCounter,
      // Медианный вход
      usdEntries,
      // P&L Total
      PLTotal,
      // Средний срок, д
      averageTermDaysSum,
      // Доходность годовых
      diffUsdTotalPercent,
      diffEthTotalPercent,
      // Медианное кол-во покупок
      buyCounts,
      sellCounts,
      // Комиссий
      commissions,
      commissionsEth,

      /** Глобальные каунтеры для реализованных монет RR > 95% */
      //  Win Rate R (CT) - вин рейт по реализованным в эфирах
      ethWinCounter,
      ethLoseCounter,
      // P&L R (CT) - сумма diffs в эфирах
      PLRCT,
      // RR, % процент реализованных монет
      tradedCoinsRCount,
      // Win Rate R
      usdLosesR,
      usdWinsR,
      // P&L R
      PLR,

      // Avg lose
      // Median lose
      losesUsd,
      losesEth,
      // Avg win
      // Median win
      winsUsd,
      winsEth,

      // Доходность годовых R
      annualYieldRTotal,
      annualYieldRCount,
    },
    startTransactionDate: transactions[0]?.date,
    endTransactionDate: transactions[transactions.length - 1]?.date,
    startTransactionHash: transactions[0]?.id,
    endTransactionHash: transactions[transactions.length - 1]?.id,
    transactionsCount: transactions.length,
  };
}
