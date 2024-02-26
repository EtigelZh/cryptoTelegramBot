import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller()
export class HealthController {
    constructor(
        private readonly healthService: HealthService,
    ) {}
    @Get('readiness')
    async rediness() {
      await this.healthService.checkBotHealth();
      return 'OK';
    }
  
    @Get('liveness')
    async liveness() {
        await this.healthService.checkBotHealth();
      return 'OK';
    }
}