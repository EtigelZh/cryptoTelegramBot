import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { CsvProcessingResponse } from './zerion-api.service';

async function insertCsvDataIntoXlsxSheet(
  csvData: CsvProcessingResponse
): Promise<Buffer> {
  // Создание новой книги
  const workbook = XLSX.utils.book_new();

  // Преобразование всех данных CSV в формат, совместимый с XLSX, один раз
  const rows = csvData.data.map((row) => row.split('\t'));
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Добавление листа в книгу
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  // Генерация бинарных данных XLSX
  const xlsxBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer',
    cellStyles: true,
  });

  return xlsxBuffer;
}

@Injectable()
export class XlsxService {
  addDataToWalletParser(data: CsvProcessingResponse): Promise<Buffer> {
    try {
      return insertCsvDataIntoXlsxSheet(data);
    } catch (e) {
      console.error(e);
      throw new Error('Failed to insert data into XLSX');
    }
  }
}