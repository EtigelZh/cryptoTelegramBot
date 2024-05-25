import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { WithUpdatedAndCreatedAt } from '../utils/base.entity';
import { EthInternalTransaction } from '../etherscan-api/etherscan-api.models';
import { WALLET_HASH_COLUMN } from '../utils/db-utils';

@Entity()
export class EthInternalTransactionEntity
  extends WithUpdatedAndCreatedAt
  implements EthInternalTransaction
{
  /**
   * Уникальный идентификатор записи
   */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  /**
   * Номер блока, в котором произошла транзакция
   */
  @Column()
  blockNumber: string;

  /**
   * Временная метка транзакции (в формате Unix timestamp)
   */
  @Column()
  timeStamp: string;

  /**
   * Хэш транзакции
   */
  @Column()
  hash: string;

  /**
   * Адрес отправителя
   */
  @Column(WALLET_HASH_COLUMN)
  from: string;

  /**
   * Адрес получателя
   */
  @Column(WALLET_HASH_COLUMN)
  to: string;

  /**
   * Значение транзакции в wei (1 эфир = 10^18 wei)
   */
  @Column('decimal', { precision: 36, scale: 0 })
  value: string;

  /**
   * Адрес контракта (если применимо, иначе пустая строка)
   */
  @Column({ nullable: true })
  contractAddress: string;

  /**
   * Входные данные транзакции (если есть, иначе пустая строка)
   */
  @Column({ nullable: true })
  input: string;

  /**
   * Тип транзакции (например, call)
   */
  @Column()
  type: string;

  /**
   * Лимит газа для транзакции
   */
  @Column('decimal', { precision: 36, scale: 0 })
  gas: string;

  /**
   * Использованный газ в транзакции
   */
  @Column('decimal', { precision: 36, scale: 0 })
  gasUsed: string;

  /**
   * Идентификатор трассировки
   */
  @Column()
  traceId: string;

  /**
   * Флаг ошибки (0 - без ошибок, 1 - ошибка)
   */
  @Column()
  isError: string;

  /**
   * Код ошибки (если есть, иначе пустая строка)
   */
  @Column({ nullable: true })
  errCode: string;
}
