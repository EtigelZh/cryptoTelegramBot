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

  async toggleAutoBuy(walletAddress: string): Promise<DexWalletsEntity> {
    // Ищем запись по адресу кошелька
    let walletEntity = await this._dexWalletsRepository.findOne({
      where: { walletAddress: walletAddress },
    });

    if (!walletEntity) {
      // Если запись не найдена, можно создать новую или выбросить ошибку
      // Здесь выбрасываем ошибку
      throw new Error(`Кошелек с адресом ${walletAddress} не найден.`);
    }

    // Переключаем значение isAutoBuyEnabled на противоположное
    walletEntity.isAutoBuyEnabled = !walletEntity.isAutoBuyEnabled;

    // Сохраняем обновленную запись в базе данных
    await this._dexWalletsRepository.save(walletEntity);

    // Возвращаем обновленную сущность
    return walletEntity;
  }

  async toggleAutoSell(walletAddress: string): Promise<DexWalletsEntity> {
    // Ищем запись по адресу кошелька
    let walletEntity = await this._dexWalletsRepository.findOne({
      where: { walletAddress: walletAddress },
    });

    if (!walletEntity) {
      // Если запись не найдена, можно создать новую или выбросить ошибку
      // Здесь выбрасываем ошибку
      throw new Error(`Кошелек с адресом ${walletAddress} не найден.`);
    }

    // Переключаем значение isAutoBuyEnabled на противоположное
    walletEntity.isAutoSellEnabled = !walletEntity.isAutoSellEnabled;

    // Сохраняем обновленную запись в базе данных
    await this._dexWalletsRepository.save(walletEntity);

    // Возвращаем обновленную сущность
    return walletEntity;
  }
  
  async getIsAutoBuyEnabled(walletAddress: string): Promise<boolean> {
    // Ищем запись по адресу кошелька
    const walletEntity = await this._dexWalletsRepository.findOne({
      where: { walletAddress: walletAddress },
    });

    if (!walletEntity) {
      // Если запись не найдена, можно вернуть значение по умолчанию или выбросить ошибку
      throw new Error(`Кошелек с адресом ${walletAddress} не найден.`);
    }

    // Возвращаем значение isAutoBuyEnabled
    return walletEntity.isAutoBuyEnabled;
  }
  async getIsAutoSellEnabled(walletAddress: string): Promise<boolean> {
    // Ищем запись по адресу кошелька
    const walletEntity = await this._dexWalletsRepository.findOne({
      where: { walletAddress: walletAddress },
    });

    if (!walletEntity) {
      // Если запись не найдена, можно вернуть значение по умолчанию или выбросить ошибку
      throw new Error(`Кошелек с адресом ${walletAddress} не найден.`);
    }

    // Возвращаем значение isAutoBuyEnabled
    return walletEntity.isAutoSellEnabled;
  }
}