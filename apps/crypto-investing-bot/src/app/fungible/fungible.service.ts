import { Injectable } from '@nestjs/common';
import { FungibleInfo } from '../zerion-api/zerion-api.models';
import { InjectRepository } from '@nestjs/typeorm';
import { FungibleEntity } from './fungible.entity';
import { In, Repository } from 'typeorm';
import {
  AddButchIfNotExistsResult,
  AddIfNotExistsResult,
  CurrencySymbol,
} from '../utils/models';

@Injectable()
export class FungibleService {
  constructor(
    @InjectRepository(FungibleEntity)
    private _fungibleRepository: Repository<FungibleEntity>
  ) {}

  async addZerionFundIfNotExits(
    fund: FungibleInfo
  ): Promise<AddIfNotExistsResult> {
    const exists = await this._exists(fund.symbol);
    if (exists) {
      return { isAdded: false };
    }
    await this._fungibleRepository.save({
      name: fund.name,
      symbol: fund.symbol,
      zerionVerified: fund.flags?.verified ?? false,
      ethereumAddress: fund.implementations?.find( (implementation) => implementation.chain_id === 'ethereum')?.address || '',
      implementations: fund.implementations,
    });
    return { isAdded: true };
  }

  async addZerionFundsIfNotExists(
    funds: FungibleInfo[]
  ): Promise<AddButchIfNotExistsResult<CurrencySymbol, FungibleEntity>> {
    const existsEntities = await this._fungibleRepository.find({
      select: ['symbol'],
      where: { symbol: In(funds.map((fund) => fund?.symbol)) },
    });
    const notExits = funds.filter(
      (fund) => !!fund && !!fund?.name && !!fund?.symbol && !existsEntities.some((exit) => exit.symbol === fund.symbol)
    );
    const added = await this._fungibleRepository.save(
      notExits.map((fund) => this._mapFungibleInfoToEntity(fund))
    );
    return {
      added,
      exists: existsEntities.map((entity) => entity?.symbol || ''),
    };
  }

  private _mapFungibleInfoToEntity(fund: FungibleInfo): Partial<FungibleEntity> {
    return {
      name: fund.name,
      symbol: fund?.symbol || '',
      ethereumAddress: fund.implementations?.find( (implementation) => implementation.chain_id === 'ethereum')?.address || '',
      zerionVerified: fund.flags?.verified || false,
      implementations: fund.implementations,
    };
  }

  private _exists(symbol: CurrencySymbol) {
    return this._fungibleRepository.exists({ where: { symbol } });
  }
}
