import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TokenPriceHistoryEntity } from "./token-price-history.entity";
import { TokenPriceHistoryService } from "./token-price-history.service";

@Module({
    imports: [TypeOrmModule.forFeature([TokenPriceHistoryEntity])],
    providers: [TokenPriceHistoryService],
    exports: [TokenPriceHistoryService],
})
export class TokenPriceHistoryModule {}