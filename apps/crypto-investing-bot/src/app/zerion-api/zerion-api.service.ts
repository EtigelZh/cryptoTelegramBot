import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../app.config';
import axios from 'axios';
import { WithSentryPerformance } from '../utils/sentry-performance';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { createMD5Hash } from '../utils/hash';
import { captureException } from '@sentry/node';
import { CsvProcessingResponse, FungiblePosition, GetTransactionsArguments, Transaction, ZerionApiQueueName, ZerionResponse } from './zerion-api.models';
import { RedisStore } from 'cache-manager-redis-store';
import { ApiKeyAndLimitWithUsage, ZERION_MANUAL_API_KEYS, ZERION_UPDATING_API_KEYS, getTokenKey } from './zerion-api-key-day-limiter';

function createFromUserPass(user: string, pass: string): string {
  return Buffer.from(`${user}:${pass}`).toString('base64');
}

@Injectable()
export class ZerionApiService {
  constructor(
    private readonly config: AppConfig,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(ZERION_MANUAL_API_KEYS) private _manualApiKeys: ApiKeyAndLimitWithUsage[],
    @Inject(ZERION_UPDATING_API_KEYS) private _updatingApiKeys: ApiKeyAndLimitWithUsage[],
  ) {
    console.log(this._manualApiKeys, this._updatingApiKeys);
  }

  getEstimateAvailableProcessingWallets(): number {
    return Math.floor(this._updatingApiKeys.reduce((acc, key) => acc + (key.limit - key.used), 0) / 10);
  }

  getRequestLimits(apiKeyQueueName: ZerionApiQueueName) {
    switch (apiKeyQueueName) {
      case 'updating':
        return this._getRequestLimitsSummary(this._updatingApiKeys);
      default:
      case 'manual':
        return this._getRequestLimitsSummary(this._manualApiKeys);
    }
  }

  private _getRequestLimitsSummary(apiKeys: ApiKeyAndLimitWithUsage[]) {
    return apiKeys.reduce((acc, token) => ({used: acc.used + token.used, limit: acc.limit + token.limit}), {used: 0, limit: 0});
  }

  getRedisClient() {
    return (this.cacheManager.store as unknown as RedisStore).getClient();
  }

  @WithSentryPerformance('Get CSV transactions')
  async getCsvTransactions(
    transactions: ZerionResponse['data']
  ): Promise<CsvProcessingResponse> {
    try {
      const csvData = this._convertTransactionJsonToCsv(transactions);
      return csvData;
    } catch (error) {
      console.error(error);
      throw new Error('Failed to convert transactions to CSV');
    }
  }

  @WithSentryPerformance('Get transactions')
  async getTransactions<T = Transaction>(
    options: GetTransactionsArguments<T>
  ): Promise<ZerionResponse<T>> {
    const {
      walletHash,
      onNextRequest = () => Promise.resolve(),
      apiKeyQueueName,
      take = 0,
      urlTemplate = (
        walletHash,
        perPage
      ) =>
        `https://api.zerion.io/v1/wallets/${walletHash}/transactions/?currency=usd&page[size]=${perPage}&filter[trash]=only_non_trash`,
      getNextChunk = this.fetchTransactionsChunk
    } = options;

    const perPage = Math.min(take || 100, 100);

    let allTransactions: T[] = [];
    let url = urlTemplate(walletHash, perPage);

    try {
      while (url) {
        let zerionResponse: ZerionResponse<T> = null;
        let cacheHits = 0;
        const urlCacheKey = createMD5Hash(url);
        try {
          const zerionResponseRaw = await this.cacheManager.get(urlCacheKey);
          if (typeof zerionResponseRaw === 'string') {
            zerionResponse = JSON.parse(zerionResponseRaw as string);
          } else {
            zerionResponse = zerionResponseRaw as ZerionResponse<T>;
          }
        } catch (e) {
          Logger.error(`Failed to parse cache key ${e}`);
        }

        if (!zerionResponse) {
          zerionResponse = await getNextChunk(url, apiKeyQueueName);
          if (zerionResponse.error) {
            throw new Error('Failed to fetch transactions');
          }
          // this.cacheManager.set(urlCacheKey, zerionResponse, ONE_DAY);
        } else {
          cacheHits++;
        }
        allTransactions = allTransactions.concat(zerionResponse.data as T[]);

        await onNextRequest(
          cacheHits,
          allTransactions
        );
        // Check if there's a next page
        url = zerionResponse.links.next ? zerionResponse.links.next : '';

        if (take && allTransactions.length >= take) {
          break;
        }
      }

      return {
        links: {
          self: '', // You might want to handle the 'self' link appropriately
          next: '',
        },
        data: allTransactions,
      };
    } catch (error) {
      console.error(error);
      return {
        links: {
          self: '', // You might want to handle the 'self' link appropriately
          next: '',
        },
        error,
        data: allTransactions,
      };
    }
  }

  async fetchTransactionsChunk<T>(url: string, apiKeyQueueName: ZerionApiQueueName): Promise<ZerionResponse<T>> {
    const apiKey = await this._getKeyForQueue(apiKeyQueueName);
    if (!apiKey) {
      throw new Error('Дневной лимит запросов исчерпан');
    }
    const authHeader = createFromUserPass(apiKey.token, '');
    
    const options = {
      headers: {
        accept: 'application/json',
        authorization: `Basic ${authHeader}`,
      },
    };
    const response = await axios.get<ZerionResponse<T>>(url, options);
    await this.getRedisClient().incr(getTokenKey(apiKey.token));
    const cachedValue = await this.cacheManager.get(getTokenKey(apiKey.token));
    apiKey.used = +(cachedValue || 0);
    console.log(cachedValue, apiKey.used, apiKey.limit, apiKey.token, getTokenKey(apiKey.token));
    return response.data;
  }

  private async _getKeyForQueue(apiKeyQueueName: ZerionApiQueueName): Promise<ApiKeyAndLimitWithUsage | undefined> {
    switch (apiKeyQueueName) {
      case 'updating':
        return this._updatingApiKeys.find((key) => key.used < key.limit);
      default:
      case 'manual':
        return this._manualApiKeys.find((key) => key.used < key.limit);
    }
  }

  private _convertTransactionJsonToCsv(data: ZerionResponse['data']): CsvProcessingResponse {
    const header = [
      'Date',
      'Time',
      'Transaction Type',
      'Status',
      'Chain',
      'Buy Amount',
      'Buy Currency',
      'Buy Currency Address',
      'Buy Fiat Amount',
      'Buy Fiat Currency',
      'Sell Amount',
      'Sell Currency',
      'Sell Currency Address',
      'Sell Fiat Amount',
      'Sell Fiat Currency',
      'Fee Amount',
      'Fee Currency',
      'Fee Fiat Amount',
      'Fee Fiat Currency',
      'Tx Hash',
      'Link',
      'Timestamp',
      'Incoming Transfers JSON',
      'Outgoing Transfers JSON',
    ];
    const errors = [];
    const transactions = data.map((transaction, rowIndex) => {
      try {
        const attributes = transaction.attributes;
        const chain = transaction.relationships.chain.data.id;
  
        const date = new Date(attributes.mined_at).toLocaleDateString();
        const time = new Date(attributes.mined_at).toLocaleTimeString();
        const transactionType = attributes.operation_type;
        const status = attributes.status;
        const txHash = attributes.hash;
        const link = `https://etherscan.io/tx/${txHash}`;
  
        const fee = attributes.fee;
        const feeCurrency = fee.fungible_info?.symbol ?? ''; // Default value if fungible_info is not available
        const feeAmount = fee.quantity.float;
        const feeFiatAmount = fee.value ?? ''; // Default value if fee value is null
  
        const transfers = attributes.transfers.map((transfer) => {
          return {
            amount: transfer.quantity.float,
            currency: transfer.fungible_info?.symbol ?? '', // Default value if fungible_info is not available
            address:
              transfer.fungible_info?.implementations.find(
                (impl) => impl.chain_id === chain
              )?.address ?? '', // Default value if address is not available
            fiatAmount: transfer.value ?? '', // Default value if transfer value is null
            direction: transfer.direction,
            sender: transfer.sender,
            recipient: transfer.recipient,
          };
        });
  
        // Assuming the first transfer is 'in' and the second is 'out'
        const buyTransfer = transfers.find((t) => t.direction === 'in');
        // sell transfers 
        const sellTransfers = transfers.filter((t) => t.direction === 'out');
        const sellCurrencies = new Set(sellTransfers.map((t) => t.currency));
        if (sellCurrencies.size > 1) {
          captureException(`Multiple sell currencies in a single transaction ${txHash}`)
        }
        const sellTransfer = sellTransfers.reduce((acc, transaction) => ({
          amount: acc.amount + transaction.amount,
          currency: transaction.currency,
          address: transaction.address,
          fiatAmount: acc.fiatAmount + +(transaction?.fiatAmount || 0),
        }), {amount: 0, currency: '', address: '', fiatAmount: 0});
  
  
        return [
          date,
          time,
          transactionType,
          status,
          chain,
          buyTransfer?.amount ?? '',
          buyTransfer?.currency ?? '',
          buyTransfer?.address ?? '',
          buyTransfer?.fiatAmount ?? '',
          'USD', // Assuming USD as fiat currency for simplicity
          sellTransfer?.amount ?? '',
          sellTransfer?.currency ?? '',
          sellTransfer?.address ?? '',
          sellTransfer?.fiatAmount ?? '',
          'USD', // Assuming USD as fiat currency for simplicity
          feeAmount,
          feeCurrency,
          feeFiatAmount ?? '',
          'USD', // Assuming USD as fiat currency for simplicity
          txHash,
          link,
          attributes.mined_at,
          '',
          '',
        ] as string[];
      } catch (error) {
        console.error('Failed to process transaction', transaction, error);
        errors.push({ rowIndex, message: error.message });
        return []; // Return an empty string for transactions that fail to process
      }
    });
  
    return {
      data: [header, ...transactions],
      errors,
    };
  }

  convertFungiblePositionsToCsvEntries(
    positions: FungiblePosition[]
  ): string[][] {
    const csvRows: string[][] = [
      //['Type','ID','Name','Position Type','Quantity Numeric','Value','Price','Absolute Change 1D','Percent Change 1D','Fungible Info Name','Fungible Info Symbol','Updated At']
    ];
  
    positions.forEach((position) => {
      const {
        type,
        id,
        attributes: {
          name,
          position_type,
          quantity,
          value,
          price,
          changes,
          fungible_info,
          updated_at,
        } = {},
      } = position;
  
      const csvRow = [
        type,
        id,
        name,
        position_type,
        quantity?.numeric,
        value,
        price,
        changes?.absolute_1d,
        changes?.percent_1d,
        fungible_info?.name,
        fungible_info?.symbol,
        updated_at,
      ] as string[];
  
      csvRows.push(csvRow);
    });
  
    return csvRows;
  }
}
