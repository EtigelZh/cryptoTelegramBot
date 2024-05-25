import { EthTransaction } from '../etherscan-api/etherscan-api.models';
import { DexTransaction } from './models';

export interface SlipItem {
  percent: number;  // Процент изменения относительно первой транзакции
  dt: Date;  // Дата и время транзакции
}

export interface SlippageResult {
  slip0: SlipItem;
  slip1: SlipItem;
  slip2: SlipItem;
}

/**
 * Рассчитывает скользящие изменения между первой транзакцией
 * и трёмя заданными последующими транзакциями.
 */
export function calcSlippage(list: DexTransaction[]): SlippageResult | undefined {
  if (!Array.isArray(list)) {
    console.error('[calcSlippage] Invalid input: Expected an array');
    return;
  }

  const firstPrice = Number(list[0]?.weiTokenPrice);

  if (isNaN(firstPrice) || firstPrice === 0) {
    console.error('[calcSlippage] Error parsing first transaction value.');
    return;
  }

  const createSlipItem = (transaction: DexTransaction): SlipItem => ({
    percent: (Number(transaction.weiTokenPrice) - firstPrice) / firstPrice * 100,
    dt: new Date(+transaction.timeStamp * 1000),
  });

  return {
    slip0: createSlipItem(list[1]),
    slip1: createSlipItem(list[3] || list[1]),
    slip2: createSlipItem(list[5] || list[3] || list[1])
  };
}
