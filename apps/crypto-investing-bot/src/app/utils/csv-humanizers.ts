import { CurrencyTradeStatsBySymbol, WalletFinancialCalculatedAttributes } from './wallet-economics';

export function mapFinancialDataToCsvHeader(attributes: WalletFinancialCalculatedAttributes): unknown[][] {
  return [
    [
      'Win Rate R (CT)',
      formatPercent(attributes.winRateRCT),
    ],
    [
      'P&L R (CT)',
      formatCurrency(attributes.PLRCT),
      'Медианный вход',
      formatCurrency(attributes.medianEntry),
      'Avg lose',
      formatPercent(attributes.avgLose),
      'Avg win',
      formatPercent(attributes.avgWin),
      'Медианное кол-во покупок',
      formatNumber(attributes.medianPurchaseCount),
    ],
    [
      'RR, %',
      formatPercent(attributes.RR),
      'Средний вход',
      formatCurrency(attributes.averageEntry),
      'Median lose',
      formatPercent(attributes.medianLose),
      'Median win',
      formatPercent(attributes.medianWin),
      'Монет проторговано',
      formatNumber(attributes.tradedCoins),
      'Оборот значения',
      attributes.balances.join(',')
    ],
    [
      'Win Rate R',
      formatPercent(attributes.winRateR),
      'P&L R',
      formatCurrency(attributes.PLR),
      'Средний срок, д',
      formatNumber(attributes.averageTermDays),
      'Доходность годовых R',
      formatPercent(attributes.annualYieldR),
      'Комиссий',
      formatCurrency(attributes.commissions),
      'Median оборот',
      formatNumber(attributes.medianBalance),
    ],
    [
      'Win Rate Total',
      formatPercent(attributes.winRateTotal),
      'P&L Total',
      formatCurrency(attributes.PLTotal),
      'Профиль риска',
      formatNumber(attributes.riskProfile),
      'Доходность годовых',
      formatPercent(attributes.annualYield),
      'Ср.комиссия',
      formatCurrency(attributes.averageCommission),
      'Min оборот',
      formatNumber(attributes.minBalance)
    ]
  ];
}

function formatNumber(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).replace(/\s/g, '\u00A0');
}

function formatPercent(value: number): string {
  const sign = value < 0 ? "-" : "";
  const formattedValue = Math.abs(value * 100).toFixed(2).replace('.', ',') + '%';
  return sign + formattedValue;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).replace(/\s/g, '\u00A0');
}

export function mapCurrencyTradeStatsToCSV(data: CurrencyTradeStatsBySymbol): unknown[][] {
  const headers = [
    "Тикеры",
    "Всего купили", "Всего продали", "Комиссия, usd",
    "Дельта", "RR, %",
    "Накопление, usd", "Сумма покупок, usd", "Сумма продаж, usd", "Дельта, usd",
    "Дельта, % usd", "Покупок", "Продаж", "Срок сделки, д", "Первая покупка", "Последняя продажа",
    "Транзакции"
  ];

  const rows: unknown[][] = [headers];

  for (const [symbol, stats] of Object.entries(data)) {
    const row: (string | number | undefined)[] = [
      symbol,
      formatCurrency(stats.buyAmount), formatCurrency(stats.sellAmount), formatCurrency(stats.commissionsUsd),
      formatCurrency(stats.diffAmount), formatPercent(stats.RR),
      '0', formatCurrency(stats.buyUsd), formatCurrency(stats.sellUsd),
      formatCurrency(stats.diffUsd), formatPercent(stats.diffUsdPercent),
      formatNumber(stats.buyCount), formatNumber(stats.sellCount), formatNumber(stats.tradingPeriod),
      formatDate(stats.firstBuy), formatDate(stats.lastSell),
      stats.transactions.map(({receiveAmount, receiveCurrency, spentAmount, spentCurrency, id, date})=> `${id} ${date.toISOString().substring(0, 19).replace('T', ' ')} ${spentCurrency}-${spentAmount}=>${receiveCurrency}+${receiveAmount}`).join(',\n')
    ];

    rows.push(row.map(value => value !== undefined ? value : ""));
  }

  return rows;
}

function formatDate(date?: Date): string {
  return date ? date.toISOString().split('T')[0] : "";
}
