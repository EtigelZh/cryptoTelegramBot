import { ethers } from 'ethers';
import { smartRound } from './smart-round';

describe('smartRound', () => {
  test('handles integers', () => {
    expect(smartRound(1)).toBe('1');
    expect(smartRound(12)).toBe('12');
  });

  test('handles small fractions', () => {
    expect(smartRound(0.0012)).toBe('0.0012');
    expect(smartRound(0.00123)).toBe('0.00123');
    expect(smartRound(0.123123)).toBe('0.123');
    expect(smartRound(0.562148042210)).toBe('0.562');
    expect(smartRound(0.00012321)).toBe('0.000123');
    expect(smartRound(0.000000000001)).toBe('0.000000000001');
    expect(smartRound(0.000000000001221231)).toBe('0.00000000000122');
    expect(smartRound(0.000000000001255231)).toBe('0.00000000000126');
  });

  test('rounds fractions', () => {
    expect(smartRound(1.1)).toBe('1.1');
    expect(smartRound(1.12)).toBe('1.12');
    expect(smartRound(1.123)).toBe('1.12');
  });

  test('rounds integers with decimals correctly', () => {
    expect(smartRound(12.1)).toBe('12.1');
    expect(smartRound(12.5)).toBe('12.5');
    expect(smartRound(124.123)).toBe('124.12');
    expect(smartRound(124.543)).toBe('124.54');
  });

  test('handles thousands with suffix K', () => {
    expect(smartRound(1234.123)).toBe('1.23K');
    expect(smartRound(12345.123)).toBe('12.35K');
    expect(smartRound(123456.123)).toBe('123.46K');
  });

  test('handles millions with suffix M', () => {
    expect(smartRound(1234567.123)).toBe('1.23M');
    expect(smartRound(12345678.123)).toBe('12.35M');
    expect(smartRound(123456789.123)).toBe('123.46M');
    expect(smartRound(1234567899.123)).toBe('1.23B');
    expect(smartRound(123456789999.123)).toBe('123.46B');
  });

  test('handles millions with suffix M BigNumber', () => {
    expect(smartRound(ethers.BigNumber.from('1234567'))).toBe('1.23M');
    expect(smartRound(ethers.BigNumber.from('12345678'))).toBe('12.35M');
    expect(smartRound(ethers.BigNumber.from('123456789'))).toBe('123.46M');
    expect(smartRound(ethers.BigNumber.from('1234567899'))).toBe('1.23B');
    expect(smartRound(ethers.BigNumber.from('123456789999'))).toBe('123.46B');
  });
  
  test('handles millions with suffix M BigNumber', () => {
    expect(smartRound(1234567n)).toBe('1.23M');
    expect(smartRound(12345678n)).toBe('12.35M');
    expect(smartRound(123456789n)).toBe('123.46M');
    expect(smartRound(1234567899n)).toBe('1.23B');
    expect(smartRound(123456789999n)).toBe('123.46B');
  });
});

