import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { TelegramBotLogicModule } from '../telegram-bot-logic/telegram-bot-logic.module';
import { TelegramDexReporterModule } from "../telegram-dex-reporter/telegram-dex-reporter.module";

@Module({
    imports: [
        TelegramBotLogicModule,
        TelegramDexReporterModule,
    ],
    providers: [HealthService],
    controllers: [HealthController]
})
export class HealthModule {

}
