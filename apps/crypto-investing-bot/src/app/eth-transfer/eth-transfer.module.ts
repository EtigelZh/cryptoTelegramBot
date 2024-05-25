import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EthTransferEntity } from "./eth-transfer.entity";
import { EthInternalTransactionEntity } from "./eth-internal-transaction.entity";
import { EthTransferService } from "./eth-transfer.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            EthTransferEntity,
            EthInternalTransactionEntity,
        ]),
    ],
    providers: [EthTransferService],
    exports: [EthTransferService]
})
export class EthTransferModule {}