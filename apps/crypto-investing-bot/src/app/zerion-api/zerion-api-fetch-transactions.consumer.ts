import { InjectQueue, Process, Processor } from "@nestjs/bull";
import { ZerionApiService } from "./zerion-api.service";
import { Job, Queue } from "bull";
import { FungiblePosition, ZerionApiQueueName } from "./zerion-api.models";
import { zerionApiManualQueueName } from "./zerion-api-manual.consumer";
import { zerionApiUpdatingQueueName } from "./zerion-api-updating.consumer";
import { AppConfig } from "../app.config";
import { ErrorHandlingService } from '../error-handling/error-handling-service';

export const zerionApiFetchTransactionsQueueName = `zerion-api-fetch-transactions`;

export type FetchTransactionsJob = {
    walletHash: string;
    apiKeyQueueName: ZerionApiQueueName;
    take?: number;
    messagingInfo?: {
        globalPrefix: string;
        lastApiCallMessageId: number;
        chatId: number;
    };
}

@Processor({
    name: zerionApiFetchTransactionsQueueName,
})
export class ZerionApiFetchTransactionsConsumer {
    constructor(
        private _zerionApiService: ZerionApiService,
        private _errorHandler: ErrorHandlingService,
        @InjectQueue(zerionApiManualQueueName) private _zerionApiManualQueue: Queue,
        @InjectQueue(zerionApiUpdatingQueueName) private _zerionApiUpdatingQueue: Queue,
    ) {}

    @Process({
        name: 'getTransactions',
        concurrency: AppConfig.walletProcessorConcurrency,
    })
    async getTransactions(job: Job<FetchTransactionsJob>) {
        const { walletHash: walletId, take = 0, apiKeyQueueName, messagingInfo } = job.data;

        const transactions = await this._zerionApiService.getTransactions({
            walletHash: walletId,
            take,
            apiKeyQueueName,
            getNextChunk: async (url, apiKeyQueueName) => {
                switch (apiKeyQueueName) {
                    case 'updating': {
                        const job = await this._zerionApiUpdatingQueue.add('makeRequest', { url });
                        try {
                            const result = await job.finished();
                            return result;
                        } catch (error) {
                            if (messagingInfo) {
                              this._errorHandler.handleError({
                                  error,
                                  chatId: messagingInfo.chatId,
                                  message: `Ошибка при скачивании транзакций: ${error}`
                              });
                            }
                            throw error;
                        }
                    }
                    default:
                    case 'manual': {
                        const job = await this._zerionApiManualQueue.add('makeRequest', { url });
                        try {
                            const result = await job.finished();
                            return result;
                        } catch (error) {
                            if (messagingInfo) {
                              this._errorHandler.handleError({
                                  error,
                                  chatId: messagingInfo.chatId,
                                  message: `Ошибка при скачивании транзакций: ${error}`
                              });
                            }
                            throw error;
                        }
                    }
                }
            },
        });

        return transactions;
    }

    @Process({
        name: 'getFungiblePositionsCsv'
    })
    async getFungiblePositionsCsv(job: Job<FetchTransactionsJob>) {
        const { walletHash, take = 0, apiKeyQueueName} = job.data;

        const fungiblePositions = await this._zerionApiService.getTransactions<FungiblePosition>({
            walletHash,
            take,
            urlTemplate: (walletId) =>
                `https://api.zerion.io/v1/wallets/${walletId}/positions/?currency=usd&filter%5Btrash%5D=only_non_trash&sort=value`,
            apiKeyQueueName,
            getNextChunk: async (url, apiKeyQueueName) => {
                switch (apiKeyQueueName) {
                    case 'updating': {
                        const job = await this._zerionApiUpdatingQueue.add('makeRequest', { url });
                        return await job.finished();
                    }
                    default:
                    case 'manual': {
                        const job = await this._zerionApiManualQueue.add('makeRequest', { url });
                        return await job.finished();
                    }
                }
            },
        });
        return this._zerionApiService.convertFungiblePositionsToCsvEntries(fungiblePositions.data);
    }
}
