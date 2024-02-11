import { Injectable } from '@nestjs/common';
import { GoogleConnectorService } from './google-connector/google-connector.service';

@Injectable()
export class GoogleSheetsService {

  constructor(private connector: GoogleConnectorService) {
  }

  async copySpreadsheet(spreadsheetId: string, destinationFolderId?: string): Promise<string> {
    try {
      const drive = this.connector.getDriveConnect();
      const copyRequest = await drive.files.copy({
        fileId: spreadsheetId,
        requestBody: {
          parents: destinationFolderId ? [destinationFolderId] : undefined,
          // Можно указать дополнительные параметры, например, имя нового файла
        },
      });

      return copyRequest.data.id; // Возвращает ID скопированного файла
    } catch (error) {
      console.error('The API returned an error: ' + error);
      throw new Error('Failed to copy spreadsheet');
    }
  }
}
