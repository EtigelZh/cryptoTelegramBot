import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FungibleEntity } from "./fungible.entity";
import { FungibleService } from "./fungible.service";
import { FungibleConsumer, fungibleQueueName } from "./fungible.consumer";
import { BullModule } from "@nestjs/bull";
import { FungibleConsumerApiService } from "./fungible-consumer-api.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([FungibleEntity]),
        BullModule.registerQueue({
            name: fungibleQueueName,
            defaultJobOptions: {
                removeOnComplete: true,
            }
        }),
    ],
    providers: [FungibleService, FungibleConsumerApiService, FungibleConsumer],
    exports: [FungibleService, FungibleConsumerApiService]
})
export class FungibleModule {
}