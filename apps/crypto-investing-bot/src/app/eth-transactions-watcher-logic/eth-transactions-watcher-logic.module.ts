import { Module } from "@nestjs/common";
import { AppConfigModule } from "../app.config";
import { TelegrafModule } from "../telegraf/telegraf.module";
import { EthRuntimeWatcherService } from "./eth-runtime-wather.service";
import { WalletModule } from "../wallet/wallet.module";
import { EthMissingBlockCheckerService } from "./eth-missing-block-checker.service";
import { EthTransferModule } from "../eth-transfer/eth-transfer.module";
import { FungibleModule } from "../fungible/fungible.module";
import { EthPriceService } from "./eth-price.service";
import { EtherscanApiModule } from "../etherscan-api/etherscan-api.module";
import { DexTransactionsModule } from "../dex-transactions/dex-transactions.module";
import { DexOrderModule } from "../dex-order/dex-order.module";
import { DexWalletsModule } from "../dex-wallets/dex-wallets.module";

@Module({
    imports: [
        AppConfigModule,
        WalletModule,
        FungibleModule,
        TelegrafModule,
        EthTransferModule,
        EtherscanApiModule,
        DexTransactionsModule,
        DexOrderModule,
        DexWalletsModule
    ],
    providers: [EthRuntimeWatcherService, EthPriceService, EthMissingBlockCheckerService],
    exports: [EthPriceService, EthRuntimeWatcherService],
})
export class EthTransactionsWatcherLogicModule {
}