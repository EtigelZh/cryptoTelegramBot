import { Column, Entity, PrimaryColumn } from "typeorm";
import { AmountGroup, CurrencySymbol, TransactionHash, TransferDirection, WalletHash } from "../utils/models";
import { CURRENCY_SYMBOL_COLUMN, TIMESTAMP_COLUMN, TRANSACTION_HASH_COLUMN, WALLET_HASH_COLUMN } from "../utils/db-utils";
import { Quantity } from "../zerion-api/zerion-api.models";
import { WithUpdatedAndCreatedAt } from "../utils/base.entity";

// В рамках одной транзакции может быть несколько трансферов - по ним считаем балансы
@Entity()
export class TransferEntity extends WithUpdatedAndCreatedAt implements AmountGroup {
    @PrimaryColumn(TRANSACTION_HASH_COLUMN)
    transactionId: TransactionHash;
    @PrimaryColumn(WALLET_HASH_COLUMN)
    from: WalletHash;
    @PrimaryColumn(WALLET_HASH_COLUMN)
    to: WalletHash;

    @Column({ type: 'enum', enum: TransferDirection })
    direction: TransferDirection;
    
    @Column(TIMESTAMP_COLUMN)
    transactionDate: Date;
    @Column()
    blockNo: number;

    @Column({ nullable: true })
    method: string;

    @Column({ type: 'numeric' })
    amount: number;
    @Column(CURRENCY_SYMBOL_COLUMN)
    amountCurrency: CurrencySymbol;
    @Column(WALLET_HASH_COLUMN)
    amountCurrencyAddress: string;
    @Column({ type: 'numeric', nullable: true })
    amountUsd: number;
    @Column({ type: 'numeric', nullable: true })
    amountUsdRate: number;

    @Column({ type: 'jsonb' })
    quantity: Quantity;
}