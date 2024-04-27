import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FungibleEntity } from "./fungible.entity";
import { FungibleService } from "./fungible.service";
import { FungibleConsumer, fungibleQueueName } from "./fungible.consumer";
import { BullModule } from "@nestjs/bull";

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
    providers: [FungibleService, FungibleConsumer],
    exports: [FungibleService]
})
export class FungibleModule {
}