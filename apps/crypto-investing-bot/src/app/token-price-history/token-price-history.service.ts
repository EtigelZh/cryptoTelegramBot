import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TokenPriceHistoryEntity } from "./token-price-history.entity";
import { AppConfig } from "../app.config";
import { Cron } from "@nestjs/schedule";
import { SwapTokensArgs } from "../utils/crypto-core/buy-coins";
import { getTokenPrice } from "../eth-transactions-watcher-logic/domain-logic/get-token-price";

@Injectable()
export class TokenPriceHistoryService {
    constructor(
        @InjectRepository(TokenPriceHistoryEntity)
        private readonly tokenPriceHistoryRepository: Repository<TokenPriceHistoryEntity>,
        private _appConfig: AppConfig,
    ) {
    }

    async saveTokenPrice(
        tokenAddress: string, 
        priceInEthPerToken: number, 
        priceInTokensPerEth: number
    ): Promise<TokenPriceHistoryEntity> {
        const priceRecord = this.tokenPriceHistoryRepository.create({
            tokenAddress,
            priceInEthPerToken,
            priceInTokensPerEth,
        });
        return await this.tokenPriceHistoryRepository.save(priceRecord);
    }

    async getTokenPriceHistory(tokenAddress: string): Promise<TokenPriceHistoryEntity[]> {
        return await this.tokenPriceHistoryRepository.find({
            where: { tokenAddress },
            order: { recordedAt: 'ASC' }
        });
    }


    @Cron('*/15 * * * * *')
    async handleCron() {
        const monitoredCoin = this._appConfig.tokenKey;
        
        // Здесь можно сделать запрос к API или любому другому источнику, чтобы получить текущую цену монеты
        const inputParams: SwapTokensArgs = {
          chainId: 1,
          walletAddress: this._appConfig.metamaskWalletAddress, // Адрес Ethereum кошелька
          tokenInAddress: this._appConfig.etherTokenAddress, // ETH
          tokenOutAddress: monitoredCoin,
          amountInStr: '1.0',
          alchemyApiToken: this._appConfig.alchemyApiKey,
          privateKey: this._appConfig.metamaskPrivateKey
        }
        const result = getTokenPrice(inputParams)
        // Сохранение данных в базу
        // const tokenPriceHistory = new TokenPriceHistoryEntity();
        // tokenPriceHistory.tokenAddress = monitoredCoin;
        // tokenPriceHistory.priceEth = priceEth;
        // tokenPriceHistory.priceToken = priceToken;
    
        // await this.tokenPriceHistoryRepository.save(tokenPriceHistory);
    
        // this.logger.debug(`Saved price of ${monitoredCoin}: ETH: ${priceEth}, Token: ${priceToken}`);
      }
}