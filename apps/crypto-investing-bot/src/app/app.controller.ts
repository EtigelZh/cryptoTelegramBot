import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('readiness')
  rediness() {
    return 'OK';
  }

  @Get('liveness')
  liveness() {
    return 'OK';
  }
}
