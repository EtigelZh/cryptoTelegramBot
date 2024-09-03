import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TokenPriceHistoryEntity } from "./token-price-history.entity";
import { AppConfig } from "../app.config";
import { Cron } from "@nestjs/schedule";
import { SwapTokensArgs } from "../utils/crypto-core/buy-coins";
import { getTokenPrice } from "../eth-transactions-watcher-logic/domain-logic/get-token-price";
import { smartRound } from "../eth-transactions-watcher-logic/domain-logic/smart-round";
import { DexOrderService } from "../dex-order/dex-order.service";
import { TokenEconomics } from "../eth-transactions-watcher-logic/domain-logic/handle-swap";

@Injectable()
export class TokenPriceHistoryService {
    constructor(
        @InjectRepository(TokenPriceHistoryEntity)
        private readonly tokenPriceHistoryRepository: Repository<TokenPriceHistoryEntity>,
        private _appConfig: AppConfig,
        private _dexOrderService: DexOrderService
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
    async getLast15TokenPrices(tokenAddress: string): Promise<TokenPriceHistoryEntity[]> {
        return this.tokenPriceHistoryRepository.find({
          where: { tokenAddress },
          order: { recordedAt: 'DESC' },
          take: 15,
        });
    }
    async messageTokenPriceHistory(history: any[]) {
        if (history.length === 0) {
          return 'Токена с таким адресом не найдено';
        }
      
        let response = 'Последние 15 записей о цене токена:\n\n';
      
        history.forEach((record) => {
          response += `Токен: ${record.tokenAddress}\n`;
          response += `Цена в ETH за 1 токен: ${smartRound(record.priceInEthPerToken)}\n`;
          response += `Цена 1 токена в ETH: ${smartRound(record.priceInTokensPerEth)}\n`;
          response += `Записано в: ${record.recordedAt.toLocaleString()}\n\n`;
        });
        return response;
      }


    @Cron(AppConfig.tokenPriceHistoryCron)
    async handleCron() {
        const allTokenAddress = await this._dexOrderService.getAllTokenAddresses()
        for (const monitoredCoin of allTokenAddress) {
            const inputParams: SwapTokensArgs = {
            chainId: this._appConfig.countChainId,
            walletAddress: this._appConfig.metamaskWalletAddress,
            tokenInAddress: this._appConfig.etherTokenAddress,
            tokenOutAddress: monitoredCoin,
            amountInStr: `${this._appConfig.copyTradingTargetBuyingAmountEth}`,
            alchemyApiToken: this._appConfig.alchemyApiKey,
            privateKey: this._appConfig.metamaskPrivateKey
            }
            const result = await getTokenPrice(inputParams)
            const lastPriceRecord = await this.tokenPriceHistoryRepository.findOne({
                where: { tokenAddress: monitoredCoin },
                order: { recordedAt: 'DESC' }
            });

            if (!lastPriceRecord || 
                lastPriceRecord.priceInTokensPerEth != result.numberQuotedAmountOut || 
                lastPriceRecord.priceInEthPerToken != result.priceEthToken) {

                const tokenPriceHistory = new TokenPriceHistoryEntity();
                tokenPriceHistory.tokenAddress = monitoredCoin;
                tokenPriceHistory.priceInTokensPerEth = result.numberQuotedAmountOut;
                tokenPriceHistory.priceInEthPerToken = result.priceEthToken;

                await this.tokenPriceHistoryRepository.save(tokenPriceHistory);
            
            }
        }
        const exampleToken: TokenEconomics = {
            tokenSymbol: "NEIRO", // Предположительное название токена
            tokenPerEth: 1080, // Количество токенов за 1 ETH
            tokenPerUsd: 0.125, // Количество токенов за 1 USD
            ethPrice: 1600, // Цена 1 ETH в USD
            ethPerToken: 2000, // Цена одного токена в ETH
            usdPerToken: 8, // Цена одного токена в USD
            tokenAddress: "0xEE2a03Aa6Dacf51C18679C516ad5283d8E7C2637", // Адрес токена
            calculatedAt: new Date(), // Дата и время получения данных
            calculatedAtBlockNumber: 20662060 // Примерный номер блока
        }
        await this._dexOrderService.handleTokenPriceChange(exampleToken)
    }
}