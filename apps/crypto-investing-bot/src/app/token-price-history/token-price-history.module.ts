import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenPriceHistoryEntity } from './token-price-history.entity';
import { TokenPriceHistoryService } from './token-price-history.service';
import { AppConfigModule } from '../app.config';
import { ScheduleModule } from '@nestjs/schedule';
import { DexOrderModule } from '../dex-order/dex-order.module';
import { EthPriceWatcherModule } from '../eth-price-watcher/eth-price-watcher.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenPriceHistoryEntity]),
    AppConfigModule,
    ScheduleModule,
    DexOrderModule,
    EthPriceWatcherModule,
  ],
  providers: [TokenPriceHistoryService],
  exports: [TokenPriceHistoryService],
})
export class TokenPriceHistoryModule {}
