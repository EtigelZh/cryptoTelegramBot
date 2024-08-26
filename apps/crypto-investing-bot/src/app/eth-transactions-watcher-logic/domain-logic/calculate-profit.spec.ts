import { DexTransactionEntity } from '../../dex-transactions/dex-transaction.entity';
import { DexTransactionEconomics, DexTransactionType } from './handle-swap';
import { calculateTradeProfit, TradeProfitResult } from './calculate-profit';
import { WalletEntity } from '../../wallet/wallet.entity';

describe('calculateTradeProfit', () => {
  it('should calculate profit, profitUSD, time held, ROI and provide purchase details', () => {
    const sellDate = new Date();
    const sellEconomics: DexTransactionEconomics = {
      action: DexTransactionType.SELL,
      amountToken: 100,
      amountWETH: 5,
      amountUSD: 0,
      tokenSymbol: 'PEPE',
      tokenPerEth: 20,
      tokenPerUsd: 0,
      ethPrice: 2500, // ETH price at the time of sale
      ethPerToken: 0,
      usdPerToken: 0,
      tokenAddress: '0xTokenAddress',
      calculatedAt: sellDate,
      calculatedAtBlockNumber: 12345,
    };

    const purchaseDate1 = new Date(sellDate.getTime() - 1000000); // 1,000,000 milliseconds earlier
    const purchaseDate2 = new Date(sellDate.getTime() - 2000000); // 2,000,000 milliseconds earlier

    const prevTransactions: DexTransactionEntity[] = [
      {
        id: 1,
        computedHash: 'hash1',
        transactionHash: 'txn1',
        blockNumber: 12345,
        wallet: { hash: 'walletHash' } as WalletEntity,
        tokenAddress: '0xTokenAddress',
        action: DexTransactionType.BUY,
        economics: {
          action: DexTransactionType.BUY,
          amountToken: 70,
          amountWETH: 2,
          amountUSD: 0,
          tokenSymbol: 'PEPE',
          tokenPerEth: 35,
          tokenPerUsd: 0,
          ethPrice: 2000, // ETH price at the time of purchase
          ethPerToken: 0,
          usdPerToken: 0,
          tokenAddress: '0xTokenAddress',
          calculatedAt: purchaseDate1,
          calculatedAtBlockNumber: 12345,
        },
        message: { text: 'buy' },
        updatedAt: new Date(),
        createdAt: purchaseDate1,
      },
      {
        id: 2,
        computedHash: 'hash2',
        transactionHash: 'txn2',
        blockNumber: 12346,
        wallet: { hash: 'walletHash' } as WalletEntity,
        tokenAddress: '0xTokenAddress',
        action: DexTransactionType.BUY,
        economics: {
          action: DexTransactionType.BUY,
          amountToken: 50,
          amountWETH: 3,
          amountUSD: 0,
          tokenSymbol: 'PEPE',
          tokenPerEth: 16.67,
          tokenPerUsd: 0,
          ethPrice: 2200, // ETH price at the time of purchase
          ethPerToken: 0,
          usdPerToken: 0,
          tokenAddress: '0xTokenAddress',
          calculatedAt: purchaseDate2,
          calculatedAtBlockNumber: 12346,
        },
        message: { text: 'buy' },
        updatedAt: new Date(),
        createdAt: purchaseDate2,
      },
    ];

    const expected: TradeProfitResult = {
      profit: 5 - (2 + (30 / 50) * 3),
      profitUSD: 5 * 2500 - (2 * 2000 + (30 / 50) * 3 * 2200),
      timeHeld: 2000000, // milliseconds
      roi:
        ((5 * 2500 - (2 * 2000 + (30 / 50) * 3 * 2200)) /
          (2 * 2000 + (30 / 50) * 3 * 2200)) *
        100,
      details: [
        {
          tokenAddress: '0xTokenAddress',
          tokenSymbol: 'PEPE',
          tokensBought: 70,
          ethSpent: 2,
          purchaseDate: purchaseDate1,
          ethUsdPrice: 2000,
        },
        {
          tokenAddress: '0xTokenAddress',
          tokenSymbol: 'PEPE',
          tokensBought: 30,
          ethSpent: (30 / 50) * 3,
          purchaseDate: purchaseDate2,
          ethUsdPrice: 2200,
        },
      ],
    };

    const result = calculateTradeProfit(sellEconomics, prevTransactions);
    expect(result).toEqual(expected);
  });

  it('should return NO_DATA if sales cannot be covered by purchases', () => {
    const sellDate = new Date();
    const sellEconomics: DexTransactionEconomics = {
      action: DexTransactionType.SELL,
      amountToken: 200,
      amountWETH: 5,
      amountUSD: 0,
      tokenSymbol: 'TEST',
      tokenPerEth: 20,
      tokenPerUsd: 0,
      ethPrice: 2500,
      ethPerToken: 0,
      usdPerToken: 0,
      tokenAddress: '0xTokenAddress',
      calculatedAt: sellDate,
      calculatedAtBlockNumber: 12345,
    };

    const purchaseDate1 = new Date(sellDate.getTime() - 1000000); // 1,000,000 milliseconds earlier

    const prevTransactions: DexTransactionEntity[] = [
      {
        id: 1,
        computedHash: 'hash1',
        transactionHash: 'txn1',
        blockNumber: 12345,
        wallet: { hash: 'walletHash' } as WalletEntity,
        tokenAddress: '0xTokenAddress',
        action: DexTransactionType.BUY,
        economics: {
          action: DexTransactionType.BUY,
          amountToken: 70,
          amountWETH: 2,
          amountUSD: 0,
          tokenSymbol: 'TEST',
          tokenPerEth: 35,
          tokenPerUsd: 0,
          ethPrice: 2000,
          ethPerToken: 0,
          usdPerToken: 0,
          tokenAddress: '0xTokenAddress',
          calculatedAt: purchaseDate1,
          calculatedAtBlockNumber: 12345,
        },
        message: { text: 'buy' },
        updatedAt: new Date(),
        createdAt: purchaseDate1,
      },
    ];

    const expected: TradeProfitResult = {
      profit: 'NO_DATA',
      profitUSD: 'NO_DATA',
      timeHeld: 'NO_DATA',
      roi: 'NO_DATA',
      details: [],
    };

    const result = calculateTradeProfit(sellEconomics, prevTransactions);
    expect(result).toEqual(expected);
  });

  it('should return NO_DATA if the current transaction is not a sale', () => {
    const buyDate = new Date();
    const buyEconomics: DexTransactionEconomics = {
      action: DexTransactionType.BUY,
      amountToken: 100,
      amountWETH: 5,
      amountUSD: 0,
      tokenSymbol: 'TEST',
      tokenPerEth: 20,
      tokenPerUsd: 0,
      ethPrice: 2500,
      ethPerToken: 0,
      usdPerToken: 0,
      tokenAddress: '0xTokenAddress',
      calculatedAt: buyDate,
      calculatedAtBlockNumber: 12345,
    };

    const purchaseDate1 = new Date(buyDate.getTime() - 1000000); // 1,000,000 milliseconds earlier

    const prevTransactions: DexTransactionEntity[] = [
      {
        id: 1,
        computedHash: 'hash1',
        transactionHash: 'txn1',
        blockNumber: 12345,
        wallet: { hash: 'walletHash' } as WalletEntity,
        tokenAddress: '0xTokenAddress',
        action: DexTransactionType.BUY,
        economics: {
          action: DexTransactionType.BUY,
          amountToken: 70,
          amountWETH: 2,
          amountUSD: 0,
          tokenSymbol: 'TEST',
          tokenPerEth: 35,
          tokenPerUsd: 0,
          ethPrice: 2000,
          ethPerToken: 0,
          usdPerToken: 0,
          tokenAddress: '0xTokenAddress',
          calculatedAt: purchaseDate1,
          calculatedAtBlockNumber: 12345,
        },
        message: { text: 'buy' },
        updatedAt: new Date(),
        createdAt: purchaseDate1,
      },
    ];

    const expected: TradeProfitResult = {
      profit: 'NO_DATA',
      profitUSD: 'NO_DATA',
      timeHeld: 'NO_DATA',
      roi: 'NO_DATA',
      details: [],
    };

    const result = calculateTradeProfit(buyEconomics, prevTransactions);
    expect(result).toEqual(expected);
  });
});
