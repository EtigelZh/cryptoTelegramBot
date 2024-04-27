import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { WALLET_HASH_COLUMN } from "../utils/db-utils";
import { WalletHash } from "../utils/models";

export enum WalletStatus {
    ACTIVE = 'ACTIVE', // Есть транзакции
    NEW = 'NEW', // Новый кошелек, еще не ходили в api
    NOT_TRACKABLE = 'NOT_TRACKABLE', // получаем 404 при запросе транзакций
}

@Entity()
export class WalletEntity {
    @PrimaryColumn(WALLET_HASH_COLUMN)
    hash: WalletHash;

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

    @UpdateDateColumn()
    updatedAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}