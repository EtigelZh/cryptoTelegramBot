import { Module } from "@nestjs/common";
import { DexWalletsService } from "./dex-wallets.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DexWalletsEntity } from "./dex-wallets.entity";
import { TelegrafModule } from "../telegraf/telegraf.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([DexWalletsEntity]),
        TelegrafModule
    ],
    controllers: [],
    providers: [DexWalletsService],
    exports: [DexWalletsService]
})
export class DexWalletsModule {}