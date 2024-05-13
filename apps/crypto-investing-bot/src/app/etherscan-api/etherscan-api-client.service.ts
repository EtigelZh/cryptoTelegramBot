import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { AppConfig } from '../app.config';
import { EthTransaction } from './etherscan-api.models';

@Injectable()
export class EtherscanApiClientService {

  constructor(
    private _appConfig: AppConfig,
  ) {}
  private readonly ETHERSCAN_API_URL = 'https://api.etherscan.io/api';

  async fetchTransactions<T = EthTransaction>(walletAddress: string, action = 'txlist', take = 1000, startblock = 0): Promise<T[]> {
    const page = 1;
    // TODO реализовать пагинацию, сейчас максимум 10к транзакций за 1 запрос
    const offset = Math.min(10000, take);
    const response = await axios.get(`${this.ETHERSCAN_API_URL}`, {
      params: {
        module: 'account',
        action,
        address: walletAddress,
        startblock,
        endblock: 99999999,
        page,
        offset,
        sort: 'desc',
        apikey: this._appConfig.etherscanApiKey
      }
    });
    if (response.data.status !== "1") {
      throw new Error(response.data.message);
    }
    return response.data.result;
  }

}
