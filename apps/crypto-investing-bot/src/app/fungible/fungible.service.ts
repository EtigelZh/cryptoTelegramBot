import { Injectable } from '@nestjs/common';
import { FungibleInfo } from '../zerion-api/zerion-api.models';
import { InjectQueue } from '@nestjs/bull';
import { fungibleQueueName } from './fungible.consumer';
import { Queue } from 'bull';

@Injectable()
export class FungibleService {
  constructor(
    @InjectQueue(fungibleQueueName) private _fungibleQueue: Queue,
  ) {}

  async addZerionFundIfNotExits(fund: FungibleInfo): Promise<{ isAdded: boolean }> {
    const job = await this._fungibleQueue.add('addZerionFundIfNotExits', fund);
    return await job.finished();
  }
}
