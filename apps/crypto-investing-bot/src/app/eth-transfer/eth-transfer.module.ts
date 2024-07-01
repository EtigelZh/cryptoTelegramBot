import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EthTransferEntity } from "./eth-transfer.entity";
import { EthInternalTransactionEntity } from "./eth-internal-transaction.entity";
import { EthTransferService } from "./eth-transfer.service";
import { AppConfigModule } from "../app.config";
import { EthTransactionEntity } from "./eth-transaction.entity";

@Module({
    imports: [
        AppConfigModule,
        TypeOrmModule.forFeature([
            EthTransferEntity,
            EthTransactionEntity,
            EthInternalTransactionEntity,
        ]),
    ],
    providers: [EthTransferService],
    exports: [EthTransferService]
})
export class EthTransferModule {}