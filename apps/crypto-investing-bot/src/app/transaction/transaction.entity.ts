import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { UNSIGNED_BIGINT_COLUMN, TIMESTAMP_COLUMN, TRANSACTION_HASH_COLUMN, WALLET_HASH_COLUMN, INTEGER_COLUMN, CURRENCY_SYMBOL_COLUMN } from "../utils/db-utils";
import { CurrencySymbol, InOutTransactionFields, TransactionHash, TransactionStatus, TransactionType, WalletHash } from "../utils/models";
import type { ZerionTransaction } from "../zerion-api/zerion-api.models";
import { WithUpdatedAndCreatedAt } from "../utils/base.entity";
import { CalculationVersion } from '../utils/transaction-economics';

@Entity()
export class TransactionEntity  extends WithUpdatedAndCreatedAt implements InOutTransactionFields {
    @PrimaryColumn(TRANSACTION_HASH_COLUMN)
    id: TransactionHash;
    @Index()
    @Column(WALLET_HASH_COLUMN)
    from: WalletHash;
    @Index()
    @Column(WALLET_HASH_COLUMN)
    to: WalletHash;

    @Index()
    @Column(TIMESTAMP_COLUMN)
    date: Date;
    @Column(UNSIGNED_BIGINT_COLUMN)
    blockNumber: number;
    @Column(INTEGER_COLUMN)
    nonce: number;

    @Column({ enum: TransactionStatus, type: 'enum' })
    status: TransactionStatus;
    @Column({ enum: TransactionType, type: 'enum', nullable: true })
    transactionType: TransactionType;


    @Column({ type: 'numeric' })
    fee: number;
    @Column(CURRENCY_SYMBOL_COLUMN)
    feeCurrency: CurrencySymbol;
    @Column({ type: 'numeric', nullable: true })
    feeUsd: number;
    @Column({ type: 'numeric', nullable: true })
    feeUsdRate: number;

    @Column({ nullable: true })
    chain: string;
    @Column({ nullable: true })
    app: string;

    /** Поля полезные для нашего анализа - сколько пришло, в токенах и фиате */
    @Column({ type: 'numeric', nullable: true })
    receiveAmount: number;
    @Column({ ...CURRENCY_SYMBOL_COLUMN, nullable: true })
    receiveCurrency: CurrencySymbol;
    @Column({...WALLET_HASH_COLUMN, nullable: true})
    receiveCurrencyAddress: string;
    @Column({ type: 'numeric', nullable: true })
    receiveUsd: number;
    @Column({ type: 'numeric', nullable: true })
    receiveUsdRate: number;

    /** Поля полезные для нашего анализа - сколько ушло, в токенах и фиате */
    @Column({ type: 'numeric', nullable: true })
    spentAmount: number;
    @Column({ ...CURRENCY_SYMBOL_COLUMN, nullable: true })
    spentCurrency: CurrencySymbol;
    @Column({...WALLET_HASH_COLUMN, nullable: true})
    spentCurrencyAddress: string;
    @Column({ type: 'numeric', nullable: true })
    spentUsd: number;
    @Column({ type: 'numeric', nullable: true })
    spentUsdRate: number;

    @Column({ nullable: true })
    zerionId: string;
    /** Сохраняем исходник, что бы можно было если что пересчитать поля */
    @Column({ type: 'jsonb', nullable: true })
    zerionSource: ZerionTransaction;

    /** Поле для фикса багов в расчетах, если нужно пересчитать икрементим версию */
    @Column({ default: CalculationVersion.FIRST_VERSION })
    inOutTransactionFieldsVersion: number;

    @Column({ type: 'jsonb', nullable: true })
    etherscanSource: Record<string, unknown>;
}
