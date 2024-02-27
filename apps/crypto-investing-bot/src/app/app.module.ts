import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfig, AppConfigModule } from './app.config';
import { HealthModule } from './health/health.module';
import { BullModule } from '@nestjs/bull';


@Module({
  imports: [
    AppConfigModule,
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (appConfig: AppConfig) => appConfig.getBullConfig(),
      inject: [AppConfig],
    }),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
