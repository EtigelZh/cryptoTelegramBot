import { ethers } from 'ethers';

export function fullWideNumber(
  number: number | ethers.BigNumber | bigint
): string {
  if (typeof number === 'number') {
    return number.toLocaleString('en', {
      useGrouping: false,
      maximumFractionDigits: 20,
    });
  } else {
    return number.toString();
  }
}

/**
 * 0.123123 -> 0.12
 * 0.00012321 -> 0.00012
 * 0.000000000001251231 -> 0.0000000000013
 */
export function smartRoundSmall(integer: string, fraction: string): string {
  // Round fraction to 2 significant digits
  let result = '0.';
  let index = 0;
  while (fraction[index] === '0') {
    result += '0';
    index++;
  }
  // Берем 2 значимых числа
  let valuable = fraction.slice(index);

  if (valuable.length > 2) {
    valuable = valuable.slice(0, 3);
  }

  const intValuable = parseInt(valuable);

  if (intValuable > 99 && (intValuable) % 10 >= 5) {
    const lastRoundedDigits = Math.round(intValuable / 10);
    result += lastRoundedDigits;
  } else {
    result += valuable.slice(0, 2);
  }
  return result;
}

/**
 * Функция округляет с учетом нулей
 */
export function smartRound(number: number | ethers.BigNumber | bigint): string {
  const [integer, fraction] = fullWideNumber(number).split('.');

  // Handle numbers less than 1
  if (integer === '0' && fraction) {
    return smartRoundSmall(integer, fraction);
  }

  // Handle numbers 1 and greater
  const intNumber = parseInt(integer);
  if (intNumber < 1000) {
    if (fraction) {
      const truncatedFraction = fraction.length > 2 ? fraction.slice(0, 2) : fraction;
      return `${integer}.${truncatedFraction}`;
    }
    return integer;
  }

  const suffixes = ['', 'K', 'M', 'B', 'T'];
  let suffixIndex = 0;
  let value = intNumber;

  while (value >= 1000 && suffixIndex < suffixes.length - 1) {
    value /= 1000;
    suffixIndex++;
  }

  const roundedValue = value.toFixed(2);
  return `${roundedValue.replace(/\.?0+$/, '')}${suffixes[suffixIndex]}`;
}
