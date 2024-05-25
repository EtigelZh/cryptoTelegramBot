import { Module } from '@nestjs/common';
import { EtherscanApiClientService } from './etherscan-api-client.service';
import { AppConfigModule } from '../app.config';
import { EtherscanClientJobApiService } from './etherscan-client-job-api.service';
import { EtherscanApiConsumer, etherscanApiQueueName } from './etherscan-api.consumer';
import { BullModule } from '@nestjs/bull';
import { EthTransferModule } from '../eth-transfer/eth-transfer.module';

@Module({
  imports: [
    AppConfigModule,
    EthTransferModule,
    BullModule.registerQueue({
      name: etherscanApiQueueName,
      limiter: { // На бесплатном токене примерно 1 запрос в секунду
        max: 1,
        duration: 1_000
      },
      defaultJobOptions: {
        removeOnComplete: true
      }
    }),
  ],
  providers: [EtherscanApiClientService, EtherscanApiConsumer, EtherscanClientJobApiService],
  exports: [EtherscanClientJobApiService]
})
export class EtherscanApiModule {}
