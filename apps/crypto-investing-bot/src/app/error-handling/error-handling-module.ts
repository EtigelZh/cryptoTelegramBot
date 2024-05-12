import { Module } from '@nestjs/common';
import { ErrorHandlingService } from './error-handling-service';

@Module({
  imports: [],
  controllers: [],
  providers: [ErrorHandlingService],
  exports: [ErrorHandlingService]
})
export class ErrorHandlingModule {}
