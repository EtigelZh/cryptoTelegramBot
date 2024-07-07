import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AppConfig } from '../app.config';
import { AccountEtherscanApiParams, EthTransaction, EthTransfer, LogsEtherscanApiParams } from './etherscan-api.models';


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

  async fetchErc20TransfersByBlockRange(params: AccountEtherscanApiParams): Promise<EthTransfer[]> {
    // https://api.etherscan.io/api?module=account&action=tokentx&startblock=0&endblock=99999999&page=1&offset=10000&sort=desc&apikey=YourApiKeyToken
    const { startblock = 0, endblock = 99999999, page = 1, offset = 10000, sort = 'desc' } = params;
    
    const response = await axios.get(`${this.ETHERSCAN_API_URL}`, {
      params: {
        module: 'account',
        action: 'tokentx',
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

  async fetchLogsByBlockRangeAndTopics(params: LogsEtherscanApiParams): Promise<EthTransfer[]> {
    const { startblock, endblock, page = 1, offset = 1000, ...topics } = params;
    
    const requestParams = {
      module: 'logs',
      action: 'getLogs',
      fromBlock: startblock,
      toBlock: endblock,
      page,
      offset: Math.max(Math.min(10000, offset), 1),
      apikey: this._appConfig.etherscanApiKey,
      ...topics,
    };

    const requestFn = async () => {
      const response = await axios.get(`${this.ETHERSCAN_API_URL}`, { params: requestParams });
      if (response.data.status !== "1") {
        throw new Error(response.data.message);
      }
      if (response.data.result.length >= 1000) {
        Logger.log(`Fetching more than 1000 logs for block range ${startblock}-${endblock}`);
        const totalResult = response.data.result;
        let currentPage = page;
        let currentResult = response.data.result;
        while (currentResult >= 1000) {
          currentPage++;
          Logger.warn(`Fetching page ${currentPage} for block range ${startblock}-${endblock}`);
          const response = await axios.get(`${this.ETHERSCAN_API_URL}`, { params: { ...requestParams, page: currentPage } });
          if (response.data.status !== "1") {
            throw new Error(response.data.message);
          }
          currentResult = response.data.result;
          totalResult.push(...currentResult);
        }
      }
      return response.data.result;
    };

    return await this.retryRequest(requestFn);
  }

  private async retryRequest<T = unknown>(requestFn: () => Promise<unknown>, retries = 3, delayTimes: number[] = [4000, 8000, 24000]): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await requestFn();
        if (attempt > 0) {
          Logger.warn(`Attempt ${attempt + 1} succeeded`);
        }
        return result as T;
      } catch (error) {
        if (attempt < retries - 1) {
          const delayTime = delayTimes[attempt];
          Logger.warn(`Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delayTime / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delayTime));
        } else {
          Logger.error('Attempt ${attempt + 1} failed: ${error.message}. Failed to fetch logs after 3 attempts');
          throw new Error('Failed to fetch logs after 3 attempts');
        }
      }
    }
  }
}
