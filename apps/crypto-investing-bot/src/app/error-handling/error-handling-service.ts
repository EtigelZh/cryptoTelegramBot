import { Injectable, Logger } from '@nestjs/common';
import { captureException } from '@sentry/node';

export type ErrorContainer = {
  error: Error;
  chatId?: number;
  message?: string;
}

@Injectable()
export class ErrorHandlingService {
  private static _errorsCount = 0;
  private readonly _errors: ErrorContainer[] = [];

  static handleError(errorContainer: ErrorContainer): void {
    ErrorHandlingService._errorsCount++;
    Logger.error(`Error: ${errorContainer.error.message} chatId: ${errorContainer.chatId} message: ${errorContainer.message}`);
    captureException(errorContainer.error);
  }

  getErrors(): ErrorContainer[] {
    return Array.from(this._errors);
  }

  getErrorsReport(): string {
    // TODO implement it counts errors by type
    return `${this._errors.length}`;
  }

  static getErrorsCount(): number {
    return ErrorHandlingService._errorsCount;
  }
}
