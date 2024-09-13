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
    copyTradingWallet: Partial<WalletEntity>;
    /** Кошелек с которого торгуем */
    @ManyToOne(() => WalletEntity)
    wallet: Partial<WalletEntity>;
    
    @Column({ type: 'enum', enum: DexOrderStatus })
    status: DexOrderStatus;
    
    @Column({ type: 'enum', enum: DexOrderCompletedReason, nullable: true })
    completedReason: DexOrderCompletedReason;
  
    @Column({nullable: true})
    messageDexOrderId: number;

    @Column({nullable: true})
    chatDexOrderId: number;
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
    /** Цена в Эфирах */
    @Column({ type: 'numeric'})
    sourceBuyingTransactionPrice: number;
    /** Сколько было куплено токенов */
    @Column({ type: 'numeric'})
    sourceBuyingTransactionAmount: number;
  
    @ManyToMany(() => DexTransactionEntity, { eager: false })
    sourceBuyingTransactions: DexTransactionEntity[];
    @ManyToMany(() => DexTransactionEntity, { eager: false })
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
    @Column({ type: 'jsonb', default: [] })
    buyingTransactions: DexTransactionEntity[];
    @Column({ type: 'jsonb', default: [] })
    sellingTransactions: DexTransactionEntity[];

    @Column({ type: 'jsonb', default: {} })
    additionalFields: Record<string, unknown>;
  
    @CreateDateColumn()
    createdAt: Date;
    @UpdateDateColumn()
    updatedAt: Date;
  }
  