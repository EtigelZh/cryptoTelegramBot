import { Injectable } from "@nestjs/common";
import * as XLSX from 'xlsx';
import { walletParser } from "./wallet-parser.base64-xslx";
import { CsvProcessingResponse } from "./zerion-api.service";

async function insertCsvDataIntoXlsxSheet(csvData: CsvProcessingResponse): Promise<Buffer> {
    // Загрузка файла XLSX
    const workbook = XLSX.read(walletParser, { type: 'base64', cellStyles: true });
    // Определение последнего листа в книге
    const lastSheetName = workbook.SheetNames[workbook.SheetNames.length - 1];
    const lastSheet: XLSX.WorkSheet = workbook.Sheets[lastSheetName];

    const rows = csvData.data.split('\n').slice(1);
    const csvRows = rows.map(row => row.split('\t'));
    console.log(`ROWS LENGTH`,csvRows.length);
    // Clear rows in last sheet
    const range = XLSX.utils.decode_range(lastSheet['!ref'] as string);
    for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
        const row = XLSX.utils.encode_row(rowNum);
        if (lastSheet[row]) {
            delete lastSheet[row];
        }
    }

    // Определение позиции, с которой начнется добавление данных
    XLSX.utils.sheet_add_aoa(lastSheet, csvRows, { origin: { r: 1, c: 0 }, cellStyles: true});

   
    // Генерация бинарных данных XLSX
    const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', cellStyles: true, compression: true, type: 'buffer' });

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