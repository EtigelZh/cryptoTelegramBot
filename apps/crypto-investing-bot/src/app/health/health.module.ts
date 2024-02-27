import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { TelegrafModule } from "../telegraf/telegraf.module";

@Module({
    imports: [
        TelegrafModule.register(),
    ],
    providers: [HealthService],
    controllers: [HealthController]
})
export class HealthModule {

}