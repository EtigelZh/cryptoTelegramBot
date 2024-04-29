import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import {
  CreateTransfersFromZerionTransaction,
  TransferQueueMethods,
  transferQueueName,
} from './transfer.queue';
import { TransferService } from './transfer.service';

@Processor({
  name: transferQueueName,
})
export class TransferConsumer {
  constructor(
    private _transferService: TransferService,
  ) {}

  @Process(TransferQueueMethods.createTransfersFromZerionTransaction)
  async createTransfersFromZerionTransaction(
    job: Job<CreateTransfersFromZerionTransaction['data']>
  ): Promise<CreateTransfersFromZerionTransaction['result']> {
    const transactions = job.data;
    return this._transferService.createTransfersFromZerionTransaction(transactions);
  }
}
