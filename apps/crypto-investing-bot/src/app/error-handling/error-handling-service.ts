import { Injectable } from '@nestjs/common';

export type ErrorContainer = {
  error: Error;
  chatId: number;
  message: string;
}

@Injectable()
export class ErrorHandlingService {
  private readonly _errors: ErrorContainer[] = [];
  private errorsCount = 0;
  handleError(errorContainer: ErrorContainer): void {
    this.errorsCount++;
    if (this._errors.length < 100) {
      this._errors.push(errorContainer);
    }
  }

  getErrors(): ErrorContainer[] {
    return Array.from(this._errors);
  }

  getErrorsReport(): string {
    // counts errors by type
    return `${this._errors.length}`;
  }

  getErrorsCount(): number {
    return this.errorsCount;
  }
}
