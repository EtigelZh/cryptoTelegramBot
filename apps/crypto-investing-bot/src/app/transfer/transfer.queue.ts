import type { ZerionTransaction } from "../zerion-api/zerion-api.models";
import type { TransferEntity } from "./transfer.entity";

export const transferQueueName = 'transfer';

export type TransferQueueMethod = CreateTransfersFromZerionTransaction;

export enum TransferQueueMethods {
    createTransfersFromZerionTransaction = 'createTransfersFromZerionTransaction',

}

export type CreateTransfersFromZerionTransaction = {
    name: TransferQueueMethods.createTransfersFromZerionTransaction,
    data: ZerionTransaction[];
    result: TransferEntity[];
}