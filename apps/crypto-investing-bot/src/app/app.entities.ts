import { FinanceDataEntity } from "./analytics/financial-data.entity";
import { FungibleEntity } from "./fungible/fungible.entity";
import { TransactionEntity } from "./transaction/transaction.entity";
import { TransferEntity } from "./transfer/transfer.entity";
import { WalletEntity } from "./wallet/wallet.entity";

export const entities = [
    FinanceDataEntity,
    WalletEntity,
    FungibleEntity,
    TransferEntity,
    TransactionEntity,
];