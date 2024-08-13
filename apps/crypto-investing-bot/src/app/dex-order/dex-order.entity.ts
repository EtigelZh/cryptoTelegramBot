import { Column, CreateDateColumn, Entity, Index, ManyToMany, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { WalletEntity } from "../wallet/wallet.entity";
import { DexOrderCompletedReason, DexOrderStatus } from "./dex-order.models";
import { DexTransactionEntity } from "../dex-transactions/dex-transaction.entity";



@Entity()
export class DexOrderEntity {
    @PrimaryGeneratedColumn()
    id: number;
    /** Кошелек за которым следовали */
    @ManyToOne(() => WalletEntity)
    copyTradingWallet: WalletEntity;
    /** Кошелек с которого торгуем */
    @ManyToOne(() => WalletEntity)
    wallet: WalletEntity;
    
    @Column({ type: 'enum', enum: DexOrderStatus })
    status: DexOrderStatus;
    
    @Column({ type: 'enum', enum: DexOrderCompletedReason })
    completedReason: DexOrderCompletedReason;
  
    /** Адрес контракта монеты */
    @Column()
    @Index()
    tokenAddress: string;
    /** Транзакция за которой повторяли покупки */
    @Column()
    sourceBuyingTransactionHash: string;
    @Column()
    sourceBuyingTransactionBlockNumber: number;
    @Column()
    sourceBuyingTransactionDate: Date;
    @Column({ type: 'numeric'})
    sourceBuyingTransactionPrice: number;
    @Column({ type: 'numeric'})
    sourceBuyingTransactionAmount: number;
  
    @ManyToMany(() => DexTransactionEntity, { eager: true })
    sourceBuyingTransactions: DexTransactionEntity[];
    @ManyToMany(() => DexTransactionEntity, { eager: true })
    sourceSellingTransactions: DexTransactionEntity[];
  
    @Column({ type: 'numeric' })
    targetBuyingPrice: number;
    @Column({ type: 'numeric' })
    targetBuyingAmountEth: number;
  
    @Column({ type: 'numeric' })
    targetSellingPrice: number;
    @Column({ type: 'numeric' })
    targetSellingAmountTokenPercent: number;
    
    /** Количество и цены купленного считаем автоматом */
    @ManyToMany(() => DexTransactionEntity, { eager: true })
    buyingTransactions: DexTransactionEntity[];
    @ManyToMany(() => DexTransactionEntity, { eager: true })
    sellingTransactions: DexTransactionEntity[];

    @Column({ type: 'jsonb', default: {} })
    additionalFields: Record<string, unknown>;
  
    @CreateDateColumn()
    createdAt: Date;
    @UpdateDateColumn()
    updatedAt: Date;
  }
  