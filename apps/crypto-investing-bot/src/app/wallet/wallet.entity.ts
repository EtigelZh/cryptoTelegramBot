import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { WALLET_HASH_COLUMN } from "../utils/db-utils";
import { WalletHash } from '../utils/models';
import { WithUpdatedAndCreatedAt } from "../utils/base.entity";
import { WalletFinancialStats } from './wallet.models';

export enum WalletStatus {
    ACTIVE = 'ACTIVE', // Есть транзакции, заполнены поля firstTransactionDate и lastTransactionDate
    LOW_TRADES = 'LOW_TRADES', // Есть транзакции, но их мало - неторговый аккаунт - нам не интересен, такие не добавляем в excel
    NEW = 'NEW', // Новый кошелек, еще не ходили в api
    NOT_TRACKABLE = 'NOT_TRACKABLE', // получаем 404 при запросе транзакций
}

@Entity()
export class WalletEntity extends WithUpdatedAndCreatedAt {
    @PrimaryColumn(WALLET_HASH_COLUMN)
    hash: WalletHash;

    @Index()
    @Column({ unique: true })
    alias: string;

    @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.NEW})
    status: WalletStatus;

    /** Дата последнего пересчета */
    @Column({ nullable: true })
    lastCalculatedAt: Date;

    @Column({ nullable: true})
    firstTransactionDate?: Date;

    @Column({ nullable: true })
    lastTransactionDate?: Date;

    @Column({ default: false })
    isUseMaestroBot: boolean;

    /** Используется для поиска кошельков */
    @Column({ type: 'bigint', nullable: true })
    searchLastBlockNo?: number;

    @Column({ type: 'jsonb', nullable: true })
    walletFinancialStats?: WalletFinancialStats;
}
