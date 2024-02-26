import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './app.config';
import { TelegrafModule } from './telegraf/telegraf.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AppConfigModule, TelegrafModule.forRootAsync(),  HealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
