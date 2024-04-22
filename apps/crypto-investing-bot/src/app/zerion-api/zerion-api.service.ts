import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AppConfig } from '../app.config';
import axios, { AxiosError } from 'axios';
import { WithSentryPerformance } from '../utils/sentry-performance';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { createMD5Hash } from '../utils/hash';
import { captureException } from '@sentry/node';

const ONE_DAY = 24 * 60 * 60 * 1000;
export type RequestErrorData = {
  errors: string[];
};

export type RowError = { message: string; rowIndex: number };

export type ResponseWithErrorList<
  T = unknown,
  E extends RowError = RowError
> = {
  errors: E[];
  data: T;
};

export type CsvProcessingResponse = ResponseWithErrorList<string[][]>;

type ZerionResponse<T = Transaction> = {
  links: {
    self: string;
    next: string;
  };
  error?: AxiosError<RequestErrorData>;
  data: T[];
};

type Transaction = {
  type: string;
  id: string;
  attributes: TransactionAttributes;
  relationships: {
    chain: ChainRelationship;
  };
};

type TransactionAttributes = {
  operation_type: string;
  hash: string;
  mined_at_block: number;
  mined_at: string;
  sent_from: string;
  sent_to: string;
  status: string;
  nonce: number;
  fee: Fee;
  transfers: Transfer[];
  approvals: Approval[];
  application_metadata: ApplicationMetadata;
  flags: {
    is_trash: boolean;
  };
};

type Fee = {
  fungible_info: FungibleInfo;
  quantity: Quantity;
  price: number | null;
  value: number | null;
};

type Transfer = {
  fungible_info: FungibleInfo;
  direction: string;
  quantity: Quantity;
  value: number | null;
  price: number | null;
  sender: string;
  recipient: string;
};

type Icon = {
  url: string;
};

type Implementation = {
  chain_id: string;
  address: string;
  decimals: number;
};

type Approval = {
  // Define the structure for approvals if needed
};

type ApplicationMetadata = {
  name: string;
  icon: Icon;
  contract_address: string;
};

type ChainRelationship = {
  links: {
    related: string;
  };
  data: {
    type: string;
    id: string;
  };
};

type Quantity = {
  int: string;
  decimals: number;
  float: number;
  numeric: string;
};

type Changes = {
  absolute_1d: number;
  percent_1d: number;
};

type FungibleInfo = {
  name: string;
  symbol: string;
  icon: Icon | null;
  flags: {
    verified: boolean;
  };
  implementations: Implementation[];
};

type PositionAttributes = {
  parent: null | string;
  protocol: null | string;
  name: string;
  position_type: string;
  quantity: Quantity;
  value: number;
  price: number;
  changes: Changes;
  fungible_info: FungibleInfo;
  flags: {
    displayable: boolean;
    is_trash: boolean;
  };
  updated_at: string;
  updated_at_block: number;
};

type FungiblePosition = {
  type: string;
  id: string;
  attributes: PositionAttributes;
  relationships: {
    chain: ChainRelationship;
  };
};

function convertFungiblePositionsToCsvEntries(
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

function convertJsonToCsv(data: ZerionResponse['data']): CsvProcessingResponse {
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

function createFromUserPass(user: string, pass: string): string {
  return Buffer.from(`${user}:${pass}`).toString('base64');
}

@Injectable()
export class ZerionApiService implements OnModuleDestroy {
  private currentThrottlerPromise: {auto: Promise<void>, manual: Promise<void>} = {auto: Promise.resolve(), manual: Promise.resolve()}
  private currentThrottlerResolver: (args: unknown) => void;
  
  
  readonly maxRequestsPerMinute = 55;
  private currentRequestsPerMinute = {auto: 0, manual: 0};
  interval: {auto: NodeJS.Timeout, manual: NodeJS.Timeout} = {
    auto: setInterval(
      () => this.renewMinuteThrottler('auto'),
      60000
    ),
    manual: setInterval(
      () => this.renewMinuteThrottler('manual'),
      60000
    )}
  ;

  private currentKey = {auto: 0, manual: 0};
  private currentRequestsPerDay = {auto: 0, manual: 0};

  private cacheHitsToday = 0;
  private cacheSaving = false;
  dayInterval: {auto: NodeJS.Timeout, manual: NodeJS.Timeout} = {
    auto: setInterval(() => {
      this.currentRequestsPerDay.auto = 0;
      this.cacheHitsToday = 0;
      this.saveCounters();
      }, ONE_DAY),
    manual: setInterval(() => {
      this.currentRequestsPerDay.manual = 0;
      this.cacheHitsToday = 0;
      this.saveCounters();
      }, ONE_DAY)
    };

  constructor(
    private readonly config: AppConfig,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {
    this.renewMinuteThrottler('auto');
    this.renewMinuteThrottler('manual');
    this.loadCounters();
  }

  getEstimateAvailableProcessingWallets(): number {
    return Math.min(Math.max(Math.floor(((this.config.zerionApiKeyArray.auto[this.currentKey.auto].limit - this.currentRequestsPerDay.auto) / 10) - 10), 0), this.config.maxWalletsToUpdate); // можно больше?
  }

  //TODO
  async saveCounters() {
    if (!this.cacheSaving) {
      this.cacheSaving = true;
      await this.cacheManager.set('requestsPerDayAuto', this.currentRequestsPerDay.auto, ONE_DAY);
      await this.cacheManager.set('requestsPerDayManual', this.currentRequestsPerDay.manual, ONE_DAY);
      await this.cacheManager.set('cacheHitsToday', this.cacheHitsToday, ONE_DAY);
      this.cacheSaving = false;
    }
  }

  async loadCounters() {
    this.currentRequestsPerDay.auto =
      (await this.cacheManager.get('requestsPerDayAuto')) || 0;
    this.currentRequestsPerDay.manual =
      (await this.cacheManager.get('requestsPerDayManual')) || 0;
    this.cacheHitsToday = (await this.cacheManager.get('cacheHitsToday')) || 0;
  }

  private renewMinuteThrottler(input: string) {
    this.currentRequestsPerMinute[input] = 0;
    if (typeof this.currentThrottlerResolver === 'function' && this.currentRequestsPerDay[input] < this.config.zerionApiKeyArray[input][this.currentKey.auto].limit) {
      this.currentThrottlerResolver(null);
    }
    this.currentThrottlerPromise[input] = new Promise((resolve) => {
      this.currentThrottlerResolver = resolve;
    });
    this.saveCounters();
  }
  onModuleDestroy() {
    clearInterval(this.interval.auto);
    clearInterval(this.interval.manual);
    clearInterval(this.dayInterval.auto);
    clearInterval(this.dayInterval.manual);
  }

  @WithSentryPerformance('Get CSV transactions')
  async getCsvTransactions(
    transactions: ZerionResponse['data']
  ): Promise<CsvProcessingResponse> {
    try {
      const csvData = convertJsonToCsv(transactions);
      return csvData;
    } catch (error) {
      console.error(error);
      throw new Error('Failed to convert transactions to CSV');
    }
  }

  async getFungiblePositionsCsv(walletId: string, input: string): Promise<string[][]> {
    const fungiblePositions = await this.getTransactions<FungiblePosition>(
      walletId,
      () => Promise.resolve(),
      1000,
      input,
      (walletId) =>
        `https://api.zerion.io/v1/wallets/${walletId}/positions/?currency=usd&filter%5Btrash%5D=only_non_trash&sort=value`
    );

    return convertFungiblePositionsToCsvEntries(fungiblePositions.data);
  }

  @WithSentryPerformance('Get transactions')
  async getTransactions<T = Transaction>(
    walletId: string,
    onNextRequest: (
      minuteRequests: number,
      dayRequests: number,
      maxRequestsPerMinute: number,
      cacheHitsToday: number,
      data: T[]
    ) => Promise<void>,
    take = 0,
    input = 'manual',
    urlTemplate: (walletId: string, perPage: number) => string = (
      walletId,
      perPage
    ) =>
      `https://api.zerion.io/v1/wallets/${walletId}/transactions/?currency=usd&page[size]=${perPage}&filter[trash]=only_non_trash`
  ): Promise<ZerionResponse<T>> {
    const zerionApiKey = this.config.zerionApiKeyArray[input][this.currentKey.auto].token;
    const maxRequestsPerDay = this.config.zerionApiKeyArray[input][this.currentKey.auto].limit;
    const authHeader = createFromUserPass(zerionApiKey, '');
    
    const options = {
      headers: {
        accept: 'application/json',
        authorization: `Basic ${authHeader}`,
      },
    };

    const perPage = Math.min(take || 100, 100);

    let allTransactions: T[] = [];
    let url = urlTemplate(walletId, perPage);

    try {
      while (url) {
        console.log(
          `Fetching transactions from ${url} currentRequestsPerMinute: ${this.currentRequestsPerMinute[input]} ${this.currentRequestsPerDay[input]} currentKey: ${zerionApiKey} ${input}`
        );

        if (this.currentRequestsPerMinute[input] >= this.maxRequestsPerMinute) {
          await Promise.race([
            this.currentThrottlerPromise,
            new Promise((resolve) => setTimeout(resolve, 60_000)),
          ]);
        }
        let zerionResponse = null;
        const urlCacheKey = createMD5Hash(url);
        try {
          const zerionResponseRaw = await this.cacheManager.get(urlCacheKey);
          if (typeof zerionResponseRaw === 'string') {
            zerionResponse = JSON.parse(zerionResponseRaw as string);
          } else {
            zerionResponse = zerionResponseRaw;
          }
        } catch (e) {
          Logger.error(`Failed to parse cache key ${e}`);
        }

        if (!zerionResponse) {
          const response = await axios.get<ZerionResponse<T>>(url, options);
          zerionResponse = response.data;
          this.cacheManager.set(urlCacheKey, zerionResponse, ONE_DAY);
          this.currentRequestsPerMinute[input]++;
          this.currentRequestsPerDay[input]++;
        } else {
          this.cacheHitsToday++;
        }
        this.saveCounters();
        allTransactions = allTransactions.concat(zerionResponse.data as T[]);

        await onNextRequest(
          this.currentRequestsPerMinute[input],
          this.currentRequestsPerDay[input],
          this.maxRequestsPerMinute,
          this.cacheHitsToday,
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
}
