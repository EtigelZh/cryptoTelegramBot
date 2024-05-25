import { DexTransaction } from './models';

export interface TrailingResult {
  /**
   * Расчет Trailing при slippage = 0%
   */
  slip0: boolean;
  /**
   * Расчет Trailing при slippage = 2,5%
   */
  slip2_5: boolean;
  /**
   * Расчет Trailing при slippage = 5%
   */
  slip5: boolean;
}

/**
 * TODO Добавить остановку на продажу
 * @param list
 */
export function calcTrailing(list: DexTransaction[]): TrailingResult | undefined {
  if (!Array.isArray(list)) {
    console.error('[calcTrailing] Invalid input: Expected an array');
    return;
  }

  const firstPrice = Number(list[0]?.weiTokenPrice);

  if (isNaN(firstPrice) || firstPrice === 0) {
    console.error('[calcTrailing] Error parsing first transaction value.');
    return;
  }

  const createSlipItem = (slippage: number): boolean => {
    for (let i = 0; i < list.length ; i++) {
      const { weiTokenPrice } = list[i];
      if (firstPrice > Number(weiTokenPrice) * slippage) {
        return true;
      }
    }

    return false;
  };

  return {
    slip0: createSlipItem(1),
    slip2_5: createSlipItem(1.025),
    slip5: createSlipItem(1.05)
  };
}
