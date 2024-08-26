import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TokenPriceHistoryEntity } from "./token-price-history.entity";
import { AppConfig } from "../app.config";
import { Cron } from "@nestjs/schedule";
import { SwapTokensArgs } from "../utils/crypto-core/buy-coins";
import { getTokenPrice, messageTokenPrice } from "../eth-transactions-watcher-logic/domain-logic/get-token-price";
import { smartRound } from "../eth-transactions-watcher-logic/domain-logic/smart-round";

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
    async getLast15TokenPrices(tokenAddress: string): Promise<TokenPriceHistoryEntity[]> {
        return this.tokenPriceHistoryRepository.find({
          where: { tokenAddress },
          order: { recordedAt: 'DESC' },
          take: 15, // Ограничиваем выборку последними 15 записями
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


    @Cron('*/15 * * * * *')
    async handleCron() {
        const monitoredCoin = this._appConfig.exampleTokenKey;
        
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
        const result = await getTokenPrice(inputParams)
        console.log(await messageTokenPrice(inputParams))
    // Получаем последнюю запись для данного токена из базы данных
        const lastPriceRecord = await this.tokenPriceHistoryRepository.findOne({
            where: { tokenAddress: monitoredCoin },
            order: { recordedAt: 'DESC' }
        });

        // Проверяем, отличается ли новая цена от последней сохраненной цены
        console.log(lastPriceRecord.id)
        if (!lastPriceRecord || 
            lastPriceRecord.priceInTokensPerEth != result.numberQuotedAmountOut || 
            lastPriceRecord.priceInEthPerToken != result.priceEthToken) {
            console.log(lastPriceRecord.priceInTokensPerEth, result.numberQuotedAmountOut)
            // Если цена отличается или записи вообще нет, то создаем новую запись
            const tokenPriceHistory = new TokenPriceHistoryEntity();
            tokenPriceHistory.tokenAddress = monitoredCoin;
            tokenPriceHistory.priceInTokensPerEth = result.numberQuotedAmountOut;
            tokenPriceHistory.priceInEthPerToken = result.priceEthToken;

            // Сохраняем новую запись в базе данных
            await this.tokenPriceHistoryRepository.save(tokenPriceHistory);
        }
    }
}