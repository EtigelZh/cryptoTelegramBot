import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfig } from './app.config';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, AppConfig],
    }).compile();
  });

  describe('getData', () => {
    it('should return "Welcome to crypto-investing-bot-api!"', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController.getData()).toEqual({
        message: 'Welcome to crypto-investing-bot-api!',
      });
    });
  });
});
