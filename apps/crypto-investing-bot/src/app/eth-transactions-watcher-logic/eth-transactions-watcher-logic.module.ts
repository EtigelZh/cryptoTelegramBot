import { Module } from "@nestjs/common";
import { AppConfigModule } from "../app.config";
import { TelegrafModule } from "../telegraf/telegraf.module";
import { EthRuntimeWatcherService } from "./eth-runtime-wather.service";
import { WalletModule } from "../wallet/wallet.module";
import { EthMissingBlockCheckerService } from "./eth-missing-block-checker.service";
import { EthTransferModule } from "../eth-transfer/eth-transfer.module";

@Module({
    imports: [
        AppConfigModule,
        WalletModule,
        TelegrafModule,
        EthTransferModule,
    ],
    providers: [EthRuntimeWatcherService, EthMissingBlockCheckerService],
})
export class EthTransactionsWatcherLogicModule {
}