import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WalletEntity, WalletStatus } from './wallet.entity';
import { WalletHash } from '../utils/models';
import { humanizeHash } from '../utils/humanized-hash';
import { captureException } from '@sentry/node';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletEntity) private _walletRepository: Repository<WalletEntity>,
    @Inject(CACHE_MANAGER) private _cacheManager: Cache,
  ) {
  }

  async createWalletEntityIfNotExists(walletHash: string): Promise<WalletEntity | null> {
    try {
      const existingWallet = await this._walletRepository.findOne({ where: { hash: walletHash } });
      if (existingWallet) {
        return existingWallet;
      }
      const walletEntity = await Promise.race<WalletEntity | null>([
        this._createEntityAndAlias(walletHash),
        new Promise((_, rej) => setTimeout(rej, 30_000))
      ]);

      if (walletEntity) {
        await this._cacheManager.set(`name:${walletEntity?.alias}`, walletHash, 0);
      }

      return walletEntity;
    } catch (error) {
      Logger.error('fillFinanceDataFromSheets humanizeHash error', error);
    }
    return null;
  }

  async createWalletsEntitiesIfNotExists(walletHashes: string[]): Promise<{ exists: string[], notExits: string[] }> {
    const existsWallets = await this._walletRepository.find({ select: ['hash'], where: { hash: In(walletHashes)} });
    const existsWalletsHashes = existsWallets.map(wallet => wallet.hash);
    const notExistsWalletsHashes = walletHashes.filter(hash => !existsWalletsHashes.includes(hash));
    for (const walletHash of notExistsWalletsHashes) {
      // TODO оптимизировать этот процесс за счет батчевой вставки
      await this.createWalletEntityIfNotExists(walletHash);
    }
    return { exists: existsWalletsHashes, notExits: notExistsWalletsHashes };
  }

  async setWalletStatus(walletHash: string, walletStatus: WalletStatus) {
    await this._walletRepository.update({ hash: walletHash }, { status: walletStatus });
  }

  getWallet(hash: WalletHash): Promise<WalletEntity | null> {
    return this._walletRepository.findOne({ where: { hash } });
  }

  createWallet(wallet: Pick<WalletEntity, 'hash' | 'alias'>): Promise<WalletEntity> {
    return this._walletRepository.save(wallet);
  }

  saveWallet(wallet: Partial<WalletEntity>): Promise<WalletEntity> {
    return this._walletRepository.save(wallet);
  }

  private async _createEntityAndAlias(walletHash: string): Promise<WalletEntity | null> {
    let alias: string | null = null;
    try {
      alias = await humanizeHash(walletHash, async (key) => {
        const hash = await this._cacheManager.get(`name:${key}`);
        Logger.log(`check collision ${key} ${hash}`);
        if (!hash) {
          return false;
        }
        return hash !== walletHash;
      });

      return this.saveWallet({ hash: walletHash, alias });
    } catch (error) {
      Logger.error(error);
      captureException(error, {
        extra: { walletHash, alias },
        tags: { source: 'GoogleSheetsConsumer.fillFinanceDataFromSheets', target: 'WalletService.save' }
      });
      return null;
    }
  }
}
