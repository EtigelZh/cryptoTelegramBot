export class ZerionApiLimitReachedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZerionApiLimitReachedError';
  }
}
