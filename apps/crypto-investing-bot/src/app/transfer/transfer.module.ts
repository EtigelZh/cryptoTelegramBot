import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TransferEntity } from "./transfer.entity";
import { TransferService } from "./transfer.service";
import { FungibleModule } from "../fungible/fungible.module";
import { BullModule } from "@nestjs/bull";
import { transferQueueName } from "./transfer.queue";
import { TransferConsumer } from "./transfer.consumer";

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
    providers: [TransferService, TransferConsumer],
    exports: [TransferService]
})
export class TransferModule {
}