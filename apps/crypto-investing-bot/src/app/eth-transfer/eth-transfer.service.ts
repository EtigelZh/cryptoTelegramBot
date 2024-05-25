import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm"; 
import { EthTransferEntity } from "./eth-transfer.entity";
import { EthInternalTransactionEntity } from "./eth-internal-transaction.entity";
import { EthInternalTransaction, EthTransfer } from "../etherscan-api/etherscan-api.models";
import { ErrorHandlingService } from "../error-handling/error-handling-service";

export type BatchSaveResult = {
    existsCount: number;
    savedCount: number;
    errorsCount: number;
}

@Injectable()
export class EthTransferService {
    constructor(
        @InjectRepository(EthTransferEntity) private readonly _ethTransferRepository: Repository<EthTransferEntity>,
        @InjectRepository(EthInternalTransactionEntity) private readonly _ethInternalTransaction: Repository<EthInternalTransactionEntity>,
    ) {}

    async saveBatchIntervalTransactions(transactions: EthInternalTransaction[]) {
        // filter by unique transaction hash
        const set = new Set(transactions.map(t => t.hash));
        const existingTransactions = await this._ethInternalTransaction.find({
            select: ['hash'],
            where: {
                hash: In(Array.from(set))
            }
        });

        for (const transaction of existingTransactions) {
            set.delete(transaction.hash);
        }

        // TODO подумать как лучше на чанки поделить
        const results = await Promise.allSettled(Array.from(set).map(hash => {
            const transaction = transactions.filter(t => t.hash === hash);
            return this._ethInternalTransaction.save(transaction);
        }));

        const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        if (errors.length > 0) {
            ErrorHandlingService.handleError({ message: `Error saving transactions`, error: Error(errors.map((error) => error.reason).join('\n')) });
        }

        return {
            existsCount: existingTransactions.length,
            savedCount: results.length - errors.length,
            errorsCount: errors.length
        };
    }

    async saveBatchTransfers(transfers: EthTransfer[]): Promise<BatchSaveResult> {
        const set = new Set(transfers.map(t => t.hash));
        const existingTransfers = await this._ethTransferRepository.find({
            select: ['hash'],
            where: {
                hash: In(Array.from(set))
            }
        });

        for (const transfer of existingTransfers) {
            set.delete(transfer.hash);
        }

        const results = await Promise.allSettled(Array.from(set).map(hash => {
            const transfer = transfers.filter(t => t.hash === hash);
            return this._ethTransferRepository.save(transfer);
        }));

        const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        if (errors.length > 0) {
            ErrorHandlingService.handleError({ message: `Error saving transfers`, error: Error(errors.map((error) => error.reason).join('\n')) });
        }

        return {
            existsCount: existingTransfers.length,
            savedCount: results.length - errors.length,
            errorsCount: errors.length
        };

    }

    async findOldestInternalTransactionBlockNumber(): Promise<number> {
        const result = await this._ethInternalTransaction.createQueryBuilder('transaction')
            .select('MIN(transaction.blockNumber)')
            .getRawOne();
        return +(result['min'] || 0);
    }

    async findNewestInternalTransactionBlockNumber(): Promise<number> {
        const result = await this._ethInternalTransaction.createQueryBuilder('transaction')
            .select('MAX(transaction.blockNumber)')
            .getRawOne();
        return +(result['max'] || 0);
    }

    async findOldestTransferBlockNumber(contractAddress: string): Promise<number> {
        const result = await this._ethTransferRepository.createQueryBuilder('transfer')
            .select('MIN(transfer.blockNumber)')
            .where('transfer.contractAddress = :contractAddress', { contractAddress })
            .getRawOne();
        return +(result['min'] || 0);
    }

    async findNewestTransferBlockNumber(contractAddress: string): Promise<number> {
        const result = await this._ethTransferRepository.createQueryBuilder('transfer')
            .select('MAX(transfer.blockNumber)')
            .where('transfer.contractAddress = :contractAddress', { contractAddress })
            .getRawOne();
        return +(result['max'] || 0);
    }

}