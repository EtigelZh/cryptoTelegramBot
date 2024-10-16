import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DexWalletsEntity } from './dex-wallets.entity';
import { In, Repository } from 'typeorm';

@Injectable()
export class DexWalletsService {
  constructor(
    @InjectRepository(DexWalletsEntity)
    private readonly _dexWalletsRepository: Repository<DexWalletsEntity>
  ) {}
  
  async saveWalletAddresses(addresses: string[]): Promise<DexWalletsEntity[]> {
    // Получаем существующие адреса из базы данных
    const existingWallets = await this._dexWalletsRepository.find({
      where: { walletAddress: In(addresses) },
    });

    const existingAddresses = new Set(
      existingWallets.map(wallet => wallet.walletAddress)
    );

    // Фильтруем новые адреса, чтобы не было дубликатов
    const newAddresses = addresses.filter(
      address => !existingAddresses.has(address)
    );

    // Создаем новые сущности для новых адресов
    const newWallets = newAddresses.map(address => {
      const wallet = new DexWalletsEntity();
      wallet.walletAddress = address;
      wallet.isAutoBuyEnabled = true; // Устанавливаем значения по умолчанию
      wallet.isAutoSellEnabled = true;
      return wallet;
    });

    // Сохраняем новые записи в базу данных
    const savedWallets = await this._dexWalletsRepository.save(newWallets);

    // Возвращаем объединенный массив существующих и новых записей
    return [...existingWallets, ...savedWallets];
  }
}