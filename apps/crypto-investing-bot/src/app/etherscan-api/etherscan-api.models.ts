export type FetchTransactionsArguments = {
  walletAddress: string;
  action: 'txlist';
  /** max 10_000 */
  take: number;
  startblock?: number;
};

export type EthTransaction = {
  blockNumber: string;
  timeStamp: string; // В секундах
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
   * Данные входа для транзакции (в данном случае "deprecated")
   */
  input: string;

  /**
   * Количество подтверждений транзакции
   */
  confirmations: string;
};
