import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WalletEntity } from "./wallet.entity";
import { WalletService } from "./wallet.service";
import { CacheModule } from '@nestjs/cache-manager';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            WalletEntity,
        ]),
      CacheModule.register(),
    ],
    providers: [
        WalletService,
    ],
    exports: [
        WalletService,
    ]
})
export class WalletModule {}
