import { Injectable, Logger } from '@nestjs/common';
import { TransactionEntity } from "./transaction.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { ZerionTransaction } from "../zerion-api/zerion-api.models";
import { TransferService } from "../transfer/transfer.service";
import { calculateInOutTransferByZerionTransaction } from "../utils/pure-calculations";
import { captureException } from "@sentry/node";
import { ErrorHandlingService } from '../error-handling/error-handling-service';

@Injectable()
export class TransactionService {
    constructor(
        @InjectRepository(TransactionEntity) private _transactionRepository: Repository<TransactionEntity>,
        private _transferService: TransferService,
    ) {}

    getTransactionsByWallet(walletHash: string, lastTransactionDate: Date): Promise<TransactionEntity[]> {
      return this._transactionRepository.find({
        where: [
          { from: walletHash, date: LessThan(lastTransactionDate), zerionSource: Not(IsNull()) },
          { to: walletHash, date: LessThan(lastTransactionDate), zerionSource: Not(IsNull()) }
        ],
        take: 1000,
        order: { date: 'DESC' },
      });
    }

    async getLastReceivedTransactionDate(walletHash: string): Promise<number> {
      const result =  this._transactionRepository.createQueryBuilder('transaction')
        .select('MAX(transaction.date)')
        .where('transaction.to = :walletHash', { walletHash })
        .andWhere('transaction.transaction_type = :transactionType', { transactionType: 'receive' })
        .getRawOne();
      return +(result['max'] || 0);
    }

    createNotExistZerionTransactions(zerionTransactions: ZerionTransaction[]): Promise<TransactionEntity[]> {
        const transactions: Partial<TransactionEntity>[] = zerionTransactions.map(zerionTransaction => {
            const data = calculateInOutTransferByZerionTransaction(zerionTransaction)
            const transaction = {
                id: zerionTransaction.attributes.hash,
                from: zerionTransaction.attributes.sent_from,
                to: zerionTransaction.attributes.sent_to,

                date: new Date(zerionTransaction.attributes.mined_at),
                blockNumber: zerionTransaction.attributes.mined_at_block,
                nonce: zerionTransaction.attributes.nonce,

                status: zerionTransaction.attributes.status,
                transactionType: zerionTransaction.attributes.operation_type,

                fee: +zerionTransaction.attributes.fee.quantity.numeric,
                feeCurrency: zerionTransaction.attributes.fee.fungible_info?.symbol || '',
                feeUsd: zerionTransaction.attributes.fee.value,
                feeUsdRate: zerionTransaction.attributes.fee.price,

                chain: zerionTransaction.relationships.chain.data.id,
                app: zerionTransaction.relationships?.dapp?.data?.id,

                // InOutTransactionFields
                ...data,

                zerionId: zerionTransaction.id,
                zerionSource: zerionTransaction,
            } as TransactionEntity;

            return transaction;
        });
        this._transferService.createTransfersFromZerionTransaction(zerionTransactions).catch(error => {
          ErrorHandlingService.handleError({ error, message: `TransferService.createTransfersFromZerionTransaction` });
        });
        return this._transactionRepository.save(transactions);
    }

}
