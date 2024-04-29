import { Module } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TransactionEntity } from "./transaction.entity";
import { TransferModule } from "../transfer/transfer.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([TransactionEntity]),
        TransferModule,
    ],
    providers: [TransactionService],
    exports: [TransactionService]
})
export class TransactionModule {

}