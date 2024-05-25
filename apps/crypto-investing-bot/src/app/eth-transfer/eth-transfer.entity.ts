import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { WithUpdatedAndCreatedAt } from '../utils/base.entity';
import { EthTransfer } from '../etherscan-api/etherscan-api.models';
import { TRANSACTION_HASH_COLUMN, WALLET_HASH_COLUMN } from '../utils/db-utils';

@Entity()
export class EthTransferEntity extends WithUpdatedAndCreatedAt implements EthTransfer {

  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;
  /**
   * Номер блока, в котором была включена транзакция
   */
  @Column()
  blockNumber: string;

  /**
   * Временная метка, указывающая время выполнения транзакции
   */
  @Column()
  timeStamp: string;

  /**
   * Хэш транзакции
   */
  @Column(TRANSACTION_HASH_COLUMN)
  hash: string;

  /**
   * Nonce транзакции
   */
  @Column()
  nonce: string;

  /**
   * Хэш блока, в котором была включена транзакция
   */
  @Column()
  blockHash: string;

  /**
   * Адрес отправителя транзакции
   */
  @Column(WALLET_HASH_COLUMN)
  from: string;

  /**
   * Адрес смарт-контракта, участвующего в транзакции
   */
  @Column(WALLET_HASH_COLUMN)
  contractAddress: string;

  /**
   * Адрес получателя транзакции
   */
  @Column(WALLET_HASH_COLUMN)
  to: string;

  /**
   * Сумма токенов, переданных в транзакции
   */
  @Column()
  value: string;

  /**
   * Имя токена
   */
  @Column()
  tokenName: string;

  /**
   * Символ токена
   */
  @Column()
  tokenSymbol: string;

  /**
   * Количество десятичных знаков токена
   */
  @Column()
  tokenDecimal: string;

  /**
   * Индекс транзакции в блоке
   */
  @Column()
  transactionIndex: string;

  /**
   * Количество газа, использованного для выполнения транзакции
   */
  @Column()
  gas: string;

  /**
   * Цена газа
   */
  @Column()
  gasPrice: string;

  /**
   * Фактическое количество газа, использованное транзакцией
   */
  @Column()
  gasUsed: string;

  /**
   * Суммарное количество газа, использованное до данной транзакции в блоке
   */
  @Column()
  cumulativeGasUsed: string;

  /**
   * Количество подтверждений транзакции
   */
  @Column()
  confirmations: string;
}
