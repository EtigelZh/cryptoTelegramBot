import { Inject, Injectable } from '@nestjs/common';
import GoogleSheetConnectorDto from './dto/google-sheet-connector.dto';
import { google, sheets_v4, drive_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';

@Injectable()
export class GoogleConnectorService {

  private readonly SCOPE_SPREADSHEETS: string;
  private readonly _jwtClient: JWT;

  constructor(
    @Inject('GOOGLE_SHEET_CONNECTOR')
    private readonly _credentials: GoogleSheetConnectorDto
  ) {
    this.SCOPE_SPREADSHEETS = 'https://www.googleapis.com/auth/spreadsheets';
    this._jwtClient = this.getClient();
  }

  public getSheetConnect(): sheets_v4.Sheets {
    return google.sheets({ version: 'v4', auth: this._jwtClient });
  }

  public getDriveConnect(): drive_v3.Drive {
    return google.drive({ version: 'v4', auth: this._jwtClient });
  }

  private getClient() {
    const { client_email: email, private_key: key } = this._credentials;

    return new google.auth.JWT({
      email,
      key,
      scopes: [this.SCOPE_SPREADSHEETS],
    });
  }

}
