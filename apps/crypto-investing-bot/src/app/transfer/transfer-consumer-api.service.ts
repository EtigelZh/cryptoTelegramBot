import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { CreateTransfersFromZerionTransaction, TransferQueueMethods, transferQueueName } from "./transfer.queue";
import { Queue } from "bull";

@Injectable()
export class TransferConsumerApiService {
    constructor(@InjectQueue(transferQueueName) private _transferQueue: Queue) {}

    async createTransfersFromZerionTransaction(transaction: CreateTransfersFromZerionTransaction['data']): Promise<CreateTransfersFromZerionTransaction['result']> {
        const job = await this._transferQueue.add(TransferQueueMethods.createTransfersFromZerionTransaction, transaction);
        return job.finished();
    }
}