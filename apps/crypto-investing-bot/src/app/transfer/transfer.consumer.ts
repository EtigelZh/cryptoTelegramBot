import { Process, Processor } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransferEntity } from './transfer.entity';
import { Job } from 'bull';
import { FungibleService } from '../fungible/fungible.service';
import {
  CreateTransfersFromZerionTransaction,
  TransferQueueMethods,
  transferQueueName,
} from './transfer.queue';

@Processor({
  name: transferQueueName,
})
export class TransferConsumer {
  constructor(
    @InjectRepository(TransferEntity)
    private _transferRepository: Repository<TransferEntity>,
    private _fungibleService: FungibleService
  ) {}

  @Process(TransferQueueMethods.createTransfersFromZerionTransaction)
  async createTransfersFromZerionTransaction(
    job: Job<CreateTransfersFromZerionTransaction['data']>
  ): Promise<CreateTransfersFromZerionTransaction['result']> {
    const transaction = job.data;
    const transfers = transaction.attributes.transfers.map((zerionTransfer) => {
      const transfer = {
        transactionId: transaction.id,
        from: zerionTransfer.sender,
        to: zerionTransfer.recipient,
        direction: zerionTransfer.direction,
        transactionDate: new Date(transaction.attributes.mined_at),
        blockNo: transaction.attributes.mined_at_block,

        amount: +zerionTransfer.quantity.numeric, // TODO подумать возможно приведение к числу плохая идея
        amountCurrency: zerionTransfer.fungible_info.symbol,
        amountUsd: zerionTransfer.value,
        amountUsdRate: zerionTransfer.price,

        quantity: zerionTransfer.quantity,
      } as TransferEntity;
      this._fungibleService
        .addZerionFundIfNotExits(zerionTransfer.fungible_info)
        .catch(console.error);
      return transfer;
    });

    return await this._transferRepository.save(transfers);
  }
}
