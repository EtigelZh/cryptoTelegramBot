import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenPriceHistoryEntity } from './token-price-history.entity';
import { AppConfig } from '../app.config';
import { getTokenPricesFromAlchemyApi } from '../eth-transactions-watcher-logic/domain-logic/get-token-price';
import { smartRound } from '../eth-transactions-watcher-logic/domain-logic/smart-round';
import { DexOrderService } from '../dex-order/dex-order.service';
import { TokenEconomics } from '../eth-transactions-watcher-logic/domain-logic/handle-swap';

@Injectable()
export class TokenPriceHistoryService {
  constructor(
    @InjectRepository(TokenPriceHistoryEntity)
    private readonly tokenPriceHistoryRepository: Repository<TokenPriceHistoryEntity>,
    private _appConfig: AppConfig,
    private _dexOrderService: DexOrderService
  ) {}

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

  async getTokenPriceHistory(
    tokenAddress: string
  ): Promise<TokenPriceHistoryEntity[]> {
    return await this.tokenPriceHistoryRepository.find({
      where: { tokenAddress },
      order: { recordedAt: 'ASC' },
    });
  }
  async getLast15TokenPrices(
    tokenAddress: string
  ): Promise<TokenPriceHistoryEntity[]> {
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
      response += `Цена в ETH за 1 токен: ${smartRound(
        record.priceInEthPerToken
      )}\n`;
      response += `Цена 1 токена в ETH: ${smartRound(
        record.priceInTokensPerEth
      )}\n`;
      response += `Записано в: ${record.recordedAt.toLocaleString()}\n\n`;
    });
    return response;
  }

  async handleNewBlock(blockNumber: number) {
    Logger.debug('Handling new block for token price history');
    const allTokenAddress = await this._dexOrderService.getAllTokenAddresses();

    const tokenPrices = await getTokenPricesFromAlchemyApi(
      Array.from(allTokenAddress),
      this._appConfig.alchemyApiKey
    );

    Logger.debug(`Got prices count: ${tokenPrices.length}`);
    await Promise.allSettled(
      tokenPrices.map(async (tokenPrice) => {
        try {
          const monitoredCoin = tokenPrice.tokenAddress;

          const lastPriceRecord =
            await this.tokenPriceHistoryRepository.findOne({
              where: { tokenAddress: monitoredCoin },
              order: { recordedAt: 'DESC' },
            });

          if (
            !lastPriceRecord ||
            lastPriceRecord.priceInTokensPerEth !=
              tokenPrice.tokenAmountForOneETH ||
            lastPriceRecord.priceInEthPerToken != tokenPrice.priceInEthPerToken
          ) {
            const tokenPriceHistory = new TokenPriceHistoryEntity();
            tokenPriceHistory.tokenAddress = monitoredCoin;
            tokenPriceHistory.priceInTokensPerEth =
              tokenPrice.tokenAmountForOneETH;
            tokenPriceHistory.priceInEthPerToken =
              tokenPrice.priceInEthPerToken;

            await this.tokenPriceHistoryRepository.save(tokenPriceHistory);
          }

          const tokenDexOrder: TokenEconomics = {
            tokenSymbol: '',
            tokenPerEth: tokenPrice.tokenAmountForOneETH,
            tokenPerUsd: 1 / tokenPrice.tokenPriceUSD, // сколько стоит доют токенов за 1 доллар
            ethPrice: tokenPrice.ethPriceUSD, // сколько стоит долларов 1 eth
            ethPerToken: tokenPrice.priceInEthPerToken,
            usdPerToken: tokenPrice.tokenPriceUSD, // сколько стоит долларов 1 токен
            tokenAddress: monitoredCoin,
            calculatedAt: new Date(),
            calculatedAtBlockNumber: blockNumber,
          };

          await this._dexOrderService.handleTokenPriceChange(tokenDexOrder);
        } catch (e) {
          Logger.error(`Error while handling token price change: ${e}`);
        }
      })
    );

    Logger.debug(`All prices for block ${blockNumber} handled`);
  }
}