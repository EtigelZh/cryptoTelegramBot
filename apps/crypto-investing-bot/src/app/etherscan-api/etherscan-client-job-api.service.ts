import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { etherscanApiQueueName } from './etherscan-api.consumer';
import { Queue } from 'bull';
import { EthInternalTransaction, EthTransaction, EthTransfer, FetchErc20TransfersByContractArguments, FetchTransactionsArguments } from './etherscan-api.models';
import { EthTransferService } from '../eth-transfer/eth-transfer.service';
import { inspect } from 'util';
import { ErrorHandlingService } from '../error-handling/error-handling-service';
import { DexTransaction } from '../utils/models';

@Injectable()
export class EtherscanClientJobApiService {

  constructor(
    @InjectQueue(etherscanApiQueueName) private _etherscanApiQueue: Queue,
    private _ethTransferService: EthTransferService,
  ) {
  }

  async fetchTransactions(jobArguments: FetchTransactionsArguments): Promise<EthTransaction[]> {
    const job = await this._etherscanApiQueue.add('fetchTransactions', jobArguments);
    return await job.finished();
  }

  async getTransferByContractAddress(contractAddress: string, startblock: number, endblock?: number, take = 5): Promise<EthTransfer[]> {
    let page = 1;
    const jobArguments: FetchErc20TransfersByContractArguments = {
      action: 'tokentx',
      contractAddress,
      startblock,
      endblock,
      page: 1,
      offset: take
    };

    const job = await this._etherscanApiQueue.add('fetchTransactions', jobArguments);
    const transfers = await job.finished() as EthTransfer[];
    let hasNextPage = transfers.length === take;
    while (hasNextPage) {
      page++;
      const job = await this._etherscanApiQueue.add('fetchTransactions', {
        ...jobArguments,
        page,
      });
      const newTransfers = await job.finished();
      transfers.push(...newTransfers);
      hasNextPage = newTransfers.length === take;
    }

    try {
      const result = await this._ethTransferService.saveBatchTransfers(transfers);
      Logger.log(`${inspect(result)}`);
    } catch (error) {
      ErrorHandlingService.handleError({error});
    }
    

    return transfers;
  }

  async loadInternalTransactionsByBlockRange(startblock: number, endblock: number): Promise<EthInternalTransaction[]> {
    // Получаем из базы последний блок
    let page = 1;
    const job = await this._etherscanApiQueue.add('fetchTransactions', {
      action: 'txlistinternal',
      startblock,
      endblock,
      page,
    });

    const internalTransactions = (await job.finished()) as EthInternalTransaction[];

    let hasNextPage = internalTransactions.length === 10000;
    while (hasNextPage) {
      page++;
      const job = await this._etherscanApiQueue.add('fetchTransactions', {
        action: 'txlistinternal',
        startblock,
        endblock,
        page,
      });
      const nextPageInternalTransactions = await job.finished();
      internalTransactions.push(...nextPageInternalTransactions);
      hasNextPage = nextPageInternalTransactions.length === 10000;
    }

    try {
      const result = await this._ethTransferService.saveBatchIntervalTransactions(internalTransactions);
      Logger.log(`${inspect(result)}`);
    } catch (error) {
      ErrorHandlingService.handleError({error});
    }

    return internalTransactions;

  }
  async getDexTransactions(contractAddress: string, blockNo: string): Promise<DexTransaction[]> {
    const transfers = await this.getTransferByContractAddress(contractAddress, +blockNo);
    if (transfers.length) {
      return [];
    }
    const startblock = +transfers[transfers.length - 1].blockNumber;
    const endblock = +transfers[0].blockNumber;

    const internalTransactions = await this.loadInternalTransactionsByBlockRange(startblock, endblock);

    const transactionMap: Record<string, {
      transfers: EthTransfer[],
      internalTransactions: EthInternalTransaction[],
    }> = {};

    for (const hash of new Set(transfers.map(({hash})=> hash))) {
      transactionMap[hash] = {
        transfers: transfers.filter( t => t.hash === hash),
        internalTransactions: internalTransactions.filter( it => it.hash === hash),
      };
    }

    const dexTransactions = [] as DexTransaction[];
    for (const [hash, {transfers, internalTransactions}] of Object.entries(transactionMap)) {
      
      const dexTransaction = {
        transactionHash: hash,
         
      } as DexTransaction;

      dexTransactions.push(dexTransaction);
    }
    

    return dexTransactions;
  }

  // 0%, 2.5%, 5%
  //
  //
  /**
   * [0] - Всегда будет покупка нашего чувака, за которым следим
   * endBlockNo - если не задан, то:
   *  - продажи не было
   *  - будет возврашаться 10К транзакций
   *  - если 10К будет отдана последняя транзакция
   */
  async getDexPeriodTransactions(
    contractAddress: string,
    startBlockNo: string,
    endBlockNo?: string
  ): Promise<DexTransaction[]> {
    // TODO
    return []; // Trale by 0$
  }
}
