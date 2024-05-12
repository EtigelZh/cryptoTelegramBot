import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WalletEntity } from "./wallet.entity";
import { WalletService } from "./wallet.service";
import { WalletProcessingTaskEntity } from './wallet-processing-task.entity';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            WalletEntity,
            WalletProcessingTaskEntity,
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
