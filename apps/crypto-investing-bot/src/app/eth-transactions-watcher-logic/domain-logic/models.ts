import type { ethers } from 'ethers';

export type Log = {
  topics: Array<string>;
  data: string;
  transactionHash: string;
  blockNumber: number;
  removed: boolean;
  logIndex: number;
  address: string;
  parsedLog?: ethers.utils.LogDescription;
};
export type Fungible = {
  name: string;
  symbol: string;
  contractAddress: string;
  decimals: number,
};
export type BlockCacheEntry = {
  blockNumber: number;
  transactions: ethers.providers.TransactionResponse[];
  swaps?: Log[];
  transfers?: Log[];
};
