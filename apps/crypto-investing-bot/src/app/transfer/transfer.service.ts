import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransferEntity } from './transfer.entity';
import { Repository } from 'typeorm';
import { FungibleInfo, ZerionTransaction } from '../zerion-api/zerion-api.models';
import { CurrencySymbol } from '../utils/models';
import { FungibleConsumerApiService } from '../fungible/fungible-consumer-api.service';
import { captureException } from '@sentry/node';
import { ErrorHandlingService } from '../error-handling/error-handling-service';

@Injectable()
export class TransferService {
  constructor(
    @InjectRepository(TransferEntity)
    private _transferRepository: Repository<TransferEntity>,
    private _fungibleConsumerApiService: FungibleConsumerApiService
  ) {}

  async createTransfersFromZerionTransaction(
    transactions: ZerionTransaction[]
  ): Promise<TransferEntity[]> {
    const transfers: TransferEntity[] = [];
    const fungiblePositions = new Map<CurrencySymbol, FungibleInfo>();

    // TODO поправить проблему с error: duplicate key value violates unique constraint "PK_transfers_from_to_transaction_id"
    for (const transaction of transactions) {
      transfers.push(
        ...transaction.attributes.transfers.map((zerionTransfer) => {
          const transfer = {
            transactionId: transaction.id,
            from: zerionTransfer.sender,
            to: zerionTransfer.recipient,
            direction: zerionTransfer.direction,
            transactionDate: new Date(transaction.attributes.mined_at),
            blockNo: transaction.attributes.mined_at_block,

            amount: +zerionTransfer.quantity.numeric, // TODO подумать возможно приведение к числу плохая идея
            amountCurrency: zerionTransfer.fungible_info?.symbol || '',
            amountUsd: zerionTransfer.value,
            amountUsdRate: zerionTransfer.price,

            quantity: zerionTransfer.quantity,
          } as TransferEntity;
          fungiblePositions[zerionTransfer.fungible_info?.symbol || ''] = {
            ...zerionTransfer.fungible_info,
          };
          return transfer;
        })
      );
    }

    this._fungibleConsumerApiService.addZerionFundsIfNotExists(Object.values(fungiblePositions)).catch(error => {
        ErrorHandlingService.handleError({ error, message: `TransferService.createTransfersFromZerionTransaction -> FungibleConsumerApiService.addZerionFundsIfNotExists` });
    });

    return await this._transferRepository.save(transfers);
  }
}
