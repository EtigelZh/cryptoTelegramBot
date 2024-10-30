import { FinanceDataEntity } from "./analytics/financial-data.entity";
import { FungibleEntity } from "./fungible/fungible.entity";
import { TransactionEntity } from "./transaction/transaction.entity";
import { WalletEntity } from "./wallet/wallet.entity";
import { LongTermProcessingWalletTaskEntity } from './processing-wallets/long-term-processing-wallet-task.entity';
import { EthTransferEntity } from "./eth-transfer/eth-transfer.entity";
import { EthInternalTransactionEntity } from "./eth-transfer/eth-internal-transaction.entity";
import { DexTransactionEntity } from "./dex-transactions/dex-transaction.entity";
import { DexOrderEntity } from "./dex-order/dex-order.entity";
import { TokenPriceHistoryEntity } from "./token-price-history/token-price-history.entity";
import { DexWalletsEntity } from "./dex-wallets/dex-wallets.entity";

export const entities = [
    FinanceDataEntity,
    WalletEntity,
    FungibleEntity,
    TransactionEntity,
    LongTermProcessingWalletTaskEntity,
    EthTransferEntity,
    EthInternalTransactionEntity,
    DexTransactionEntity,
    DexOrderEntity,
    TokenPriceHistoryEntity,
    DexWalletsEntity
];
