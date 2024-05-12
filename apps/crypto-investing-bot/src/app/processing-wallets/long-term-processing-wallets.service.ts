import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LongTermProcessingWalletTaskEntity } from './long-term-processing-wallet-task.entity';
import { ProcessingWalletArguments } from './processing-wallet.models';
import { AppConfig } from '../app.config';

@Injectable()
export class LongTermProcessingWalletsService {
  constructor(
    private _appConfig: AppConfig,
    @InjectRepository(LongTermProcessingWalletTaskEntity) private _walletProcessingTaskRepository: Repository<LongTermProcessingWalletTaskEntity>
  ) {
  }

  async createLongTermProcessingWalletTask(walletHash: string, taskArguments: ProcessingWalletArguments, priority = 10, taskName = 'calculate_wallet'): Promise<LongTermProcessingWalletTaskEntity> {
    const existingTask = await this._walletProcessingTaskRepository.findOne({ where: { walletHash, isFinished: false } });
    if (existingTask) {
      return existingTask;
    }
    return this._walletProcessingTaskRepository.save({
      walletHash,
      priority,
      taskName,
      taskArguments,
    });
  }

  async getBatchForProcessing(): Promise<Pick<LongTermProcessingWalletTaskEntity, 'id' | 'walletHash' | 'taskArguments'>[]> {
    // Если задача выполняется более 3 дней - считаем, что она зависла и можем взять ее на обработку еще раз
    const result = await this._walletProcessingTaskRepository.query(`
      WITH updated AS (
        UPDATE long_term_processing_wallet_tasks
        SET started_processing_at = NOW()
        WHERE (started_processing_at IS NULL OR (started_processing_at < NOW() - INTERVAL '3 days' AND is_finished = false))
        AND id IN (
          SELECT id
          FROM long_term_processing_wallet_tasks
          WHERE (started_processing_at IS NULL OR (started_processing_at < NOW() - INTERVAL '3 days' AND is_finished = false))
          ORDER BY priority DESC, created_at ASC
          LIMIT ${this._appConfig.longTermProcessingBatchSize}
          FOR UPDATE
        )
        RETURNING id, wallet_hash, task_arguments
      )
      SELECT id, wallet_hash as "walletHash", task_arguments as "taskArguments"
      FROM updated;
    `);
    Logger.log(`Got ${result.length} tasks for processing ${result.map(({id, walletHash})=> `${id} - ${walletHash}`).join(', ')}`);
    return result;
  }

  async setTaskFinished(taskId: number, result: unknown, errorMessage?: string): Promise<void> {
    await this._walletProcessingTaskRepository
      .createQueryBuilder()
      .update(LongTermProcessingWalletTaskEntity)
      .set({
        taskResult: {
          result: result,
          errorMessage: errorMessage,
        },
        processedAt: () => 'NOW()',  // Using a function to insert a SQL function call
        isFinished: true,
      })
      .where('id = :id', { id: taskId })
      .execute();
  }
}
