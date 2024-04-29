import { Injectable } from "@nestjs/common";
import { TransactionEntity } from "./transaction.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ZerionTransaction } from "../zerion-api/zerion-api.models";
import { TransferService } from "../transfer/transfer.service";
import { calculateInOutTransferByZerionTransaction } from "../utils/pure-calculations";
import { captureException } from "@sentry/node";

@Injectable()
export class TransactionService {
    constructor(
        @InjectRepository(TransactionEntity) private _transactionRepository: Repository<TransactionEntity>,
        private _transferService: TransferService,
    ) {}

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
                feeCurrency: zerionTransaction.attributes.fee.fungible_info.symbol,
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
        this._transferService.createTransfersFromZerionTransaction(zerionTransactions).catch(err => captureException(err, { tags: { source: 'TransactionService.createNotExistZerionTransactions', call: 'TransferService.createTransfersFromZerionTransaction' }}));
        return this._transactionRepository.save(transactions);
    }
    
}