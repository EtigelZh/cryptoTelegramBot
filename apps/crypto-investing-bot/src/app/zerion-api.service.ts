import { Injectable } from '@nestjs/common';
import { AppConfig } from './app.config';
import axios from 'axios';

type ZerionResponse = {
  links: {
    self: string;
    next: string;
  };
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


function convertJsonToCsv(data: ZerionResponse['data']): string {
    const header = [
        "Date", "Time", "Transaction Type", "Status", "Chain", 
        "Buy Amount", "Buy Currency", "Buy Currency Address", "Buy Fiat Amount", "Buy Fiat Currency", 
        "Sell Amount", "Sell Currency", "Sell Currency Address", "Sell Fiat Amount", "Sell Fiat Currency", 
        "Fee Amount", "Fee Currency", "Fee Fiat Amount", "Fee Fiat Currency", 
        "Tx Hash", "Link", "Timestamp", "Incoming Transfers JSON", "Outgoing Transfers JSON"
      ].join('\t');

  const transactions = data.map((transaction) => {
    const attributes = transaction.attributes;
    const chain = transaction.relationships.chain.data.id;

    const date = new Date(attributes.mined_at).toLocaleDateString();
    const time = new Date(attributes.mined_at).toLocaleTimeString();
    const transactionType = attributes.operation_type;
    const status = attributes.status;
    const txHash = attributes.hash;
    const link = `https://etherscan.io/tx/${txHash}`;

    const fee = attributes.fee;
    const feeCurrency = fee.fungible_info.symbol;
    const feeAmount = fee.quantity.float;
    const feeFiatAmount = fee.value;

    const transfers = attributes.transfers.map((transfer) => {
      return {
        amount: transfer.quantity.float,
        currency: transfer.fungible_info.symbol,
        address:
          transfer.fungible_info.implementations.find(
            (impl) => impl.chain_id === chain
          )?.address ?? '',
        fiatAmount: transfer.value,
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
      buyTransfer?.sender || '',
      buyTransfer?.fiatAmount ?? '',
      'USD',
      sellTransfer?.amount ?? '',
      sellTransfer?.currency ?? '',
      sellTransfer?.recipient || '',
      sellTransfer?.fiatAmount ?? '',
      'USD',
      feeAmount,
      feeCurrency,
      feeFiatAmount,
      'USD',
      txHash,
      link,
      attributes.mined_at,
      JSON.stringify(attributes.transfers.filter((t) => t.direction === 'in')),
      JSON.stringify(attributes.transfers.filter((t) => t.direction === 'out')),
    ].join('\t');
  });

  return [header, ...transactions].join('\n');
}

function createFromUserPass(user: string, pass: string): string {
  return Buffer.from(`${user}:${pass}`).toString('base64');
}

@Injectable()
export class ZerionApiService {
  constructor(private readonly config: AppConfig) {}

  async getCsvTransactions(transactions: ZerionResponse['data']): Promise<string> {
    const csvData = convertJsonToCsv(transactions);
    return csvData;
  }


  async getTransactions(walletId: string, take = 0): Promise<ZerionResponse> {
    const authHeader = createFromUserPass(this.config.zerionApiKey, '');
    const options = {
      headers: {
        accept: 'application/json',
        authorization: `Basic ${authHeader}`
      }
    };

    const perPage = Math.min(take || 100, 100);

    let allTransactions: Transaction[] = [];
    let url = `https://api.zerion.io/v1/wallets/${walletId}/transactions/?currency=usd&page[size]=${perPage}&filter[trash]=only_non_trash`;

    try {
      while (url) {
        console.log(`Fetching transactions from ${url}`);
        const response = await axios.get<ZerionResponse>(url, options);
        allTransactions = allTransactions.concat(response.data.data);

        // Check if there's a next page
        url = response.data.links.next ? response.data.links.next : "";

        if (take && allTransactions.length >= take) {
          break;
        }
      }

      return {
        links: {
          self: "", // You might want to handle the 'self' link appropriately
          next: ""
        },
        data: allTransactions
      };
    } catch (error) {
      console.error(error);
      throw new Error('Error fetching transactions from Zerion API');
    }
  }
}
