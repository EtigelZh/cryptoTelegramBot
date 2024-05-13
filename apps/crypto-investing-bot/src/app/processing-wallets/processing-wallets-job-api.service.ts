import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { walletQueueName } from './processing-wallets.consumer';
import { ZerionApiLimitReachedError } from '../error-handling/custom-errors';
import { ZerionApiService } from '../zerion-api/zerion-api.service';
import { LongTermProcessingWalletsService } from './long-term-processing-wallets.service';
import { Cron } from '@nestjs/schedule';
import { captureException } from '@sentry/node';
import { ProcessingWalletArguments } from './processing-wallet.models';
import { AppConfig } from '../app.config';
import { AnalyticsService, Metric } from '../analytics/analytics.service';

@Injectable()
export class ProcessingWalletsJobApiService {
  constructor(
    @InjectQueue(walletQueueName) private _processingWalletQueue: Queue,
    private _zerionApiService: ZerionApiService,
    private _longTermProcessingWalletsService: LongTermProcessingWalletsService,
    private _appConfig: AppConfig,
    private _analyticsService: AnalyticsService,
  ) {
    this._resumeQueueIfPaused();
  }

  async addToLongTermProcessingQueue(walletHash: string, walletArguments: ProcessingWalletArguments) {
    return await this._longTermProcessingWalletsService.createLongTermProcessingWalletTask(walletArguments.walletHash, walletArguments);
  }

  async processWallet(walletArguments: ProcessingWalletArguments) {
    const waitingCount = await this._processingWalletQueue.getWaitingCount();
    if (waitingCount > (this._appConfig.thresholdForLongTermProcessing)) {
      Logger.log(`Hash ${walletArguments.walletHash} Moving to long term queue`);
      await this.addToLongTermProcessingQueue(walletArguments.walletHash, walletArguments);
      return;
    }

    if (walletArguments.apiKeyQueueName === 'manual') {
      const { manualLimitReached, updateLimitReached } = this._getLimits();
      // Пытаемся использовать updating api calls, если manual api calls закончились
      if (manualLimitReached && !updateLimitReached) {
        walletArguments.apiKeyQueueName = 'updating';
      } else if (manualLimitReached && updateLimitReached) {
        // Если оба лимита исчерпаны, то приостанавливаем обработку
        await this._processingWalletQueue.pause();
        await this.addToLongTermProcessingQueue(walletArguments.walletHash, walletArguments);
        return;
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
      return await job.finished().finally(() => this._analyticsService.incrementMetric(Metric.processedWallets).catch(error => {
        Logger.error(`Error incrementing metric: ${error.message}`);
        captureException(error);
      }));
    } catch (error) {
      if (error instanceof ZerionApiLimitReachedError) {
        await this._processingWalletQueue.pause();
        await this.addToLongTermProcessingQueue(walletArguments.walletHash, walletArguments);
      } else {
        throw error;
      }
    }
  }

  private _getLimits() {
    const manualLimits = this._zerionApiService.getRequestLimits('manual');
    const updateLimits = this._zerionApiService.getRequestLimits('updating');
    const manualLimitReached = manualLimits.used >= manualLimits.limit;
    const updateLimitReached = updateLimits.used >= updateLimits.limit;

    return { manualLimitReached, updateLimitReached, manualLimits, updateLimits, allLimitsReached: manualLimitReached && updateLimitReached };
  }

  /**
   * Раз в минуту смотрим загружена ли очередь, если нет - добавляем задачи из long term
   * */
  @Cron(AppConfig.longTermProcessingCron)
  async calculateNextBatchOfLongTermWallets() {
    const { allLimitsReached } = this._getLimits();
    if (allLimitsReached) {
      Logger.log('All limits reached, skipping');
      return;
    }
    const waitingCount = await this._processingWalletQueue.getWaitingCount();
    if (waitingCount > this._appConfig.longTermProcessingBatchSize) {
      Logger.log(`Waiting count is more than ${this._appConfig.longTermProcessingBatchSize}, skipping`);
      return;
    }
    const tasks = await this._longTermProcessingWalletsService.getBatchForProcessing();
    if (!tasks.length) {
      Logger.log('No tasks to process');
      return;
    }

    Logger.log('Calculating next batch of long term wallets');
    for (const task of tasks) {
      this.processWallet({
        ...task.taskArguments,
        walletHash: task.walletHash,
        longTermTaskId: task.id
      }).catch( (err) => {
        Logger.error(err);
        captureException(err);
      });
    }
    this._resumeQueueIfPaused();
  }

  private _resumeQueueIfPaused() {
    this._processingWalletQueue.isPaused().then((paused) => {
      const { allLimitsReached } = this._getLimits();
      if (paused && !allLimitsReached) {
        this._processingWalletQueue.resume();
      }
    });
  }
}
