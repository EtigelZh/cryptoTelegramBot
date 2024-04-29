import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TransferEntity } from "./transfer.entity";
import { TransferService } from "./transfer.service";
import { FungibleModule } from "../fungible/fungible.module";
import { BullModule } from "@nestjs/bull";
import { transferQueueName } from "./transfer.queue";
import { TransferConsumer } from "./transfer.consumer";
import { TransferConsumerApiService } from "./transfer-consumer-api.service";

@Module({
    imports: [
        FungibleModule,
        TypeOrmModule.forFeature([TransferEntity]),
        BullModule.registerQueue({
            name: transferQueueName,
            defaultJobOptions: {
                removeOnComplete: true,
            }
        }),
    ],
    providers: [TransferService, TransferConsumer, TransferConsumerApiService],
    exports: [TransferService, TransferConsumerApiService]
})
export class TransferModule {
}