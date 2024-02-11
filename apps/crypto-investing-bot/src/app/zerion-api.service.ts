import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AppConfig } from './app.config';
import axios, { AxiosError } from 'axios';

export type RequestErrorData = {
  errors: string[];
};

export type RowError = { message: string, rowIndex: number };

export type ResponseWithErrorList<T = unknown, E extends RowError = RowError> = {
  errors: E[];
  data: T;
}

export type CsvProcessingResponse = ResponseWithErrorList<string[]>;

type ZerionResponse = {
  links: {
    self: string;
    next: string;
  };
  error?: AxiosError<RequestErrorData>;
  data: Transaction[];
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

type FungibleInfo = {
  name: string;
  symbol: string;
  icon: Icon | null;
  flags: {
    verified: boolean;
  };
  implementations: Implementation[];
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
  ].join('\t');
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
      const sellTransfer = transfers.find((t) => t.direction === 'out');

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
      ].join('\t');
    } catch (error) {
      console.error('Failed to process transaction', transaction, error);
      errors.push({ rowIndex, message: error.message });
      return ''; // Return an empty string for transactions that fail to process
    }
  });

  return {
    data: [header, ...transactions.filter((t) => t)],
    errors,
  }
}

function createFromUserPass(user: string, pass: string): string {
  return Buffer.from(`${user}:${pass}`).toString('base64');
}

@Injectable()
export class ZerionApiService implements OnModuleDestroy {
  private currentThrottlerPromise: Promise<void> = Promise.resolve();
  private currentThrottlerResolver: (args:unknown) => void;
  readonly maxRequestsPerMinute = 50;
  private currentRequestsPerMinute = 0;
  interval: NodeJS.Timeout = setInterval(() => this.renewMinuteThrottler(), 60000);

  readonly maxRequestsPerDay = 5000;
  private currentRequestsPerDay = 0;
  dayInterval: NodeJS.Timeout = setInterval(() => {
    this.currentRequestsPerDay = 0;
    console.log('Resetting requests per day');
  }, 24 * 60 * 60 * 1000);

  constructor(private readonly config: AppConfig) {
    this.renewMinuteThrottler();
  }

  private renewMinuteThrottler() {
    this.currentRequestsPerMinute = 0;
    if (typeof this.currentThrottlerResolver === 'function') {
      this.currentThrottlerResolver(null);
    }
    console.log('Resetting requests per minute');
    this.currentThrottlerPromise = new Promise((resolve) => {
      this.currentThrottlerResolver = resolve;
    });
  }
  onModuleDestroy() {
    clearInterval(this.interval);
    clearInterval(this.dayInterval);
  }

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

  async getTransactions(walletId: string, onNextRequest: (minuteRequests: number, dayRequests: number, maxRequestsPerMinute: number, data: Transaction[]) => Promise<void>, take = 0): Promise<ZerionResponse> {
    const authHeader = createFromUserPass(this.config.zerionApiKey, '');
    const options = {
      headers: {
        accept: 'application/json',
        authorization: `Basic ${authHeader}`,
      },
    };

    const perPage = Math.min(take || 100, 100);

    let allTransactions: Transaction[] = [];
    let url = `https://api.zerion.io/v1/wallets/${walletId}/transactions/?currency=usd&page[size]=${perPage}&filter[trash]=only_non_trash`;

    try {
      while (url) {
        console.log(`Fetching transactions from ${url} currentRequestsPerMinute: ${this.currentRequestsPerMinute} ${this.currentRequestsPerDay}`);
        
        if (this.currentRequestsPerMinute >= this.maxRequestsPerMinute) {
          await this.currentThrottlerPromise;
        }
        const response = await axios.get<ZerionResponse>(url, options);
        allTransactions = allTransactions.concat(response.data.data);

        this.currentRequestsPerMinute++;
        this.currentRequestsPerDay++;
        await onNextRequest(this.currentRequestsPerMinute, this.currentRequestsPerDay, this.maxRequestsPerMinute, allTransactions);
        
        // Check if there's a next page
        url = response.data.links.next ? response.data.links.next : '';

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
