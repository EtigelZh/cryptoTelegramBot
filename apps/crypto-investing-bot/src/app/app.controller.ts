import { Controller, Get, Param, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { OutgoingMessage } from 'http';
import { ZerionApiService } from './zerion-api.service';
import { XlsxService } from './xlsx.service';
type Response = OutgoingMessage & { set: (data: unknown) => unknown, send: (data: unknown) => unknown };
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    ) {}

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
