import { Injectable, Logger } from '@nestjs/common';

import { Repository } from 'typeorm';
import { FungibleInfo, ZerionTransaction } from '../zerion-api/zerion-api.models';
import { CurrencySymbol } from '../utils/models';
import { FungibleConsumerApiService } from '../fungible/fungible-consumer-api.service';
import { captureException } from '@sentry/node';
import { ErrorHandlingService } from '../error-handling/error-handling-service';

@Injectable()
export class TransferService {
  constructor(
    private _fungibleConsumerApiService: FungibleConsumerApiService
  ) {}

  async createTransfersFromZerionTransaction(
    transactions: ZerionTransaction[]
  ): Promise<void> {
    const fungiblePositions = new Map<CurrencySymbol, FungibleInfo>();

    for (const transaction of transactions) {
      transaction.attributes.transfers.forEach((zerionTransfer) => {
        const erc20Address = zerionTransfer.fungible_info?.implementations?.find( implementation => implementation.chain_id === 'ethereum')?.address || '';
        fungiblePositions[erc20Address] = {
          ...zerionTransfer.fungible_info,
        };
      });
    }

    this._fungibleConsumerApiService.addZerionFundsIfNotExists(Object.values(fungiblePositions)).catch(error => {
        ErrorHandlingService.handleError({ error, message: `TransferService.createTransfersFromZerionTransaction -> FungibleConsumerApiService.addZerionFundsIfNotExists` });
    });
  }
}
