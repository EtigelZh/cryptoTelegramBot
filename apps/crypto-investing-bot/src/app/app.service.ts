import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import axios from 'axios';
import { AppConfig } from './app.config';

export type TransactionData = {
  Date: string;
  Time: string;
  TransactionType: string;
  Status: string;
  Chain: string;
  BuyAmount: string;
  BuyCurrency: string;
  BuyCurrencyAddress: string;
  BuyFiatAmount: string;
  BuyFiatCurrency: string;
  SellAmount: string;
  SellCurrency: string;
  SellCurrencyAddress: string;
  SellFiatAmount: string;
  SellFiatCurrency: string;
  FeeAmount: string;
  FeeCurrency: string;
  FeeFiatAmount: string;
  FeeFiatCurrency: string;
  TxHash: string;
  Link: string;
  Timestamp: string;
  IncomingTransfersJSON: string;
  OutgoingTransfersJSON: string;
};

type EthTransaction = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
};

type TokenTransaction = EthTransaction & {
  tokenDecimal: string;
  tokenName: string;
  tokenSymbol: string;
};

type EnrichedTransaction = (Partial<EthTransaction> & Partial<TokenTransaction>) & { isTokenTx?: boolean; };

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly ETHERSCAN_API_URL = 'https://api.etherscan.io/api';
  private readonly COINMARKETCAP_API_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';

  constructor(
    private appConfig: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    console.log('onApplicationBootstrap');
    // Initialization logic can be added here
  }

  async getWalletTransactions(walletAddress: string) {
    try {
      const ethTransactions = await this.fetchTransactions<EthTransaction>(walletAddress, 'txlist');
      const tokenTransactions = await this.fetchTransactions<TokenTransaction>(walletAddress, 'tokentx');
      const hashesSet = new Set<string>();
      ethTransactions.forEach(tx => hashesSet.add(tx.hash));
      tokenTransactions.forEach(tx => hashesSet.add(tx.hash));
      const ethTransactionsMap = new Map<string, EthTransaction>(ethTransactions.map(tx => [tx.hash, tx]));
      const tokenTransactionsMap = new Map<string, TokenTransaction>(tokenTransactions.map(tx => [tx.hash, tx]));

      const transactionsEntries = Array.from(hashesSet.values()).map(hash => {
        const ethTx = ethTransactionsMap.get(hash);
        const tokenTx = tokenTransactionsMap.get(hash);
        return { hash, ethTx, tokenTx, transactionData: this.transformToTransactionData({ ...ethTx, ...tokenTx })};
      });

      return transactionsEntries.filter(tx => tx.hash === '0x9b7a6fb69069055f1d72b2d989e5454814799bad342a47e3153da8ef430a4903');
    } catch (error) {
      console.error('Error fetching wallet transactions:', error);
      return [];
    }
  }

  convertTransactionsToCSV(transactions: TransactionData[]): string {
    const headers = Object.keys(transactions[0]).join(',');
    const rows = transactions.map(tx => {
      return Object.values(tx).map(value => 
        `"${value.toString().replace(/"/g, '""')}"` // Escaping double quotes in data
      ).join(',');
    });

    return [headers, ...rows].join('\r\n');
  }

  private mergeTransactions(ethTransactions: EthTransaction[], tokenTransactions: TokenTransaction[]): Map<string, EnrichedTransaction> {
    const transactionsMap = new Map<string, EnrichedTransaction>();

    ethTransactions.forEach(tx => {
      transactionsMap.set(tx.hash, {...tx, isTokenTx: false});
    });

    tokenTransactions.forEach(tx => {
      const existingTx = transactionsMap.get(tx.hash) as EthTransaction;
      transactionsMap.set(tx.hash, { ...existingTx, ...tx, isTokenTx: true });
    });

    return transactionsMap;
  }

  private async fetchTransactions<T>(walletAddress: string, action: string): Promise<T[]> {
    const response = await axios.get(`${this.ETHERSCAN_API_URL}`, {
      params: {
        module: 'account',
        action: action,
        address: walletAddress,
        startblock: 0,
        endblock: 99999999,
        sort: 'desc',
        apikey: this.appConfig.etherscanApiKey
      }
    });
    if (response.data.status !== "1") {
      throw new Error(response.data.message);
    }
    return response.data.result;
  }

  private transformToTransactionData(tx: EnrichedTransaction): TransactionData {
    const date = new Date(+(tx?.timeStamp || 0) * 1000);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');

    const dateString = `${month}/${day}/${year}`;
    const timeString = `${hours}:${minutes}`;

    const isTokenTransaction = tx.isTokenTx;
    const buyAmount = isTokenTransaction ? this.convertTokenValue(tx.value || '0', parseInt(tx.tokenDecimal || '0')) : tx.value;
    const buyCurrency = isTokenTransaction ? tx.tokenSymbol : 'ETH';
    const fee = !isTokenTransaction ? (parseInt(tx.gasUsed || '0') * parseInt(tx.gasPrice || '0')).toString() : '0';
  
    return {
      Date: dateString,
      Time: timeString,
      TransactionType: isTokenTransaction ? 'token' : 'standard',
      Status: tx.isError === '0' ? 'Success' : 'Error',
      Chain: 'Ethereum',
      BuyAmount: buyAmount || '0',
      BuyCurrency: buyCurrency || 'ETH',
      BuyCurrencyAddress: tx.contractAddress || '',
      BuyFiatAmount: '',
      BuyFiatCurrency: '',
      SellAmount: '',
      SellCurrency: '',
      SellCurrencyAddress: '',
      SellFiatAmount: '',
      SellFiatCurrency: '',
      FeeAmount: fee,
      FeeCurrency: 'ETH',
      FeeFiatAmount: '',
      FeeFiatCurrency: '',
      TxHash: tx.hash || '',
      Link: `https://etherscan.io/tx/${tx.hash}`,
      Timestamp: date.toISOString(),
      IncomingTransfersJSON: '',
      OutgoingTransfersJSON: JSON.stringify(tx)
    };
  }

  private convertTokenValue(value: string, decimals: number): string {
    return (BigInt(value) / BigInt(Math.pow(10, decimals))).toString();
  }

  private async enrichTransactionsWithMarketData(transactions: TransactionData[], currency = 'USD'): Promise<TransactionData[]> {
    try {
      const ids = transactions.filter(tx => tx.BuyCurrency !== 'ETH').map(tx => tx.BuyCurrency).join(',');
      const response = await axios.get(`${this.COINMARKETCAP_API_URL}`, {
        params: {
          symbol: ids,
          convert: currency
        },
        headers: {
          'X-CMC_PRO_API_KEY': this.appConfig.coinmarketCupApiKey
        }
      });
      const marketData = response.data.data;
      return transactions.map(tx => ({
        ...tx,
        BuyFiatAmount: marketData[tx.BuyCurrency]?.quote[currency]?.price
      }));
    } catch (error) {
      console.error('Error enriching transactions with market data:', error);
      return transactions;
    }
  }

  getData(): { message: string } {
    return { message: 'Welcome to crypto-investing-bot-api!' };
  }
}
