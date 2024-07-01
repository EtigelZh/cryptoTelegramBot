import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export enum EthTransactionType {
    LEGACY = 0,
    EIP2930 = 1,
    EIP1559 = 2
}

@Entity()
export class EthTransaction {
    @PrimaryGeneratedColumn()
    id: number;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 66 })
    hash: string;

    @Column({
        type: 'enum',
        enum: EthTransactionType,
        default: EthTransactionType.LEGACY
    })
    type: EthTransactionType;

    @Column({ type: 'jsonb', default: [] })
    accessList: unknown[];

    @Column({ type: 'varchar', length: 66 })
    blockHash: string;

    @Column({ type: 'int' })
    blockNumber: number;

    @Column({ type: 'int' })
    transactionIndex: number;

    @Column({ type: 'int' })
    confirmations: number;

    @Column({ type: 'varchar', length: 42 })
    from: string;

    @Column({ type: 'varchar', length: 42, nullable: true })
    to: string;

    @Column({ type: 'numeric', precision: 78, scale: 0 })
    gasPrice: string;

    @Column({ type: 'numeric', precision: 78, scale: 0, nullable: true })
    maxPriorityFeePerGas: string;

    @Column({ type: 'numeric', precision: 78, scale: 0, nullable: true })
    maxFeePerGas: string;

    @Column({ type: 'numeric', precision: 78, scale: 0 })
    gasLimit: string;

    @Column({ type: 'numeric', precision: 78, scale: 0 })
    value: string;

    @Column({ type: 'int' })
    nonce: number;

    @Column({ type: 'text' })
    data: string;

    @Column({ type: 'varchar', length: 42, nullable: true })
    creates: string;

    @Column({ type: 'int' })
    chainId: number;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}