import { Injectable, Logger } from '@nestjs/common';
import {
  CreateOrUpdateWalletArgs,
  FillFinanceDataFromSheetsArgs,
  GetOldWalletsArgs,
  googleSheetsApiQueueName,
  UpdateSheetValuesArgs
} from './google-sheets.consumer';
import { AppConfig } from '../../app.config';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { FinanceData } from './google-sheets.models';
import { AnalyticsService, Metric } from '../../analytics/analytics.service';
import { captureException } from '@sentry/node';
import { ErrorHandlingService } from '../../error-handling/error-handling-service';

@Injectable()
export class GoogleSheetsJobApiService {

  constructor(
    private _appConfig: AppConfig,
    @InjectQueue(googleSheetsApiQueueName) private _googleSheetsQueue: Queue,
    private _analyticsService: AnalyticsService
  ) {
  }

  async getOldWallets(numberOfWalletsToUpdate: number, spreadsheetId: string = this._appConfig.summaryWalletsSheetId) {
    const job = await this._googleSheetsQueue.add(
      'getOldWallets',
      <GetOldWalletsArgs>{
        spreadsheetId,
        numberOfWalletsToUpdate
      },
      { removeOnComplete: true }
    );
    return await job.finished().finally(() => this._analyticsService.incrementMetric(Metric.googleSheetsRequests).catch(error => {
      ErrorHandlingService.handleError({ error, message: `Error incrementing metric` });
    }));
  }

  async updateSheetValues(
    spreadsheetId: string,
    range: string,
    valueInputOption: 'USER_ENTERED' | 'RAW',
    requestBody: unknown
  ) {
    return await this._googleSheetsQueue.add('sheetValuesUpdate', <
      UpdateSheetValuesArgs
      >{
      spreadsheetId,
      range,
      valueInputOption,
      requestBody
    }).finally(() => this._analyticsService.incrementMetric(Metric.googleSheetsRequests).catch(error => {
      ErrorHandlingService.handleError({ error, message: `Error incrementing metric` });
    }));
  }

  async updateOrAddWallet(
    walletHash: string,
    summary7days: FinanceData | null,
    summary30days: FinanceData | null,
    error?: [string, 'HTTP_400' | 'HTTP' | 'OTHER']
  ) {
    return await this._googleSheetsQueue.add('createOrUpdateWallet', <
      CreateOrUpdateWalletArgs
      >{
      spreadsheetId: this._appConfig.summaryWalletsSheetId,
      walletHash,
      walletData: [summary7days, summary30days],
      error
    }).finally(() => this._analyticsService.incrementMetric(Metric.googleSheetsRequests).catch(error => {
      ErrorHandlingService.handleError({ error, message: `Error incrementing metric` });
    }));
  }

  async fillFinanceDataFromSheets(
    spreadsheetId: string,
    walletHash: string,
    sheetName: string
  ): Promise<FinanceData> {
    const job = await this._googleSheetsQueue.add('fillFinanceDataFromSheets', <
      FillFinanceDataFromSheetsArgs
      >{
      spreadsheetId,
      walletHash,
      sheetName
    });
    return job.finished().finally(() => this._analyticsService.incrementMetric(Metric.googleSheetsRequests).catch(error => {
      ErrorHandlingService.handleError({ error, message: `Error incrementing metric` });
    }));
  }
}
