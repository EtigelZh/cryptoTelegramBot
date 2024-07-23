export type AccountActionArguments = FetchTransactionsArguments | FetchErc20TransfersByContractArguments | FetchInternalTransactionsByBlockRangeArguments | LogsEtherscanApiParams;

export type AccountActionCommonArguments = {
  page?: number;
  offset?: number;
  startblock?: number;
  endblock?: number;
  sort?: 'asc' | 'desc';
}
export type FetchTransactionsArguments = {
  address: string;
  action: 'txlist';
} & AccountActionCommonArguments;

export type FetchErc20TransfersByContractArguments = {
  action: 'tokentx';
  contractAddress: string;
  address?: string;
} & AccountActionCommonArguments;

export type FetchInternalTransactionsByBlockRangeArguments = {
  action: 'txlistinternal';
} & AccountActionCommonArguments;

export type EthTransaction = {
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

export type EthInternalTransaction = {
  /**
   * Номер блока, в котором произошла транзакция
   */
  blockNumber: string;

  /**
   * Временная метка транзакции (в формате Unix timestamp)
   */
  timeStamp: string;

  /**
   * Хэш транзакции
   */
  hash: string;

  /**
   * Адрес отправителя
   */
  from: string;

  /**
   * Адрес получателя
   */
  to: string;

  /**
   * Значение транзакции в wei (1 эфир = 10^18 wei)
   */
  value: string;

  /**
   * Адрес контракта (если применимо, иначе пустая строка)
   */
  contractAddress: string;

  /**
   * Входные данные транзакции (если есть, иначе пустая строка)
   */
  input: string;

  /**
   * Тип транзакции (например, call)
   */
  type: string;

  /**
   * Лимит газа для транзакции
   */
  gas: string;

  /**
   * Использованный газ в транзакции
   */
  gasUsed: string;

  /**
   * Идентификатор трассировки
   */
  traceId: string;

  /**
   * Флаг ошибки (0 - без ошибок, 1 - ошибка)
   */
  isError: string;

  /**
   * Код ошибки (если есть, иначе пустая строка)
   */
  errCode: string;
};

export type EthTransfer = {
  /**
   * Номер блока, в котором была включена транзакция
   */
  blockNumber: string;

  /**
   * Временная метка, указывающая время выполнения транзакции
   */
  timeStamp: string;

  /**
   * Хэш транзакции
   */
  hash: string;

  /**
   * Nonce транзакции
   */
  nonce: string;

  /**
   * Хэш блока, в котором была включена транзакция
   */
  blockHash: string;

  /**
   * Адрес отправителя транзакции
   */
  from: string;

  /**
   * Адрес смарт-контракта, участвующего в транзакции
   */
  contractAddress: string;

  /**
   * Адрес получателя транзакции
   */
  to: string;

  /**
   * Сумма токенов, переданных в транзакции
   */
  value: string;

  /**
   * Имя токена
   */
  tokenName: string;

  /**
   * Символ токена
   */
  tokenSymbol: string;

  /**
   * Количество десятичных знаков токена
   */
  tokenDecimal: string;

  /**
   * Индекс транзакции в блоке
   */
  transactionIndex: string;

  /**
   * Количество газа, использованного для выполнения транзакции
   */
  gas: string;

  /**
   * Цена газа
   */
  gasPrice: string;

  /**
   * Фактическое количество газа, использованное транзакцией
   */
  gasUsed: string;

  /**
   * Суммарное количество газа, использованное до данной транзакции в блоке
   */
  cumulativeGasUsed: string;

  /**
   * Количество подтверждений транзакции
   */
  confirmations: string;
};

export type AccountEtherscanApiParams = {
  address?: string;
  contractAddress?: string;
} & AccountActionCommonArguments;

export type LogsEtherscanApiParams = {
  action?: 'getLogs';
  startblock: number;
  endblock: number;
  page?: number;
  offset?: number;
  topic0: string;
  topic1?: string;
  topic2?: string;
  topic3?: string;
  topic0_1_opr?: 'and' | 'or';
  topic1_2_opr?: 'and' | 'or';
  topic2_3_opr?: 'and' | 'or';
  topic0_2_opr?: 'and' | 'or';
  topic0_3_opr?: 'and' | 'or';
  topic1_3_opr?: 'and' | 'or';
  retryParams?: number[];
};
