import { Injectable } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets/google-sheets.service';
import { inspect } from 'util';
import { drive_v3 } from 'googleapis';
import { cleanup, getStorageQuota } from './cleanup';

@Injectable()
export class GoogleDriveService {

  constructor(private connector: GoogleSheetsService) {
  }

  async getQuota() {
    const drive = await this.connector.getDriveConnect();
    return getStorageQuota(drive);
  }

  async copySpreadsheet(spreadsheetId: string, name: string, destinationFolderId?: string): Promise<drive_v3.Schema$File> {
    try {
      const drive = this.connector.getDriveConnect();

      const copyRequest = await drive.files.copy({
        fileId: spreadsheetId,
        requestBody: {
          parents: destinationFolderId ? [destinationFolderId] : undefined,
          // Можно указать дополнительные параметры, например, имя нового файла
          name
        },
      });

      return copyRequest.data; // Возвращает ID скопированного файла
    } catch (error) {
      console.error('The API returned an error: ' + inspect(error));
      throw new Error('Failed to copy spreadsheet');
    }
  }

  async cleanup() {
    await cleanup(this.connector.getDriveConnect());
  }
}
