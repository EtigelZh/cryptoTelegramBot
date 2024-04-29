import { Process, Processor } from '@nestjs/bull';
import { FungibleInfo } from '../zerion-api/zerion-api.models';
import { Job } from 'bull';
import { FungibleEntity } from './fungible.entity';
import { AddButchIfNotExistsResult, AddIfNotExistsResult, CurrencySymbol } from '../utils/models';
import { FungibleService } from './fungible.service';

export const fungibleQueueName = 'fungible';

@Processor({
  name: fungibleQueueName,
})
export class FungibleConsumer {
  constructor(private _fungibleService: FungibleService) {}

  @Process('addZerionFundIfNotExits')
  async addZerionFundIfNotExits(job: Job<FungibleInfo>): Promise<AddIfNotExistsResult> {
    const { data: fund } = job;
    return await this._fungibleService.addZerionFundIfNotExits(fund);
  }

  @Process('addZerionFundsIfNotExists')
  async addZerionFundsIfNotExists(job: Job<FungibleInfo[]>): Promise<AddButchIfNotExistsResult<CurrencySymbol, FungibleEntity>> {
    const { data: funds } = job;
    return await this._fungibleService.addZerionFundsIfNotExists(funds);
  }
}
