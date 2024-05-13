import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { FinanceData } from './google-sheets.models';
import { GoogleSheetsService } from './google-sheets.service';
import { WalletService } from '../../wallet/wallet.service';
import { ErrorHandlingService } from '../../error-handling/error-handling-service';

export const googleSheetsApiQueueName = 'googleApiQueue';

export type UpdateSheetValuesArgs = {
  spreadsheetId: string;
  range: string;
  valueInputOption: 'USER_ENTERED' | 'RAW';
  requestBody: unknown;
};

export type CreateOrUpdateWalletArgs = {
  spreadsheetId: string;
  walletHash: string;
  walletData: [FinanceData | null, FinanceData | null];
  error: [string, 'HTTP_400' | 'HTTP' | 'OTHER'];
};

export type FillFinanceDataFromSheetsArgs = {
  spreadsheetId: string;
  walletHash: string;
  sheetName: string;
};

export type GetOldWalletsArgs = {
  spreadsheetId: string;
  numberOfWalletsToUpdate: number;
};

type Range = typeof GoogleSheetsService.ranges;

@Processor(googleSheetsApiQueueName)
export class GoogleSheetsConsumer {
  constructor(
    private readonly _googleSheets: GoogleSheetsService,
    private _walletService: WalletService,
  ) {
  }

  @Process({
    name: 'sheetValuesUpdate',
    concurrency: 1
  })
  async updateSheetValues(job: Job<UpdateSheetValuesArgs>) {
    try {
      const sheetsApi = this._googleSheets.getSheetConnect();
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: job.data.spreadsheetId,
        range: job.data.range,
        valueInputOption: job.data.valueInputOption,
        requestBody: job.data.requestBody
      });
    } catch (error) {
      console.error('updateSheetValues error', error);
    }
  }

  /**
   * Обновляет данные кошелька или добавляет новый кошелек в Google Sheets.
   *
   * @param spreadsheetId Идентификатор таблицы.
   * @param walletHash Хеш кошелька для поиска или добавления.
   * @param walletData Данные кошелька для обновления или добавления.
   * @param sheetsApi Google Sheets API клиент.
   */
  @Process({
    name: 'createOrUpdateWallet',
    concurrency: 1
  })
  async createOrUpdateWallet(
    job: Job<CreateOrUpdateWalletArgs>
  ): Promise<void> {
    const { spreadsheetId, walletHash, walletData } = job.data;
    try {
      const sheetsApi = this._googleSheets.getSheetConnect();
      // Чтение данных из листа для поиска кошелька
      const range = 'Лист1'; // Название вашего листа
      const response = await sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range: `${range}!A:B`
      });

      const rows = response.data.values || [];
      let foundRowIndex: number | null = null;

      // Поиск индекса строки с заданным хешем кошелька
      rows.forEach((row, index) => {
        if (row[0] === walletHash) {
          // Предполагается, что хеш кошелька находится в первой колонке
          foundRowIndex = index;
        }
      });

      if (Array.isArray(job.data.error) && job.data.error[1] === 'HTTP_400') {
        await sheetsApi.spreadsheets.values.update({
          spreadsheetId,
          range: `${range}!E${foundRowIndex + 1}`, // Нумерация строк начинается с 1
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              [
                'NOT_TRACKABLE',
                null,
                this._googleSheets.getFormattedCurrentDate()
              ]
            ]
          }
        });
        // TODO Обновить в базе что кошелек NOT_TRACKABLE
        return;
      }

      if (foundRowIndex !== null) {
        // Обновление данных кошелька, если он найден
        await sheetsApi.spreadsheets.values.update({
          spreadsheetId,
          range: `${range}!A${foundRowIndex + 1}`, // Нумерация строк начинается с 1
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [this._googleSheets.mapItems(walletData[0], walletData[1])]
          }
        });
      } else {
        // Добавление нового кошелька, если он не найден
        await sheetsApi.spreadsheets.values.append({
          spreadsheetId,
          range: `${range}!A:BI`, // Допускается использование всего диапазона для добавления
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              this._googleSheets.mapItems(walletData[0], walletData[1], true)
            ]
          }
        });
      }
    } catch (error) {
      ErrorHandlingService.handleError({ error, message: `Create or update wallet error` });
    }
  }

  @Process({
    name: 'getOldWallets',
    concurrency: 1
  })
  async getOldWallets(job: Job<GetOldWalletsArgs>): Promise<string[]> {
    const { spreadsheetId, numberOfWalletsToUpdate } = job.data;

    try {
      const sheetsApi = this._googleSheets.getSheetConnect();
      const range = 'Лист1'; // Название вашего листа
      const response = await sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range: `${range}!A3:G` // Предполагается, что искомые данные находятся в колонках A-C
      });

      const rows = response.data.values || [];

      const lastUpdateDateIndex = 6;
      const walletHashIndex = 0;
      // Преобразование дат и сортировка строк
      const walletsToUpdate = rows
        .filter(
          (row) =>
            typeof row[walletHashIndex] === 'string' &&
            row[walletHashIndex].startsWith('0x') &&
            row[walletHashIndex].length === 42 &&
            row[4] !== 'NOT_TRACKABLE'
        )
        .map((row) => {
          const walletHash = row[walletHashIndex];
          if (!row[lastUpdateDateIndex]) {
            return { walletHash, updateDate: new Date() };
          }
          const [day, month, year] = row[lastUpdateDateIndex].split('.');
          return {
            walletHash,
            updateDate: new Date(`${year}-${month}-${day}`)
          };
        })
        .sort((a, b) => a.updateDate.getTime() - b.updateDate.getTime())
        .map((row) => row.walletHash)
        .slice(0, numberOfWalletsToUpdate); // Выбор N кошельков с самой старой датой обновления

      return walletsToUpdate; // Возвращаем массив кошельков для обновления
    } catch (error) {
      ErrorHandlingService.handleError({ error, message: `selectAndUpdateWallets error` });
      return [];
    }
  }

  @Process({
    name: 'fillFinanceDataFromSheets',
    concurrency: 1
  })
  async fillFinanceDataFromSheets(
    job: Job<FillFinanceDataFromSheetsArgs>
  ): Promise<FinanceData> {
    try {
      const { spreadsheetId, walletHash, sheetName } = job.data;
      const sheetsApi = this._googleSheets.getSheetConnect();

      // Исправленный запрос к API для получения данных из заданных диапазонов
      const batchResponse = await sheetsApi.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: Object.values(GoogleSheetsService.ranges).map(
          (r) => `${sheetName}!${r}`
        )
      });

      // Преобразование полученных данных в объект с ключами для удобного доступа
      const valuesMap = batchResponse.data.valueRanges.reduce(
        (acc, valueRange, index) => {
          const key = Object.keys(GoogleSheetsService.ranges)[index];
          // Проверка на наличие данных в valueRange для избежания ошибок
          acc[key] =
            valueRange.values && valueRange.values[0] && valueRange.values[0][0]
              ? valueRange.values[0][0]
              : null;

          if (
            acc[key] === '#DIV/0!' ||
            acc[key] === '#N/A' ||
            acc[key] === '#NUM!' ||
            acc[key] === '#REF!' ||
            acc[key] === 'NaN'
          ) {
            acc[key] = '';
          }
          return acc;
        },
        {} as Range
      );

      let walletAlias = '';
      try {
        const walletEntity = await this._walletService.getWallet(walletHash);
        walletAlias = walletEntity.alias;
      } catch (error) {
        ErrorHandlingService.handleError({ error, message: `fillFinanceDataFromSheets error` });
      }

      // Заполнение объекта FinanceData с использованием данных из valuesMap
      const data: FinanceData = {
        balance: valuesMap.balance,
        sourceDocumentId: spreadsheetId,
        sourceLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        walletHash,
        walletAlias,
        medianEntry: valuesMap.medianEntry,
        avgLose: valuesMap.avgLose,
        avgWin: valuesMap.avgWin,
        medianPurchaseCount: valuesMap.medianPurchaseCount,
        RR: valuesMap.RR,
        averageEntry: valuesMap.averageEntry,
        medianLose: valuesMap.medianLose,
        medianWin: valuesMap.medianWin,
        tradedCoins: valuesMap.tradedCoins,
        lastTransactionDate: valuesMap.lastTransactionDate,
        tripleTransaction: valuesMap.tripleTransaction,
        lastXDays: valuesMap.lastXDays,
        winRateR: valuesMap.winRateR,
        PLR: valuesMap.PLR,
        averageTermDays: valuesMap.averageTermDays,
        annualYieldR: valuesMap.annualYieldR,
        commissions: valuesMap.commissions,
        winRateTotal: valuesMap.winRateTotal,
        PLTotal: valuesMap.PLTotal,
        riskProfile: valuesMap.riskProfile,
        annualYield: valuesMap.annualYield,
        averageCommission: valuesMap.averageCommission,
        copyTradingThreshold: valuesMap.copyTradingThreshold,
        PLRCT: valuesMap.PLRCT,
        winRateRCT: valuesMap.winRateRCT
      };

      return data;
    } catch (error) {
      ErrorHandlingService.handleError({ error, message: `fillFinanceDataFromSheets error` });
    }
  }
}
