import { Inject, Injectable } from '@nestjs/common';
import GoogleSheetConnectorDto from './dto/google-sheet-connector.dto';
import { google, sheets_v4, drive_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';

export type FinanceData = {
  sourceDocumentId: string;
  sourceLink: string;
  walletHash: string;
  medianEntry: string;
  avgLose: string;
  avgWin: string;
  medianPurchaseCount: string;
  RR: string;
  averageEntry: string;
  medianLose: string;
  medianWin: string;
  tradedCoins: string;
  wallet: {
    lastTransactionDate: string;
    tripleTransaction: string;
    lastXDays: string;
    winRateR: string;
    PLR: string;
    averageTermDays: string;
    annualYieldR: string;
    commissions: string;
    winRateTotal: string;
    PLTotal: string;
    riskProfile: string;
    annualYield: string;
    averageCommission: string;
  };
};

const ranges = {
  medianEntry: 'H3', // "Медианный вход"
  avgLose: 'J3', // "Avg lose"
  avgWin: 'L3', // "Avg win"
  medianPurchaseCount: 'N3', // "Медианное кол-во покупок"

  RR: 'F4', // "RR, %"
  averageEntry: 'H4', // "Средний вход"
  medianLose: 'J4', // "Median lose"
  medianWin: 'L4', // "Median win"
  tradedCoins: 'N4', // "Монет проторговано"

  winRateR: 'F5', // "Win Rate R"
  PLR: 'H5', // "P&L R"
  averageTermDays: 'J5', // "Средний срок, д"
  annualYieldR: 'L5', // "Доходность годовых R"
  commissions: 'N5', // "Комиссий"

  lastTransactionDate: 'B6', // "Последняя транзакция"
  tripleTransaction: 'C6', // "Тройная транзакция"
  lastXDays: 'D6', // "Последние 'х' дней"
  winRateTotal: 'F6', // "Win Rate Total"
  PLTotal: 'H6', // "P&L Total"
  riskProfile: 'J6', // "Профиль риска"
  annualYield: 'L6', // "Доходность годовых"
  averageCommission: 'N6', // "Ср.комиссия"
};

type Range = typeof ranges;

@Injectable()
export class GoogleSheetsService {
  private readonly SCOPE_SPREADSHEETS: string;
  private readonly SCOPE_DRIVE: string;
  private readonly _jwtClient: JWT;

  constructor(
    @Inject('GOOGLE_SHEET_CONNECTOR')
    private readonly _credentials: GoogleSheetConnectorDto
  ) {
    this.SCOPE_SPREADSHEETS = 'https://www.googleapis.com/auth/spreadsheets';
    this.SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive';
    this._jwtClient = this.getClient();
  }

  public getSheetConnect(): sheets_v4.Sheets {
    return google.sheets({ version: 'v4', auth: this._jwtClient });
  }

  public getDriveConnect(): drive_v3.Drive {
    return google.drive({ version: 'v3', auth: this._jwtClient });
  }

  private getClient() {
    const { client_email: email, private_key: key } = this._credentials;

    return new google.auth.JWT({
      email,
      key,
      scopes: [this.SCOPE_SPREADSHEETS, this.SCOPE_DRIVE],
    });
  }

  async fillFinanceDataFromSheets(
    spreadsheetId: string,
    walletHash: string,
    sheetName: string,
    sheetsApi: sheets_v4.Sheets
  ): Promise<FinanceData> {
    // Обновлённые диапазоны с учётом начальной точки medianEntry в H3

    // Исправленный запрос к API для получения данных из заданных диапазонов
    const batchResponse = await sheetsApi.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: Object.values(ranges).map((r) => `${sheetName}!${r}`),
    });

    // Преобразование полученных данных в объект с ключами для удобного доступа
    const valuesMap = batchResponse.data.valueRanges.reduce(
      (acc, valueRange, index) => {
        const key = Object.keys(ranges)[index];
        // Проверка на наличие данных в valueRange для избежания ошибок
        acc[key] =
          valueRange.values && valueRange.values[0] && valueRange.values[0][0]
            ? valueRange.values[0][0]
            : null;

        if (acc[key] === '#DIV/0!' || acc[key] === '#NUM!' || acc[key] === '#REF!' || acc[key] === 'NaN') {
          acc[key] = '';
        }
        return acc;
      },
      {} as Range
    );

    // Заполнение объекта FinanceData с использованием данных из valuesMap
    const data: FinanceData = {
      sourceDocumentId: spreadsheetId,
      sourceLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      walletHash,
      medianEntry: valuesMap.medianEntry,
      avgLose: valuesMap.avgLose,
      avgWin: valuesMap.avgWin,
      medianPurchaseCount: valuesMap.medianPurchaseCount,
      RR: valuesMap.RR,
      averageEntry: valuesMap.averageEntry,
      medianLose: valuesMap.medianLose,
      medianWin: valuesMap.medianWin,
      tradedCoins: valuesMap.tradedCoins,
      wallet: {
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
      },
    };

    return data;
  }

  private mapItems(summary7days: FinanceData, summary30days: FinanceData): string[] {
    // Кошелек	Дата анализа	Последняя транзакция	Отслеживать?	Последнее обновление	Монет проторговано	Медианное кол-во покупок	Профиль риска	Доходность годовых, R	Доходность годовых	Средний срок, д	Медианный вход	Средний вход	Ср.комиссия	Win Rate Total	Win Rate R	RR, %	P&L R	P&L Total	Avg loss	Median loss	Avg profit	Median profit	Комиссий всего	Монет проторговано	Медианное кол-во покупок	Профиль риска	Доходность годовых, R	Доходность годовых	Средний срок, д	Медианный вход	Средний вход	Ср.комиссия	Win Rate Total	Win Rate R	RR, %	P&L R	P&L Total	Avg loss	Median loss	Avg profit	Median profit	Комиссий всего
    const now = new Date();
    const lastTransactionDate = new Date(summary7days.wallet.lastTransactionDate || summary30days.wallet.lastTransactionDate || now.toISOString());
    const analyzeDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear().toString().padStart(2, '0')}`;
    
    const lastTransactionDateStr = (typeof summary7days.wallet.lastTransactionDate === 'string' && summary7days.wallet.lastTransactionDate) ? summary7days.wallet.lastTransactionDate : `${lastTransactionDate.getDate().toString().padStart(2, '0')}.${(lastTransactionDate.getMonth() + 1).toString().padStart(2, '0')}.${lastTransactionDate.getFullYear().toString().padStart(2, '0')}`;
    
    return [
      summary7days.walletHash,
      // format dd.mm.yyyy
      analyzeDate,
      lastTransactionDateStr,
      '',
      // format dd.mm.yyyy
      analyzeDate,
      summary7days.tradedCoins.toString(),
      summary7days.medianPurchaseCount.toString(),
      summary7days.wallet.riskProfile.toString(),
      summary7days.wallet.annualYieldR,
      summary7days.wallet.annualYield,
      summary7days.wallet.averageTermDays.toString(),
      summary7days.medianEntry.toString(),
      summary7days.averageEntry.toString(),
      summary7days.wallet.averageCommission.toString(),
      summary7days.wallet.winRateTotal,
      summary7days.wallet.winRateR,
      summary7days.RR,
      summary7days.wallet.PLR,
      summary7days.wallet.PLTotal,
      summary7days.avgLose,
      summary7days.medianLose,
      summary7days.avgWin,
      summary7days.medianWin,
      summary7days.wallet.commissions.toString(),
      summary30days.tradedCoins.toString(),
      summary30days.medianPurchaseCount.toString(),
      summary30days.wallet.riskProfile.toString(),
      summary30days.wallet.annualYieldR,
      summary30days.wallet.annualYield,
      summary30days.wallet.averageTermDays.toString(),
      summary30days.medianEntry.toString(),
      summary30days.averageEntry.toString(),
      summary30days.wallet.averageCommission.toString(),
      summary30days.wallet.winRateTotal,
      summary30days.wallet.winRateR,
      summary30days.RR,
      summary30days.wallet.PLR,
      summary30days.wallet.PLTotal,
      summary30days.avgLose,
      summary30days.medianLose,
      summary30days.avgWin,
      summary30days.medianWin,
      summary30days.wallet.commissions.toString(),
      summary7days.sourceLink,
    ];
  }
  /**
   * Обновляет данные кошелька или добавляет новый кошелек в Google Sheets.
   *
   * @param spreadsheetId Идентификатор таблицы.
   * @param walletHash Хеш кошелька для поиска или добавления.
   * @param walletData Данные кошелька для обновления или добавления.
   * @param sheetsApi Google Sheets API клиент.
   */
  async updateOrAddWallet(
    spreadsheetId: string,
    walletHash: string,
    walletData: [FinanceData, FinanceData],
    sheetsApi: sheets_v4.Sheets
  ): Promise<void> {
    // Чтение данных из листа для поиска кошелька
    const range = 'Лист1'; // Название вашего листа
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range,
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

    if (foundRowIndex !== null) {
      // Обновление данных кошелька, если он найден
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId,
        range: `${range}!A${foundRowIndex + 1}`, // Нумерация строк начинается с 1
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [this.mapItems(walletData[0], walletData[1])],
        },
      });
    } else {
      // Добавление нового кошелька, если он не найден
      await sheetsApi.spreadsheets.values.append({
        spreadsheetId,
        range: `${range}!A:AM`, // Допускается использование всего диапазона для добавления
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [this.mapItems(walletData[0], walletData[1])],
        },
      });
    }
  }
}
