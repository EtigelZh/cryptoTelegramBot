import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DexTransactionEntity } from './dex-transaction.entity';
import { LessThan, Repository } from 'typeorm';
import { DexTransactionEconomics } from '../eth-transactions-watcher-logic/domain-logic/handle-swap';

@Injectable()
export class DexTransactionService {
  constructor(
    @InjectRepository(DexTransactionEntity)
    private readonly dexTransactionRepository: Repository<DexTransactionEntity>
  ) {}

  saveDexTransaction(
    blockNumber: number,
    txHash: string,
    walletHash: string,
    economics: DexTransactionEconomics,
    messageText: string,
  ): Promise<DexTransactionEntity> {
    const computedHash = `${blockNumber}-${txHash}-${walletHash}-${economics.action}-${economics.tokenAddress}-${economics.amountToken}-${economics.amountWETH}`;
    const newDexTransaction = this.dexTransactionRepository.create({
      blockNumber: Number(blockNumber),
      computedHash,
      transactionHash: txHash,
      wallet: { hash: walletHash },
      action: economics.action,
      tokenAddress: economics.tokenAddress,
      economics,
      message: { text: messageText },
    });
    return this.dexTransactionRepository.save(newDexTransaction);
  }

  findPreviousTransactions(
    walletHash: string,
    tokenAddress: string,
    blockNumber: number
  ): Promise<DexTransactionEntity[]> {
    return this.dexTransactionRepository.find({
      where: {
        wallet: { hash: walletHash },
        tokenAddress,
        blockNumber: LessThan(blockNumber),
      },
      order: { blockNumber: 'DESC', id: 'DESC' },
    });
  }
}
