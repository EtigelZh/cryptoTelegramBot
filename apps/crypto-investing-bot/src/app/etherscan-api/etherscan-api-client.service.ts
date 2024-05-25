import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { AppConfig } from '../app.config';
import { EthTransaction, EthTransfer } from './etherscan-api.models';

@Injectable()
export class EtherscanApiClientService {

  constructor(
    private _appConfig: AppConfig,
  ) {}
  private readonly ETHERSCAN_API_URL = 'https://api.etherscan.io/api';

  async fetchTransactions<T = EthTransaction>(walletAddress: string, action = 'txlist', take = 1000, startblock = 0): Promise<T[]> {
    const page = 1;
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

  async fetchErc20TransfersByContract(contractAddress: string, startblock = 0, take = 10000): Promise<EthTransfer> {
    // https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2&page=1&offset=10000&startblock=0&endblock=27025780&sort=desc&apikey=YourApiKeyToken

    const page = 1;
    const offset = Math.min(10000, take);
    const response = await axios.get(`${this.ETHERSCAN_API_URL}`, {
      params: {
        module: 'account',
        action: 'tokentx',
        contractAddress,
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
