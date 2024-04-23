import { Process, Processor } from "@nestjs/bull";
import { ZerionApiService } from "./zerion-api.service";
import { Job } from "bull";

export const zerionApiManualQueueName = `zerion-api-manual`;

@Processor({
    name: zerionApiManualQueueName,
})
export class ZerionApiManualConsumer {
    constructor(private _zerionApiService: ZerionApiService) {}

    @Process({
        name: 'makeRequest',
        concurrency: 1,
    })
    async makeRequest(job: Job<{ url: string }>) {
        return this._zerionApiService.fetchTransactionsChunk(job.data.url, 'manual');
    }
}