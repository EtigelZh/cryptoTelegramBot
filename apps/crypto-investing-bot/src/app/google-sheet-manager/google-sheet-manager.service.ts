import { Injectable } from '@nestjs/common';

export type ManagedSheet = {
  sheetId: string;
  sheetList: string;
  keyColumnRange: string;

};

type ManagedSheetKeys = {
  lastFilledRow: number;
}

/**
 * Сервис отвечает за правильну вставку в гугл таблицы
 * Работает с списками элементов с ключем
 * Фичи:
 * 1. Поиск существующего ключа и обновление строки
 * 2. Добавление новой строки
 * 3. Удаление строки
 * 4. Поиск пустой строки для вставки
 */
@Injectable()
export class GoogleSheetManagerService {
  private readonly _managedSheets: (ManagedSheet & ManagedSheetKeys)[] = [];

    async initManagedSheet(managedSheet: ManagedSheet) {
      this._managedSheets.push({
        ...managedSheet,
        lastFilledRow: 0,
      });
    }

    getManagedSheet(sheetId: string): ManagedSheet | undefined {
      return this._managedSheets.find((managedSheet) => managedSheet.sheetId === sheetId);
    }

    getManagedSheets(): ManagedSheet[] {
      return Array.from(this._managedSheets);
    }

    async findRowByKey(sheetId: string, key: string): Promise<number | undefined> {
      const managedSheet = this.getManagedSheet(sheetId);
      if (!managedSheet) {
        return undefined;
      }
    }
}
