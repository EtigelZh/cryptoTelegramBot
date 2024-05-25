import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { AppConfig } from '../app.config';
import { AccountActionCommonArguments, EthTransaction, EthTransfer } from './etherscan-api.models';

type AccountEtherscanApiParams = {
  address?: string;
  contractAddress?: string;
} & AccountActionCommonArguments;

@Injectable()
export class EtherscanApiClientService {

  constructor(
    private _appConfig: AppConfig,
  ) {}
  private readonly ETHERSCAN_API_URL = 'https://api.etherscan.io/api';

  async fetchTransactions<T = EthTransaction>(params: AccountEtherscanApiParams): Promise<T[]> {
    const {address, startblock = 0, endblock = 99999999, page = 1, offset = 1000, sort = 'desc'} = params;
    const response = await axios.get(`${this.ETHERSCAN_API_URL}`, {
      params: {
        module: 'account',
        action: 'txlist',
        address,
        startblock,
        endblock,
        page,
        offset: Math.max(Math.min(10000, offset), 1),
        sort: 'desc',
        apikey: this._appConfig.etherscanApiKey
      }
    });
    if (response.data.status !== "1") {
      throw new Error(response.data.message);
    }
    return response.data.result;
  }

  async fetchErc20TransfersByContract(params: AccountEtherscanApiParams): Promise<EthTransfer> {
    // https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2&page=1&offset=10000&startblock=0&endblock=27025780&sort=desc&apikey=YourApiKeyToken
    const { contractAddress, startblock = 0, endblock = 99999999, page = 1, offset = 10000, sort = 'desc' } = params;
    const response = await axios.get(`${this.ETHERSCAN_API_URL}`, {
      params: {
        module: 'account',
        action: 'tokentx',
        contractAddress,
        startblock,
        endblock,
        page,
        offset: Math.max(Math.min(10000, offset), 1),
        sort,
        apikey: this._appConfig.etherscanApiKey
      }
    });
    if (response.data.status !== "1") {
      throw new Error(response.data.message);
    }
    return response.data.result;
  }

  async fetchInternalTransactionsByBlockRange(params: AccountEtherscanApiParams): Promise<EthTransaction[]> {
    // https://api.etherscan.io/api?module=account&action=txlistinternal&startblock=13481773&endblock=13491773&page=1&offset=10&sort=desc&apikey=YourApiKeyToken
    const { startblock = 0, endblock = 99999999, page = 1, offset = 10000, sort = 'desc' } = params;
    
    const response = await axios.get(`${this.ETHERSCAN_API_URL}`, {
      params: {
        module: 'account',
        action: 'txlistinternal',
        startblock,
        endblock,
        page,
        offset: Math.max(Math.min(10000, offset), 1),
        sort,
        apikey: this._appConfig.etherscanApiKey
      }
    });
    return response.data.result;
  }
}
