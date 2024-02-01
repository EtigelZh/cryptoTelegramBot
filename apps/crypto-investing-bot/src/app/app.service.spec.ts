import { Test } from '@nestjs/testing';

import { AppService } from './app.service';
import { AppConfig } from './app.config';

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [AppService, AppConfig],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('getData', () => {
    it('should return "Welcome to crypto-investing-bot-api!"', () => {
      expect(service.getData()).toEqual({ message: 'Welcome to crypto-investing-bot-api!' });
    });
  });
});
