import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { fungibleQueueName } from './fungible.consumer';
import { FungibleInfo } from '../zerion-api/zerion-api.models';
import { AddButchIfNotExistsResult, CurrencySymbol } from '../utils/models';
import { FungibleEntity } from './fungible.entity';

@Injectable()
export class FungibleConsumerApiService {
  constructor(@InjectQueue(fungibleQueueName) private _fungibleQueue: Queue) {}

  async addZerionFundIfNotExits(
    fund: FungibleInfo
  ): Promise<{ isAdded: boolean }> {
    const job = await this._fungibleQueue.add('addZerionFundIfNotExits', fund);
    return await job.finished();
  }

  async addZerionFundsIfNotExists(
    funds: FungibleInfo[]
  ): Promise<AddButchIfNotExistsResult<CurrencySymbol, FungibleEntity>>{
    const job = await this._fungibleQueue.add('addZerionFundsIfNotExists', funds);
    return await job.finished();
  }
}
