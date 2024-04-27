import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { CreateTransfersFromZerionTransaction, TransferQueueMethods, transferQueueName } from "./transfer.queue";

@Injectable()
export class TransferService {
    constructor(@InjectQueue(transferQueueName) private _transferQueue: Queue) {}

    async createTransfersFromZerionTransaction(transaction: CreateTransfersFromZerionTransaction['data']): Promise<CreateTransfersFromZerionTransaction['result']> {
        const job = await this._transferQueue.add(TransferQueueMethods.createTransfersFromZerionTransaction, transaction);
        return job.finished();
    }
}