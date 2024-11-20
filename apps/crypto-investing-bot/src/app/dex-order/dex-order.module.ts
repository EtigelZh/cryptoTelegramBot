import { Module } from "@nestjs/common";
import { DexOrderService } from "./dex-order.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DexOrderEntity } from "./dex-order.entity";
import { DexTransactionsModule } from "../dex-transactions/dex-transactions.module";
import { TelegrafModule } from "../telegraf/telegraf.module";
import { AppConfigModule } from "../app.config";
import { EthPriceWatcherModule } from "../eth-price-watcher/eth-price-watcher.module";

@Module({
    imports: [
        DexTransactionsModule,
        TypeOrmModule.forFeature([DexOrderEntity]),
        TelegrafModule,
        AppConfigModule,
        EthPriceWatcherModule,
    ],
    controllers: [],
    providers: [DexOrderService],
    exports: [DexOrderService]
})
export class DexOrderModule {}