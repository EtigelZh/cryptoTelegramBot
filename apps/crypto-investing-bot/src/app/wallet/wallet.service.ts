import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WalletEntity } from "./wallet.entity";

@Injectable()
export class WalletService {
    constructor(
        @InjectRepository(WalletEntity) private _walletRepository: Repository<WalletEntity>,
    ) {}

    createWallet(wallet: Pick<WalletEntity, 'hash' | 'alias'>): Promise<WalletEntity> {
        return this._walletRepository.save(wallet);
    }

    saveWallet(wallet: WalletEntity): Promise<WalletEntity> {
        return this._walletRepository.save(wallet);
    }
}