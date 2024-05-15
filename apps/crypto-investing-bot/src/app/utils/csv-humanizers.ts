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
      formatCurrency(attributes.avgLose),
      'Avg win',
      formatCurrency(attributes.avgWin),
      'Медианное кол-во покупок',
      formatNumber(attributes.medianPurchaseCount),
    ],
    [
      'RR, %',
      formatPercent(attributes.RR),
      'Средний вход',
      formatCurrency(attributes.averageEntry),
      'Median lose',
      formatCurrency(attributes.medianLose),
      'Median win',
      formatCurrency(attributes.medianWin),
      'Монет проторговано',
      formatNumber(attributes.tradedCoins),
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
    ]
  ];
}
function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
export function mapCurrencyTradeStatsToCSV(data: CurrencyTradeStatsBySymbol): string[][] {
  const headers = [
    "Тикеры", "Всего купили", "Всего продали", "Комиссия, usd", "Дельта", "RR, %",
    "Накопление, usd", "Сумма покупок, usd", "Сумма продаж, usd", "Дельта, usd",
    "Дельта, % usd", "Покупок", "Продаж", "Срок сделки, д", "Первая покупка", "Последняя продажа"
  ];

  const rows: string[][] = [headers];

  for (const [symbol, stats] of Object.entries(data)) {
    const row: (string | number | undefined)[] = [
      symbol,
      stats.buyAmount, stats.sellAmount, stats.commissionsUsd, stats.diffAmount, stats.RR,
      stats.buyUsd - stats.sellUsd, stats.buyUsd, stats.sellUsd, stats.diffUsd,
      stats.diffUsdPercent, stats.buyCount, stats.sellCount, stats.tradingPeriod,
      formatDate(stats.firstBuy), formatDate(stats.lastSell)
    ];

    rows.push(row.map(value => value !== undefined ? formatValue(value) : ""));
  }

  return rows;
}

function formatDate(date?: Date): string {
  return date ? date.toISOString().split('T')[0] : "";
}

function formatValue(value: string | number | undefined): string {
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  return value?.toString() || "";
}
