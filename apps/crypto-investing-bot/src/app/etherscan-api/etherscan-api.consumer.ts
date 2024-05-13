import { EtherscanApiClientService } from './etherscan-api-client.service';
import { Process, Processor } from '@nestjs/bull';
import { FetchTransactionsArguments } from './etherscan-api.models';
import { Job } from 'bull';

export const etherscanApiQueueName = 'etherscan-api';

@Processor({
  name: etherscanApiQueueName,
})
export class EtherscanApiConsumer {
  constructor(private _etherscanApiClientService: EtherscanApiClientService){}

  @Process('fetchTransactions')
  async fetchTransactions(job: Job<FetchTransactionsArguments>) {
    return this._etherscanApiClientService.fetchTransactions(job.data.walletAddress, job.data.action, job.data.take);
  }
}
