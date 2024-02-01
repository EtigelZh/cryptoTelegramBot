/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

const port = process.env.PORT || 3333;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = '';
  app.setGlobalPrefix(globalPrefix);
  
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  await app.listen(port)
}
bootstrap();