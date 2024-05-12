import { Injectable } from '@nestjs/common';
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

@Injectable()
export class GoogleSheetsJobApiService {

  constructor(
    private _appConfig: AppConfig,
    @InjectQueue(googleSheetsApiQueueName) private _googleSheetsQueue: Queue,
  ) {
  }

  async getOldWallets(numberOfWalletsToUpdate: number, spreadsheetId: string = this._appConfig.summaryWalletsSheetId) {
    const job = await this._googleSheetsQueue.add(
      'getOldWallets',
      <GetOldWalletsArgs>{
        spreadsheetId,
        numberOfWalletsToUpdate,
      },
      { removeOnComplete: true }
    );
    return await job.finished();
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
    });
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
    });
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
    return job.finished();
  }
}
