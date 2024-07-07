import { EtherscanApiClientService } from './etherscan-api-client.service';
import { Process, Processor } from '@nestjs/bull';
import { AccountActionArguments, FetchErc20TransfersByContractArguments, FetchInternalTransactionsByBlockRangeArguments, FetchTransactionsArguments, LogsEtherscanApiParams } from './etherscan-api.models';
import { Job } from 'bull';

export const etherscanApiQueueName = 'etherscan-api';

@Processor({
  name: etherscanApiQueueName,
})
export class EtherscanApiConsumer {
  constructor(private _etherscanApiClientService: EtherscanApiClientService){}

  @Process('fetchTransactions')
  async fetchTransactions(job: Job<AccountActionArguments>) {
    if (this._isFetchTransactionsArguments(job.data)) {
      return this._etherscanApiClientService.fetchTransactions(job.data);
    } else if (this._isFetchErc20TransfersByContractArguments(job.data)) {
      return this._etherscanApiClientService.fetchErc20TransfersByContract(job.data);
    } else if (this._isFetchInternalTransactionsByBlockRangeArguments(job.data)) {
      return this._etherscanApiClientService.fetchInternalTransactionsByBlockRange(job.data);
    } else if (this._isGetLogsArguments(job.data)) {
      return this._etherscanApiClientService.fetchLogsByBlockRangeAndTopics(job.data);
    }
  }

  private _isFetchTransactionsArguments(data: AccountActionArguments): data is FetchTransactionsArguments {
    return data.action === 'txlist';
  }

  private _isFetchErc20TransfersByContractArguments(data: AccountActionArguments): data is FetchErc20TransfersByContractArguments {
    return data.action === 'tokentx';
  }

  private _isFetchInternalTransactionsByBlockRangeArguments(data: AccountActionArguments): data is FetchInternalTransactionsByBlockRangeArguments {
    return data.action === 'txlistinternal';
  }

  private _isGetLogsArguments(data: AccountActionArguments): data is LogsEtherscanApiParams {
    return data.action === 'getLogs';
  }

}
