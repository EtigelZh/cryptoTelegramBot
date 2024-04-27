import { Process, Processor } from '@nestjs/bull';
import { FungibleInfo } from '../zerion-api/zerion-api.models';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { FungibleEntity } from './fungible.entity';
import { Repository } from 'typeorm';
import { CurrencySymbol } from '../utils/models';

export const fungibleQueueName = 'fungible';

@Processor({
  name: fungibleQueueName,
})
export class FungibleConsumer {
  constructor(
    @InjectRepository(FungibleEntity)
    private _fungibleRepository: Repository<FungibleEntity>
  ) {}

  @Process('addZerionFundIfNotExits')
  async addZerionFundIfNotExits(job: Job<FungibleInfo>) {
    const { data: fund } = job;
    const exists = await this._exists(fund.symbol);
    if (exists) {
      return { isAdded: false };
    }
    await this._fungibleRepository.save({
      name: fund.name,
      symbol: fund.symbol,
      zerionVerified: fund.flags.verified,
      implementations: fund.implementations,
    });
    return { isAdded: true };
  }

  private _exists(symbol: CurrencySymbol) {
    return this._fungibleRepository.exists({ where: {symbol} });
  }
}
