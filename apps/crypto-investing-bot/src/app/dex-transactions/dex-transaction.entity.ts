import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { DexTransactionEconomics, DexTransactionType } from "../eth-transactions-watcher-logic/domain-logic/handle-swap";
import { WalletEntity } from "../wallet/wallet.entity";

export type DexMessage = {
    text: string;
}

@Entity()
export class DexTransactionEntity {
    @PrimaryGeneratedColumn()
    id: number;

    /** md5 hash против дублирования */
    @Column({ unique: true})
    computedHash: string;

    @Column()
    @Index()
    transactionHash: string;

    @Column()
    @Index()
    blockNumber: number;

    @ManyToOne(() => WalletEntity, wallet => wallet.hash)
    wallet: WalletEntity;

    @Column()
    @Index()
    tokenAddress: string;

    @Column({ type: 'enum', enum: DexTransactionType})
    action: DexTransactionType;

    @Column({ type: 'jsonb' })
    economics: DexTransactionEconomics;

    @Column({ type: 'jsonb' })
    message: DexMessage;

    @UpdateDateColumn()
    updatedAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}