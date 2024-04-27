import { FinanceDataEntity } from "./analytics/financial-data.entity";
import { FungibleEntity } from "./fungible/fungible.entity";
import { TransactionEntity } from "./transaction/transaction.entity";
import { TransferEntity } from "./transfer/transfer.entity";

export const entities = [
    FinanceDataEntity,
    FungibleEntity,
    TransferEntity,
    TransactionEntity,
];