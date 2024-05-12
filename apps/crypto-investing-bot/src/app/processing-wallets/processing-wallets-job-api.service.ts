import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ProcessingWalletArguments, walletQueueName } from './processing-wallets.consumer';
import { ZerionApiLimitReachedError } from '../error-handling/custom-errors';
import { ZerionApiService } from '../zerion-api/zerion-api.service';

@Injectable()
export class ProcessingWalletsJobApiService {
  constructor(
    @InjectQueue(walletQueueName) private _processingWalletQueue: Queue,
    private _zerionApiService: ZerionApiService,
  ) {}
  // long term queue
  async processWallet(walletArguments: ProcessingWalletArguments) {
    if (walletArguments.apiKeyQueueName === 'manual') {
      const manualLimits = this._zerionApiService.getRequestLimits('manual');
      const updateLimits = this._zerionApiService.getRequestLimits('updating');
      const manualLimitReached = manualLimits.used >= manualLimits.limit;
      const updateLimitReached = updateLimits.used >= updateLimits.limit;
      // Пытаемся использовать updating api calls, если manual api calls закончились
      if (manualLimitReached && !updateLimitReached) {
        walletArguments.apiKeyQueueName = 'updating';
      }
    }

    const job = await this._processingWalletQueue.add(
      'process',
      walletArguments,
      {
        removeOnComplete: true,
        priority: walletArguments.apiKeyQueueName === 'manual' ? 1 : 2 // Ручной пересчет более приоритетный
      }
    );
    try {
      return await job.finished();
    } catch (error) {
      if (error instanceof ZerionApiLimitReachedError) {
        // TODO приостановить long term очередь
      } else {
        throw error;
      }
    }

  }
}
