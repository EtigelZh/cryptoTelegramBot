import { Module } from "@nestjs/common";
import { EthPriceService } from "./eth-price.service";

@Module({
    imports: [],
    controllers: [],
    providers: [EthPriceService],
    exports: [EthPriceService]
})
export class EthPriceWatcherModule {
}