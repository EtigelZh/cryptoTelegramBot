import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DexOrderEntity } from './dex-order.entity';
import { In, Repository } from 'typeorm';
import { DexOrderCompletedReason, DexOrderStatus } from './dex-order.models';
import { DexTransactionEntity } from '../dex-transactions/dex-transaction.entity';
import { DexTransactionService } from '../dex-transactions/dex-transactions.service';
import {
  DexTransactionEconomics,
  DexTransactionType,
  TokenEconomics,
} from '../eth-transactions-watcher-logic/domain-logic/handle-swap';
import { messageDexOrder } from '../eth-transactions-watcher-logic/domain-logic/message-dex-order';
import { inspect } from 'util';
import { SwapTokensArgs } from '../utils/crypto-core/buy-coins';
import { AppConfig } from '../app.config';
import { convertTokenPriceToEconomics, getTokenPrice, getTokenPricesFromAlchemyApi } from '../eth-transactions-watcher-logic/domain-logic/get-token-price';
import { EthPriceService } from '../eth-price-watcher/eth-price.service';
import { TelegramDexReporterJobApiService } from '../telegram-dex-reporter/telegram-dex-reporter-job-api.service';

@Injectable()
export class DexOrderService {
  constructor(
    @InjectRepository(DexOrderEntity)
    private readonly _dexOrderRepository: Repository<DexOrderEntity>,
    private readonly _dexTransactionService: DexTransactionService,
    private readonly _telegramDexReporterJobApiService: TelegramDexReporterJobApiService,
    private readonly _appConfig: AppConfig,
    private readonly _ethPriceService: EthPriceService,
    private readonly _config: AppConfig
  ) {}

  async createOrder(followingDexTransaction: DexTransactionEntity) {
    const newDexOrder = new DexOrderEntity();
    newDexOrder.copyTradingWallet = followingDexTransaction.wallet;
    newDexOrder.wallet = { hash: this._config.metamaskWalletAddress };
    newDexOrder.status = DexOrderStatus.BUYING;
    newDexOrder.completedReason = null;
    newDexOrder.tokenAddress = followingDexTransaction.tokenAddress;
    newDexOrder.tokenSymbol = followingDexTransaction.tokenSymbol;
    newDexOrder.sourceBuyingTransactionHash =
      followingDexTransaction.transactionHash;
    newDexOrder.sourceBuyingTransactionBlockNumber =
      followingDexTransaction.blockNumber;
    newDexOrder.sourceBuyingTransactionDate = followingDexTransaction.createdAt;
    newDexOrder.sourceBuyingTransactionPrice =
      followingDexTransaction.economics.ethPerToken;
    newDexOrder.sourceBuyingTransactionAmount =
      followingDexTransaction.economics.amountToken;
    newDexOrder.sourceBuyingTransactions = [];
    newDexOrder.sourceSellingTransactions = [];
    newDexOrder.targetBuyingPrice =
      this._config.copyTradingTargetBuyingPriceMultiply *
      newDexOrder.sourceBuyingTransactionPrice;
    newDexOrder.targetBuyingAmountEth =
      this._config.copyTradingTargetBuyingAmountEth;
    newDexOrder.targetSellingPrice =
      this._config.copyTradingTargetSellingPriceMultiply *
      newDexOrder.sourceBuyingTransactionPrice;
    newDexOrder.targetSellingAmountTokenPercent = 1;
    newDexOrder.buyingTransactions = [];
    newDexOrder.sellingTransactions = [];

    const result = await this._telegramDexReporterJobApiService.sendMessage(
      this._config.generalChatId,
      `Загрузка...`
    );
    newDexOrder.messageDexOrderId = Number(result.message_id);

    newDexOrder.chatDexOrderId = String(this._config.generalChatId);

    this._telegramDexReporterJobApiService
      .pinMessage(this._config.generalChatId, result.message_id)
      .catch((error) => {
        Logger.error(`Error while pinning message: ${error}`);
      });

    return this._dexOrderRepository.save(newDexOrder);
  }

  async handleTokenPriceChange(tokenEconomics: TokenEconomics) {
    const orders = await this._dexOrderRepository.find({
      where: {
        tokenAddress: tokenEconomics.tokenAddress,
        status: In([DexOrderStatus.BUYING, DexOrderStatus.SELLING]),
      },
      relations: ['wallet'],
    });

    const buyOrders: DexOrderEntity[] = [];
    const sellOrders: DexOrderEntity[] = [];
    const messageOrders: DexOrderEntity[] = [];

    for (const order of orders) {
      if (
        order.status === DexOrderStatus.BUYING &&
        order.targetBuyingPrice >= tokenEconomics.ethPerToken
      ) {
        buyOrders.push(order);
      } else if (
        order.status === DexOrderStatus.SELLING &&
        order.targetSellingPrice <= tokenEconomics.ethPerToken
      ) {
        sellOrders.push(order);
      } else {
        messageOrders.push(order);
      }
    }

    await Promise.allSettled([
      this.handleTokenPriceChangeBuyOrders(tokenEconomics, buyOrders),
      this.handleTokenPriceChangeSellOrders(tokenEconomics, sellOrders),
      this.handleTokenPriceChangeMessage(tokenEconomics, messageOrders),
    ]);
  }

  async handleTokenPriceChangeBuyOrders(
    tokenEconomics: TokenEconomics,
    orders: DexOrderEntity[]
  ): Promise<void> {
    const results = await Promise.allSettled(
      orders.map(async (order) => {
        const mockBuyingTransaction = await this.createMockDexBuyingTransaction(
          tokenEconomics.calculatedAtBlockNumber,
          `mock-buy-${order.id}`,
          order.wallet.hash,
          {
            action: DexTransactionType.BUY,
            tokenAddress: tokenEconomics.tokenAddress,
            amountToken:
              order.targetBuyingAmountEth / tokenEconomics.ethPerToken,
            amountUSD: order.targetBuyingAmountEth * tokenEconomics.ethPrice,
            amountWETH: order.targetBuyingAmountEth,
            tokenSymbol: tokenEconomics.tokenSymbol,
            tokenPerEth: tokenEconomics.tokenPerEth,
            tokenPerUsd: tokenEconomics.tokenPerUsd,
            ethPrice: tokenEconomics.ethPrice,
            ethPerToken: tokenEconomics.ethPerToken,
            usdPerToken: tokenEconomics.usdPerToken,
            calculatedAt: tokenEconomics.calculatedAt,
            calculatedAtBlockNumber: tokenEconomics.calculatedAtBlockNumber,
          },
          'mock buy transaction'
        );
        order.status = DexOrderStatus.SELLING;
        order.buyingTransactions = [mockBuyingTransaction];
        return this._dexOrderRepository.save(order);
      })
    );
    Logger.log(
      `Handled ${results.length} buy orders for token ${tokenEconomics.tokenSymbol}`
    );
  }

  async handleTokenPriceChangeSellOrders(
    tokenEconomics: TokenEconomics,
    orders: DexOrderEntity[]
  ): Promise<void> {
    const results = await Promise.allSettled(
      orders.map(async (order) => {
        const mockSellingTransaction =
          await this.createMockDexBuyingTransaction(
            tokenEconomics.calculatedAtBlockNumber,
            `mock-buy-${order.id}`,
            order.wallet.hash,
            {
              action: DexTransactionType.SELL,
              tokenAddress: tokenEconomics.tokenAddress,
              amountToken:
                order.targetBuyingAmountEth / tokenEconomics.ethPerToken,
              amountUSD: order.targetBuyingAmountEth * tokenEconomics.ethPrice,
              amountWETH: order.targetBuyingAmountEth,
              tokenSymbol: tokenEconomics.tokenSymbol,
              tokenPerEth: tokenEconomics.tokenPerEth,
              tokenPerUsd: tokenEconomics.tokenPerUsd,
              ethPrice: tokenEconomics.ethPrice,
              ethPerToken: tokenEconomics.ethPerToken,
              usdPerToken: tokenEconomics.usdPerToken,
              calculatedAt: tokenEconomics.calculatedAt,
              calculatedAtBlockNumber: tokenEconomics.calculatedAtBlockNumber,
            },
            'mock buy transaction'
          );
        order.status = DexOrderStatus.COMPLETED;
        order.sellingTransactions = [mockSellingTransaction];
        order.completedReason = DexOrderCompletedReason.TRADING_PROFIT;
        
        const savedOrder = await this._dexOrderRepository.save(order);
        const messageText = await messageDexOrder(tokenEconomics, savedOrder);
        this._telegramDexReporterJobApiService
          .createOrUpdateLastMessage(
            order.messageDexOrderId,
            messageText,
            Number(order.chatDexOrderId),
            {
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
            }
          )
          .then(async (messageId) => {
            Logger.log(`Updating message ID for order ${order.id} to ${messageId}`);
            if (!!messageId && order.messageDexOrderId !== messageId) {
              await this._dexOrderRepository.update(savedOrder.id, {
                messageDexOrderId: messageId,
              });
              Logger.log(
                `Updated message ID for order ${order.id} to ${messageId}`
              );
            }
            return this._telegramDexReporterJobApiService.unpinMessage(
              order.chatDexOrderId,
              order.messageDexOrderId
            );
          })
          .catch((error) => {
            Logger.error(`Error while editing message: ${error}`);
          });
        return savedOrder;
      })
    );
    if (results.length > 0) {
      Logger.log(
        `Handled ${results.length} buy orders for token ${tokenEconomics.tokenSymbol}`
      );
    }
    const failedResults = results.filter(
      (result) => result.status === 'rejected'
    );
    if (failedResults.length > 0) {
      Logger.error(
        `Failed to handle ${failedResults.length} orders for token ${
          tokenEconomics.tokenSymbol
        } ${inspect(failedResults)}`
      );
    }
  }

  async handleTokenPriceChangeMessage(
    tokenEconomics: TokenEconomics,
    orders: DexOrderEntity[]
  ): Promise<void> {
    if (orders.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      orders.map(async (order) => {
        const messageText = await messageDexOrder(tokenEconomics, order);

        // Формируем массив кнопок в зависимости от статуса ордера
        const autoSellEnabledButtons = [
          { text: 'Stop', callback_data: `dexOrderManualStop_${order.id}` },
        ];
        if (order.isAutoSellEnabled) {
          autoSellEnabledButtons.push({
            text: 'stopAutoSell',
            callback_data: `isStopAutoSellEnabled_${order.id}`,
          });
        } else if (!order.isAutoSellEnabled) {
          autoSellEnabledButtons.push({
            text: 'startAutoSell',
            callback_data: `isStartAutoSellEnabled_${order.id}`,
          });
        }

        const buttons = [];
        const priceChangeButtons = [
          {
            text: '-1 %',
            callback_data: `dexOrderTargetPriceChangeLess_${order.id}`,
          },
          {
            text: '+1 %',
            callback_data: `dexOrderTargetPriceChangeMore_${order.id}`,
          },
        ];
        buttons.push(autoSellEnabledButtons);
        buttons.push(priceChangeButtons);

        // Добавляем кнопку в зависимости от статуса ордера
        if (order.status === DexOrderStatus.SELLING) {
          buttons.push([
            {
              text: 'change percent',
              callback_data: `dexOrderChangePercent_${order.id}`,
            },
          ]);
        }
        if (order.status === DexOrderStatus.BUYING) {
          buttons.push([
            {
              text: 'change price',
              callback_data: `dexOrderChangePrice_${order.id}`,
            },
          ]);
        }

        return this._telegramDexReporterJobApiService.createOrUpdateLastMessage(
          order.messageDexOrderId,
          messageText,
          Number(order.chatDexOrderId),
          {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: buttons,
            },
          }
        ).then(async (messageId) => {
          Logger.log(`Updating message ID for order ${order.id} to ${messageId}`);
          if (!!messageId && order.messageDexOrderId !== messageId) {
            await this._dexOrderRepository.update(order.id, {
              messageDexOrderId: messageId,
            });
            Logger.log(
              `Updated message ID for order ${order.id} to ${messageId}`
            );
          }
        });
      })
    );

    if (results.length > 0) {
      Logger.debug(
        `Handled ${results.length} orders for token ${tokenEconomics.tokenSymbol}`
      );
    }

    const failedResults = results.filter(
      (result) => result.status === 'rejected'
    );
    if (failedResults.length > 0) {
      Logger.error(
        `Failed to handle ${failedResults.length} orders for token ${
          tokenEconomics.tokenSymbol
        } ${inspect(failedResults)}`
      );
    }
  }

  async getDexOrderCurrentReportStatus(dexOrderId: number) {
    const foundDexOrder = await this._dexOrderRepository.findOne({
      where: {
        id: dexOrderId,
      },
      relations: ['wallet'],
    });

    if (!foundDexOrder) {
      throw new Error(`Order with ID ${dexOrderId} not found.`);
    }

    let economics: DexTransactionEconomics;
    if (foundDexOrder.sellingTransactions.length > 0) {
      economics = foundDexOrder.sellingTransactions[0].economics;
    } else if (foundDexOrder.buyingTransactions.length > 0) {
      economics = foundDexOrder.buyingTransactions[0].economics;
    } else {
      const tokenPrices = await getTokenPricesFromAlchemyApi([{ tokenAddress: foundDexOrder.tokenAddress, tokenSymbol: foundDexOrder.tokenSymbol }], this._appConfig.alchemyApiKey);
      const tokenPrice = tokenPrices.find((price) => price.tokenAddress === foundDexOrder.tokenAddress);
      if (!tokenPrice) {
        throw new Error(`Token price not found for token ${foundDexOrder.tokenSymbol}`);
      }
      const tokenEconomics: TokenEconomics = convertTokenPriceToEconomics(tokenPrice);
      economics = {
        ...tokenEconomics,
        action: foundDexOrder.status === DexOrderStatus.BUYING ? DexTransactionType.BUY : DexTransactionType.SELL,
        amountToken: foundDexOrder.sourceBuyingTransactionAmount,
        amountUSD: foundDexOrder.sourceBuyingTransactionAmount * tokenEconomics.ethPrice,
        amountWETH: foundDexOrder.sourceBuyingTransactionAmount,
      }
    }

    return await messageDexOrder(economics, foundDexOrder);
  }

  async handleTokenPriceChangeSellEarly(tokenEconomics: DexTransactionEntity) {
    const orders = await this._dexOrderRepository.find({
      where: {
        tokenAddress: tokenEconomics.tokenAddress,
        status: DexOrderStatus.SELLING,
      },
      relations: ['wallet'],
    });

    const results = await Promise.allSettled(
      orders.map(async (order) => {
        if (order.isAutoSellEnabled) {
          order.targetSellingPrice = tokenEconomics.economics.ethPerToken;
          const savedOrder = await this._dexOrderRepository.save(order);
          return savedOrder;
        }
      })
    );
    Logger.log(
      `Handled ${results.length} buy orders for token ${inspect(
        tokenEconomics
      )}`
    );
  }

  async createMockDexBuyingTransaction(
    blockNumber: number,
    txHash: string,
    walletHash: string,
    economics: DexTransactionEconomics,
    messageText: string
  ): Promise<DexTransactionEntity> {
    const isMockTransaction = true;
    return this._dexTransactionService.saveDexTransaction(
      blockNumber,
      txHash,
      walletHash,
      economics,
      messageText,
      isMockTransaction
    );
  }
  async getAllTokenAddresses(): Promise<Pick<DexOrderEntity, 'tokenAddress' | 'tokenSymbol'>[]> {
    try {
      const orders = await this._dexOrderRepository.find({
        select: ['tokenAddress', 'tokenSymbol'],
        where: {
          status: In(['BUYING', 'SELLING']),
        },
      });
      // remove duplicates
      return orders.filter(
        (order, index, self) =>
          index ===
          self.findIndex(
            (t) => t.tokenAddress === order.tokenAddress
          )
      );
    } catch (error) {
      Logger.error(`Failed to get all token addresses: ${error.message}`);
      throw error;
    }
  }

  async dexOrderStop(dexOrderId: number) {
    const order = await this._dexOrderRepository.findOne({
      where: {
        id: dexOrderId,
      },
      relations: ['wallet'],
    });

    if (!order) {
      throw new Error(`Order with ID ${dexOrderId} not found.`);
    }
    const inputParams: SwapTokensArgs = {
      chainId: this._appConfig.countChainId,
      walletAddress: this._appConfig.metamaskWalletAddress,
      tokenInAddress: this._appConfig.etherTokenAddress,
      tokenOutAddress: order.tokenAddress,
      amountInStr: `${this._appConfig.copyTradingTargetBuyingAmountEth}`,
      alchemyApiToken: this._appConfig.alchemyApiKey,
      privateKey: this._appConfig.metamaskPrivateKey,
    };
    const result = await getTokenPrice(inputParams);
    const tokenDexOrder: TokenEconomics = {
      tokenSymbol: result.tokenOutSymbol,
      tokenPerEth: result.numberQuotedAmountOut,
      tokenPerUsd: result.numberQuotedAmountOut / this._ethPriceService.price,
      ethPrice: this._ethPriceService.price,
      ethPerToken: result.priceEthToken,
      usdPerToken: this._ethPriceService.price / result.numberQuotedAmountOut,
      tokenAddress: order.tokenAddress,
      calculatedAt: new Date(),
      calculatedAtBlockNumber: result.currentBlockNumber,
    };
    order.status = DexOrderStatus.COMPLETED;
    order.completedReason = DexOrderCompletedReason.MANUAL;
    this._telegramDexReporterJobApiService.unpinMessage(
      order.chatDexOrderId,
      order.messageDexOrderId
    );
    await this._dexOrderRepository.save(order);
    const messageText = await messageDexOrder(tokenDexOrder, order);
    await this._telegramDexReporterJobApiService
      .createOrUpdateLastMessage(
        order.messageDexOrderId,
        messageText,
        Number(order.chatDexOrderId),
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }
      )
      .then(async (messageId) => {
        Logger.log(`Updating message ID for order ${order.id} to ${messageId}`);
        if (!!messageId && order.messageDexOrderId !== messageId) {
          await this._dexOrderRepository.update(order.id, {
            messageDexOrderId: messageId,
          });
          Logger.log(
            `Updated message ID for order ${order.id} to ${messageId}`
          );
        }
      });
  }

  async dexOrderRaisePrice(dexOrderId: number) {
    const order = await this._dexOrderRepository.findOne({
      where: {
        id: dexOrderId,
      },
      relations: ['wallet'],
    });

    if (!order) {
      throw new Error(`Order with ID ${dexOrderId} not found.`);
    }
    if (order.status == DexOrderStatus.BUYING)
      order.targetBuyingPrice = order.targetBuyingPrice * 1.01;
    if (order.status == DexOrderStatus.SELLING)
      order.targetSellingPrice = order.targetSellingPrice * 1.01;
    await this._dexOrderRepository.save(order);
  }

  async dexOrderReductionPrice(dexOrderId: number) {
    const order = await this._dexOrderRepository.findOne({
      where: {
        id: dexOrderId,
      },
      relations: ['wallet'],
    });

    if (!order) {
      throw new Error(`Order with ID ${dexOrderId} not found.`);
    }
    if (order.status == DexOrderStatus.BUYING)
      order.targetBuyingPrice = order.targetBuyingPrice * 0.99;
    if (order.status == DexOrderStatus.SELLING)
      order.targetSellingPrice = order.targetSellingPrice * 0.99;
    await this._dexOrderRepository.save(order);
  }

  async dexOrderChangePrice(dexOrderId: number, newTargetPrice: number) {
    const order = await this._dexOrderRepository.findOne({
      where: {
        id: dexOrderId,
      },
      relations: ['wallet'],
    });

    if (!order) {
      throw new Error(`Order with ID ${dexOrderId} not found.`);
    }
    if (order.status == DexOrderStatus.BUYING)
      order.targetBuyingPrice = newTargetPrice;
    if (order.status == DexOrderStatus.SELLING)
      order.targetSellingPrice =
        order.sourceBuyingTransactionPrice * (newTargetPrice / 100 + 1);
    await this._dexOrderRepository.save(order);
  }

  async dexOrderStopAutoSell(dexOrderId: number) {
    const order = await this._dexOrderRepository.findOne({
      where: {
        id: dexOrderId,
      },
      relations: ['wallet'],
    });

    if (!order) {
      throw new Error(`Order with ID ${dexOrderId} not found.`);
    }
    order.isAutoSellEnabled = false;
    await this._dexOrderRepository.save(order);
  }

  async dexOrderStartAutoSell(dexOrderId: number) {
    const order = await this._dexOrderRepository.findOne({
      where: {
        id: dexOrderId,
      },
      relations: ['wallet'],
    });

    if (!order) {
      throw new Error(`Order with ID ${dexOrderId} not found.`);
    }
    order.isAutoSellEnabled = true;
    await this._dexOrderRepository.save(order);
  }

  async dexOrderMissedBuyingPrice(
    tokenEconomics: DexTransactionEntity, 
  ) {
    const orders = await this._dexOrderRepository.find({
      where: {
        tokenAddress: tokenEconomics.tokenAddress,
        status: DexOrderStatus.BUYING,
        copyTradingWallet: tokenEconomics.wallet
      },
      relations: ['wallet'],
    });

    const results = await Promise.allSettled(
      orders.map(async (order) => {
        order.status = DexOrderStatus.COMPLETED
        order.completedReason = DexOrderCompletedReason.MISSED_BUYING_PRICE
        this._telegramJobApiService.unpinMessage(
          order.chatDexOrderId,
          order.messageDexOrderId
        );
        const inputParams: SwapTokensArgs = {
          chainId: this._appConfig.countChainId,
          walletAddress: this._appConfig.metamaskWalletAddress,
          tokenInAddress: this._appConfig.etherTokenAddress,
          tokenOutAddress: order.tokenAddress,
          amountInStr: `${this._appConfig.copyTradingTargetBuyingAmountEth}`,
          alchemyApiToken: this._appConfig.alchemyApiKey,
          privateKey: this._appConfig.metamaskPrivateKey,
        };
        const result = await getTokenPrice(inputParams);
        const tokenDexOrder: TokenEconomics = {
          tokenSymbol: result.tokenOutSymbol,
          tokenPerEth: result.numberQuotedAmountOut,
          tokenPerUsd: result.numberQuotedAmountOut / this._ethPriceService.price,
          ethPrice: this._ethPriceService.price,
          ethPerToken: result.priceEthToken,
          usdPerToken: this._ethPriceService.price / result.numberQuotedAmountOut,
          tokenAddress: order.tokenAddress,
          calculatedAt: new Date(),
          calculatedAtBlockNumber: result.currentBlockNumber,
        };
        const savedOrder = await this._dexOrderRepository.save(order);
        const messageText = await messageDexOrder(tokenDexOrder, order);
        await this._telegramJobApiService.editMessageText(
          Number(order.chatDexOrderId),
          messageText,
          order.messageDexOrderId,
          undefined,
          {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }
        );
        return savedOrder;
        
      })
    );
  }

}
