import { Module } from '@nestjs/common';
import { WalletSearcherService } from './wallet-searcher.service';
import { AppConfigModule } from '../app.config';
import { ZerionApiModule } from '../zerion-api/zerion-api.module';
import { WalletModule } from '../wallet/wallet.module';
import { ProcessingWalletsModule } from '../processing-wallets/processing-wallets.module';
import { EtherscanApiModule } from '../etherscan-api/etherscan-api.module';

@Module({
  imports: [
    AppConfigModule,
    ZerionApiModule,
    WalletModule,
    ProcessingWalletsModule,
    EtherscanApiModule,
  ],
  controllers: [],
  providers: [WalletSearcherService],
  exports: [WalletSearcherService],
})
export class WalletSearcherModule {}
