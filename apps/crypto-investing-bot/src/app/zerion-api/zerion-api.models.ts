import type { AxiosError, AxiosResponse } from "axios";

export type ZerionApiQueueName =
  | 'updating' // Ключи для очереди обновления кошельков
  | 'manual'; // Ключи для ручного расчета кошельков

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

export type ZerionResponse<T = ZerionTransaction> = {
  links: {
    self: string;
    next: string;
  };
  error?: AxiosError<RequestErrorData>;
  data: T[];
};

export type ZerionTransaction = {
  type: string;
  id: string;
  attributes: TransactionAttributes;
  relationships: {
    chain: ChainRelationship;
    dapp?: ChainRelationship;
  };
};

export type TransactionAttributes = {
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

export type Fee = {
  fungible_info: FungibleInfo;
  quantity: Quantity;
  price: number | null;
  value: number | null;
};

export type Transfer = {
  fungible_info: FungibleInfo;
  direction: string;
  quantity: Quantity;
  value: number | null;
  price: number | null;
  sender: string;
  recipient: string;
};

export type Icon = {
  url: string;
};

export type Implementation = {
  chain_id: string;
  address: string;
  decimals: number;
};

export type Approval = {
  // Define the structure for approvals if needed
};

export type ApplicationMetadata = {
  name: string;
  icon: Icon;
  contract_address: string;
};

export type ChainRelationship = {
  links?: {
    related: string;
  };
  data: {
    type: string;
    id: string;
  };
};

export type Quantity = {
  int: string;
  decimals: number;
  float: number;
  numeric: string;
};

export type Changes = {
  absolute_1d: number;
  percent_1d: number;
};

export type FungibleInfo = {
  name: string;
  symbol: string;
  icon: Icon | null;
  flags: {
    verified: boolean;
  };
  implementations: Implementation[];
};

export type PositionAttributes = {
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

export type FungiblePosition = {
  type: string;
  id: string;
  attributes: PositionAttributes;
  relationships: {
    chain: ChainRelationship;
  };
};

export type GetTransactionsArguments<T> = {
    walletHash: string;
    take?: number;
    apiKeyQueueName: ZerionApiQueueName;
    urlTemplate?: (walletHash: string, perPage: number) => string;
    onNextRequest?: (
        cacheHitsToday: number,
        data: T[]
      ) => Promise<void>;
    requestType: 'transactions' | 'fungible_positions' | 'receive_transactions';
    getNextChunk?: <T>(url: string, apiKeyQueueName: ZerionApiQueueName) => Promise<ZerionResponse<T>>
}

