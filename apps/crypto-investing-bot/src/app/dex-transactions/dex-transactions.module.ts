import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DexTransactionEntity } from "./dex-transaction.entity";
import { DexTransactionService } from "./dex-transactions.service";

@Module({
    imports: [TypeOrmModule.forFeature([DexTransactionEntity])],
    controllers: [],
    providers: [DexTransactionService],
    exports: [DexTransactionService]
})
export class DexTransactionsModule {}