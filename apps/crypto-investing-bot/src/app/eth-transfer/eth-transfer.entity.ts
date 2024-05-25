import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { WithUpdatedAndCreatedAt } from '../utils/base.entity';

@Entity()
export class EthTransferEntity extends WithUpdatedAndCreatedAt {
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
  @Column()
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
  @Column()
  from: string;

  /**
   * Адрес смарт-контракта, участвующего в транзакции
   */
  @Column()
  contractAddress: string;

  /**
   * Адрес получателя транзакции
   */
  @Column()
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
