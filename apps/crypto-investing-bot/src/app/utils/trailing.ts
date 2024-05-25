import { DexTransaction } from './models';

export interface TrailingResult {
  /**
   * Расчет Trailing при slippage = 0%
   */
  trail0: boolean;
  /**
   * Расчет Trailing при slippage = 2,5%
   */
  trail2_5: boolean;
  /**
   * Расчет Trailing при slippage = 5%
   */
  trail5: boolean;
}

export function calcTrailing(
  list: DexTransaction[],
  startHash: string,
  endHash: string
): TrailingResult | undefined {
  if (!Array.isArray(list)) {
    console.error('[calcTrailing] Invalid input: Expected an array');
    return;
  }

  const firstTransaction = list.find((item) => item.transactionHash === startHash);

  const firstPrice = Number(firstTransaction?.weiTokenPrice);

  if (isNaN(firstPrice) || firstPrice === 0) {
    console.error('[calcTrailing] Error parsing first transaction value.');
    return;
  }

  const calcTrailItem = (slippage: number): boolean => {
    for (let i = 0; i < list.length; i++) {
      const { weiTokenPrice, transactionHash } = list[i];
      if (firstPrice < Number(weiTokenPrice) * slippage) {
        return true;
      }
      if (transactionHash === endHash) {
        return false;
      }
    }

    return false;
  };

  return {
    trail0: calcTrailItem(1),
    trail2_5: calcTrailItem(1.025),
    trail5: calcTrailItem(1.05)
  };
}
