import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FinanceDataEntity } from "./financial-data.entity";
import { AnalyticsService } from "./analytics.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([FinanceDataEntity]),
    ],
    providers: [AnalyticsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule {}