import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { TelegramBotLogicModule } from '../telegram-bot-logic/telegram-bot-logic.module';

@Module({
    imports: [
        TelegramBotLogicModule,
    ],
    providers: [HealthService],
    controllers: [HealthController]
})
export class HealthModule {

}
