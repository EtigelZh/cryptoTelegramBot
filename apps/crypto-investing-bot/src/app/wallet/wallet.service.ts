import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './wallet.entity';
import { WalletHash } from '../utils/models';
import { WalletProcessingTaskEntity } from './wallet-processing-task.entity';
import { humanizeHash } from '../utils/humanized-hash';
import { captureException } from '@sentry/node';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletEntity) private _walletRepository: Repository<WalletEntity>,
    @InjectRepository(WalletProcessingTaskEntity) private _walletProcessingTaskRepository: Repository<WalletProcessingTaskEntity>,
    @Inject(CACHE_MANAGER) private _cacheManager: Cache,
  ) {
  }

  async generateWalletEntityAndReturnAlias(walletHash: string): Promise<string | null> {
    try {
      const walletAlias = (await Promise.race([
        humanizeHash(walletHash, async (key) => {
          const hash = await this._cacheManager.get(`name:${key}`);
          Logger.log(`check collision ${key} ${hash}`);
          if (!hash) {
            return false;
          }
          return hash !== walletHash;
        }).then(alias => {
          this.saveWallet({ hash: walletHash, alias }).catch(error => {
            Logger.error(error);
            captureException(error, {
              extra: { walletHash, alias },
              tags: { source: 'GoogleSheetsConsumer.fillFinanceDataFromSheets', target: 'WalletService.save' }
            });
          });
          return alias;
        }),
        new Promise((_, rej) => setTimeout(rej, 10_000))
      ])) as string;

      if (walletAlias) {
        await this._cacheManager.set(`name:${walletAlias}`, walletHash, 0);
      }

      return walletAlias;
    } catch (error) {
      Logger.error('fillFinanceDataFromSheets humanizeHash error', error);
    }
    return null;
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

  // popNeedCalculationWallets(take = 100): Promise<WalletProcessingTaskEntity[]> {
  //   // transaction
  //   const deleteResult = this._walletProcessingTaskRepository.delete({
  //     where: { task: 'calculate_wallet' }, order: {
  //       priority: 'ASC',
  //       createdAt: 'ASC'
  //     }, take
  //   });
  // }
  //
  // popWalletsToCalculation(): Promise<void> {
  //
  // }
}
