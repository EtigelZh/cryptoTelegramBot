import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WalletEntity } from "./wallet.entity";
import { WalletHash } from '../utils/models';

@Injectable()
export class WalletService {
    constructor(
        @InjectRepository(WalletEntity) private _walletRepository: Repository<WalletEntity>,
    ) {}

    getWallet(hash: WalletHash): Promise<WalletEntity | null> {
      return this._walletRepository.findOne({ where: { hash } });
    }

    createWallet(wallet: Pick<WalletEntity, 'hash' | 'alias'>): Promise<WalletEntity> {
        return this._walletRepository.save(wallet);
    }

    saveWallet(wallet: Partial<WalletEntity>): Promise<WalletEntity> {
        return this._walletRepository.save(wallet);
    }
}
