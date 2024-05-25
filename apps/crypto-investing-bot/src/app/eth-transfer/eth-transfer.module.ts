import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EthTransferEntity } from "./eth-transfer.entity";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            EthTransferEntity,
        ]),
    ],
    providers: [],
    exports: []
})
export class EthTransferModule {}