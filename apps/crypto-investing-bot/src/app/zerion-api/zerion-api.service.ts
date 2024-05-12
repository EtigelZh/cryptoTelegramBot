import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../app.config';
import axios from 'axios';
import { WithSentryPerformance } from '../utils/sentry-performance';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { createMD5Hash } from '../utils/hash';
import { captureException } from '@sentry/node';
import {
  CsvProcessingResponse,
  FungiblePosition,
  GetTransactionsArguments,
  ZerionApiQueueName,
  ZerionResponse,
  ZerionTransaction
} from './zerion-api.models';
import { RedisStore } from 'cache-manager-redis-store';
import {
  ApiKeyAndLimitWithUsage,
  getTokenKey,
  ZERION_MANUAL_API_KEYS,
  ZERION_UPDATING_API_KEYS
} from './zerion-api-key-day-limiter';
import { TransactionService } from '../transaction/transaction.service';
import { WalletService } from '../wallet/wallet.service';
import { WalletEntity, WalletStatus } from '../wallet/wallet.entity';
import { Cron } from '@nestjs/schedule';
import { ZerionApiLimitReachedError } from '../error-handling/custom-errors';

function createFromUserPass(user: string, pass: string): string {
  return Buffer.from(`${user}:${pass}`).toString('base64');
}
const transactionsUrlTemplate = (
  walletHash,
  perPage,
  lastTransactionDateTimestamp?: number
) =>
  `https://api.zerion.io/v1/wallets/${walletHash}/transactions/?currency=usd&page[size]=${perPage}&filter[chain_ids]=ethereum&filter[trash]=only_non_trash${lastTransactionDateTimestamp ? `&filter[min_mined_at]=${lastTransactionDateTimestamp}` : ''}`;
@Injectable()
export class ZerionApiService {
  constructor(
    private readonly config: AppConfig,
    @Inject(CACHE_MANAGER) private readonly _cacheManager: Cache,
    @Inject(ZERION_MANUAL_API_KEYS) private readonly _manualApiKeys: ApiKeyAndLimitWithUsage[],
    @Inject(ZERION_UPDATING_API_KEYS) private readonly _updatingApiKeys: ApiKeyAndLimitWithUsage[],
    private _walletService: WalletService,
    private _transactionService: TransactionService,
  ) {
    console.log(this._manualApiKeys, this._updatingApiKeys);
  }

  getEstimateAvailableProcessingWallets(): number {
    return Math.floor(this._updatingApiKeys.reduce((acc, key) => acc + (key.limit - key.used), 0) / 20);
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
    return (this._cacheManager.store as unknown as RedisStore).getClient();
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
  async getTransactions<T = ZerionTransaction>(
    options: GetTransactionsArguments<T>
  ): Promise<ZerionResponse<T>> {
    const {
      walletHash,
      onNextRequest = () => Promise.resolve(),
      apiKeyQueueName,
      take = 0,
      urlTemplate = transactionsUrlTemplate,
      getNextChunk = this.fetchTransactionsChunk
    } = options;
    const isTransactionsRequest = urlTemplate === transactionsUrlTemplate;
    const perPage = Math.min(take || 100, 100);

    let walletEntity: WalletEntity | null = null;
    try {
      walletEntity = await this._walletService.getWallet(walletHash);
      Logger.log(`Wallet status ${walletEntity?.status}`)
    } catch (e) {
      Logger.error(e);
      captureException(e, { tags: { source: 'getTransactions', target: 'savingToDbWalletStatistics' } })
    }

    let allTransactions: T[] = [];
    let url = urlTemplate(walletHash, perPage,  +(walletEntity?.lastTransactionDate || 0));

    try {
      while (url) {
        let zerionResponse: ZerionResponse<T> = null;
        let cacheHits = 0;

        // TODO вынести получение транзакций и fungible_positions в отдельные методы
        const urlCacheKey = createMD5Hash(url);
        if (!isTransactionsRequest) {
          try {
            const zerionResponseRaw = await this._cacheManager.get(urlCacheKey);
            if (typeof zerionResponseRaw === 'string') {
              zerionResponse = JSON.parse(zerionResponseRaw as string);
            } else {
              zerionResponse = zerionResponseRaw as ZerionResponse<T>;
            }
          } catch (e) {
            Logger.error(`Failed to parse cache key ${e}`);
          }
        }

        if (!zerionResponse) {
          zerionResponse = await getNextChunk(url, apiKeyQueueName);
          if (zerionResponse.error) {
            throw new Error('Failed to fetch transactions');
          }
          if (!isTransactionsRequest) {
            this._cacheManager.set(urlCacheKey, zerionResponse, this.config.cacheTTL);
          } else {
            try {
              this._transactionService.createNotExistZerionTransactions(zerionResponse.data as ZerionTransaction[]).catch(e => Logger.error(e));
            } catch (e) {
              Logger.error(e);
            }
          }
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
      if (this._walletIsNotEmpty(walletEntity) && isTransactionsRequest) {
        try {
          if (walletEntity.status === WalletStatus.NEW && allTransactions.length > 0 ) {
            const firstTransaction = allTransactions[allTransactions.length - 1]  as ZerionTransaction;
            walletEntity.firstTransactionDate = new Date(firstTransaction.attributes.mined_at);
            walletEntity.status = WalletStatus.ACTIVE;
          } else {
            // Дополняем ответ сохраненными в базе транзакциями
            const savedInDbOldTransactions = await this._transactionService.getTransactionsByWallet(walletHash, walletEntity.lastTransactionDate);
            allTransactions.push(...savedInDbOldTransactions.map(t => t.zerionSource as T));
          }

          if (allTransactions.length > 0) {
            // Обновляем дату последней транзакции
            const lastTransaction = allTransactions[0] as ZerionTransaction;
            walletEntity.lastTransactionDate = new Date(lastTransaction.attributes.mined_at);
            await this._walletService.saveWallet(walletEntity);
          }
        } catch (e) {
          Logger.error(e);
          captureException(e, { tags: { source: 'getTransactions', target: 'savingToDbWalletStatistics' } });
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

  // async getReceiveTransactions(walletHash: string, startingDateTimestamp: number): Promise<ZerionTransaction[]> {
  //   transactionsUrlTemplate(walletHash, 100, startingDateTimestamp);
  // }

  /** каждый час синхронизируем использование токенов */
  @Cron('0 * * * *')
  async updateKeysUsage() {
    for (const apiKey of this._manualApiKeys) {
      const cachedValue = await this._cacheManager.get(getTokenKey(apiKey.token));
      apiKey.used = +(cachedValue || 0);
    }

    for (const apiKey of this._updatingApiKeys) {
      const cachedValue = await this._cacheManager.get(getTokenKey(apiKey.token));
      apiKey.used = +(cachedValue || 0);
    }
  }
  async fetchTransactionsChunk<T>(url: string, apiKeyQueueName: ZerionApiQueueName): Promise<ZerionResponse<T>> {
    const apiKey = await this._getKeyForQueue(apiKeyQueueName);
    if (!apiKey) {
      throw new ZerionApiLimitReachedError('Дневной лимит запросов исчерпан');
    }
    const authHeader = createFromUserPass(apiKey.token, '');

    const options = {
      headers: {
        accept: 'application/json',
        authorization: `Basic ${authHeader}`,
      },
    };
    const response = await axios.get<ZerionResponse<T>>(url, options);
    const tokenRedisKey = getTokenKey(apiKey.token);
    await this.getRedisClient().incr(tokenRedisKey);
    const cachedValue = await this._cacheManager.get(tokenRedisKey);
    apiKey.used = +(cachedValue || 0);
    console.log(cachedValue, apiKey.used, apiKey.limit, apiKey.token, tokenRedisKey);
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

  private _walletIsNotEmpty(wallet: WalletEntity | null): wallet is WalletEntity {
    return wallet !== null && !!wallet;
  }
}
