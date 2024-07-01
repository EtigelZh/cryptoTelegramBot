import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EthTransferEntity } from "./eth-transfer.entity";
import { EthInternalTransactionEntity } from "./eth-internal-transaction.entity";
import { EthTransferService } from "./eth-transfer.service";
import { EthRuntimeWatcherService } from "./eth-runtime-wather.service";
import { AppConfigModule } from "../app.config";
import { WalletModule } from "../wallet/wallet.module";

@Module({
    imports: [
        AppConfigModule,
        WalletModule,
        TypeOrmModule.forFeature([
            EthTransferEntity,
            EthInternalTransactionEntity,
        ]),
    ],
    providers: [EthTransferService, EthRuntimeWatcherService],
    exports: [EthTransferService]
})
export class EthTransferModule {}