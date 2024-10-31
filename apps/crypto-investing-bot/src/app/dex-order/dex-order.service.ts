import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DexOrderEntity } from './dex-order.entity';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { DexOrderCompletedReason, DexOrderStatus } from './dex-order.models';
import { DexTransactionEntity } from '../dex-transactions/dex-transaction.entity';
import { DexTransactionService } from '../dex-transactions/dex-transactions.service';
import { DexTransactionEconomics, DexTransactionType, TokenEconomics } from '../eth-transactions-watcher-logic/domain-logic/handle-swap';
import { TelegramJobApiService } from '../telegraf/telegram-job-api.service';
import { messageDexOrder } from '../eth-transactions-watcher-logic/domain-logic/message-dex-order';
import { inspect } from 'util';

@Injectable()
export class DexOrderService {
  constructor(
    @InjectRepository(DexOrderEntity)
    private readonly _dexOrderRepository: Repository<DexOrderEntity>,
    private readonly _dexTransactionService: DexTransactionService,
    private readonly _telegramJobApiService: TelegramJobApiService,
  ) {}

  async createOrder(order: DexOrderEntity) {
    // TODO implement order creation
    return this._dexOrderRepository.save(order);
  }
  async updateOrderMessageChatId(dexOrderId: number, messageId: number, chatId: number) {
    const order = await this._dexOrderRepository.findOne({
      where: {
        id: dexOrderId
      },
      relations: ['wallet'],
    })
    order.messageDexOrderId = messageId;
    order.chatDexOrderId = chatId;
    const savedOrder = await this._dexOrderRepository.save(order);
    return savedOrder;
  }

  async handleManualCancelOrder(orderId: number) {
    // Кейс с тем что пользователь отменил ордер вручную
    throw new NotImplementedException();
  }

  async handleCopyTradingWalletSellOrder(dexTransactionEntity: DexTransactionEntity) {
    // Кейс с тем что копируемый кошелек продал монету
    throw new NotImplementedException();
  }

  async handleTokenPriceChange(
    tokenEconomics: TokenEconomics,
  ) {
    await Promise.allSettled([
      this.handleTokenPriceChangeBuyOrders(
        tokenEconomics
      ),
      this.handleTokenPriceChangeSellOrders(
        tokenEconomics
      )
    ]);
  }

  async handleTokenPriceChangeBuyOrders(
    tokenEconomics: TokenEconomics,
  ) {
    const orders = await this._dexOrderRepository.find({
      where: {
        tokenAddress: tokenEconomics.tokenAddress,
        status: DexOrderStatus.BUYING,
        targetBuyingPrice: MoreThanOrEqual(tokenEconomics.ethPerToken),
      },
      relations: ['wallet'],
    });

    const results = await Promise.allSettled(
      orders.map(async (order) => {
        const mockBuyingTransaction = await this.createMockDexBuyingTransaction(
          tokenEconomics.calculatedAtBlockNumber,
          `mock-buy-${order.id}`,
          order.wallet.hash,
          {
            action: DexTransactionType.BUY,
            tokenAddress: tokenEconomics.tokenAddress,
            amountToken: order.targetBuyingAmountEth / tokenEconomics.ethPerToken,
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
        const savedOrder = await this._dexOrderRepository.save(order);
        return savedOrder;
      })
    );
    Logger.log(`Handled ${results.length} buy orders for token ${tokenEconomics.tokenSymbol}`);
  }

  async handleTokenPriceChangeSellOrders(
    tokenEconomics: TokenEconomics,
  ) {
    const orders = await this._dexOrderRepository.find({
      where: {
        tokenAddress: tokenEconomics.tokenAddress,
        status: DexOrderStatus.SELLING,
        targetSellingPrice: LessThanOrEqual(tokenEconomics.ethPerToken),
      },
      relations: ['wallet'],
    });

    const results = await Promise.allSettled(
      orders.map(async (order) => {
        const mockSellingTransaction = await this.createMockDexBuyingTransaction(
          tokenEconomics.calculatedAtBlockNumber,
          `mock-buy-${order.id}`,
          order.wallet.hash,
          {
            action: DexTransactionType.SELL,
            tokenAddress: tokenEconomics.tokenAddress,
            amountToken: order.targetBuyingAmountEth / tokenEconomics.ethPerToken,
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
        order.completedReason = DexOrderCompletedReason.TRADING_PROFIT
        const savedOrder = await this._dexOrderRepository.save(order);
        return savedOrder;
      })
    );
    Logger.log(`Handled ${results.length} buy orders for token ${tokenEconomics.tokenSymbol}`);
  }

  async handleTokenPriceChangeMessage(
  tokenEconomics: TokenEconomics,
  ) {
  const orders = await this._dexOrderRepository.find({
    where: {
      tokenAddress: tokenEconomics.tokenAddress,
      status: In([DexOrderStatus.BUYING, DexOrderStatus.SELLING, DexOrderStatus.COMPLETED]),
    },
    relations: ['wallet'],
  });

  const results = await Promise.allSettled(
    orders.map(async (order) => {
      const messageText = await messageDexOrder(tokenEconomics, order);
      if (order.status === DexOrderStatus.COMPLETED) {
        // ТАК НИКОГДА НЕ ДЕЛАТЬ - бесконечное создание событий unpinMessage
        // await this._telegramJobApiService.unpinMessage(order.chatDexOrderId, order.messageDexOrderId)
      }
      else {
        // Формируем массив кнопок в зависимости от статуса ордера
        const autoSellEnabledButtons = [{ text: 'Stop', callback_data: `dexOrderManualStop_${order.id}` }]
        autoSellEnabledButtons.push()
        if (order.isAutoSellEnabled) {
          autoSellEnabledButtons.push({ text: 'stopAutoSell', callback_data: `isStopAutoSellEnabled_${order.id}` })
        }
        else if (!order.isAutoSellEnabled) {
          autoSellEnabledButtons.push({ text: 'startAutoSell', callback_data: `isStartAutoSellEnabled_${order.id}` })
        }
        
        const buttons = [];
        const priceChangeButtons = [
          { text: '-1 %', callback_data: `dexOrderTargetPriceChangeLess_${order.id}` },
          { text: '+1 %', callback_data: `dexOrderTargetPriceChangeMore_${order.id}` }
        ];
        buttons.push(autoSellEnabledButtons);
        buttons.push(priceChangeButtons);
  
        // Добавляем кнопку в зависимости от статуса ордера
        if (order.status === DexOrderStatus.SELLING) {
          buttons.push([{ text: 'change percent', callback_data: `dexOrderChangePercent_${order.id}` }]);
        } 
        if (order.status === DexOrderStatus.BUYING) {
          buttons.push([{ text: 'change price', callback_data: `dexOrderChangePrice_${order.id}` }]);
        }

        await this._telegramJobApiService.editMessageText(
          order.chatDexOrderId,
          messageText,
          order.messageDexOrderId,
          undefined,
          {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: buttons,
            },
          },
        );
      }
    }),
  );
  }

  async handleTokenPriceChangeSellEarly(
    tokenEconomics: DexTransactionEntity,
  ) {
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
    Logger.log(`Handled ${results.length} buy orders for token ${inspect(tokenEconomics)}`);
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
      isMockTransaction,
    );
  }
  async getAllTokenAddresses(): Promise<Set<string>> {
    try {
      const orders = await this._dexOrderRepository.find({
        select: ['tokenAddress'],
      });

      const tokenAddresses = orders.map(order => order.tokenAddress);
      return new Set(tokenAddresses);
    } catch (error) {
      Logger.error(`Failed to get all token addresses: ${error.message}`);
      throw error;
    }
  }

  async dexOrderStop(dexOrderId: number) {
    const order = await this._dexOrderRepository.findOne({
        where: {
            id: dexOrderId
        },
        relations: ['wallet'],
    });

    if (!order) {
        throw new Error(`Order with ID ${dexOrderId} not found.`);
    }

    order.status = DexOrderStatus.COMPLETED;
    order.completedReason = DexOrderCompletedReason.MANUAL;

    await this._dexOrderRepository.save(order);
  }

  async dexOrderRaisePrice(dexOrderId: number) {
    const order = await this._dexOrderRepository.findOne({
        where: {
            id: dexOrderId
        },
        relations: ['wallet'],
    });

    if (!order) {
        throw new Error(`Order with ID ${dexOrderId} not found.`);
    }
    if(order.status == DexOrderStatus.BUYING)
      order.targetBuyingPrice = order.targetBuyingPrice * 1.01;
    if(order.status == DexOrderStatus.SELLING)
      order.targetSellingPrice = order.targetSellingPrice * 1.01;
    await this._dexOrderRepository.save(order);
  }

  async dexOrderReductionPrice(dexOrderId: number) {
    const order = await this._dexOrderRepository.findOne({
        where: {
            id: dexOrderId
        },
        relations: ['wallet'],
    });

    if (!order) {
        throw new Error(`Order with ID ${dexOrderId} not found.`);
    }
    if(order.status == DexOrderStatus.BUYING)
      order.targetBuyingPrice = order.targetBuyingPrice * 0.99;
    if(order.status == DexOrderStatus.SELLING)
      order.targetSellingPrice = order.targetSellingPrice * 0.99;
    await this._dexOrderRepository.save(order);
  }

  async dexOrderChangePrice(dexOrderId: number, newTargetPrice: number) {
    const order = await this._dexOrderRepository.findOne({
        where: {
            id: dexOrderId
        },
        relations: ['wallet'],
    });

    if (!order) {
        throw new Error(`Order with ID ${dexOrderId} not found.`);
    }
    if(order.status == DexOrderStatus.BUYING)
      order.targetBuyingPrice = newTargetPrice;
    if(order.status == DexOrderStatus.SELLING)
      order.targetSellingPrice = order.sourceBuyingTransactionPrice * (newTargetPrice / 100 + 1);
    await this._dexOrderRepository.save(order);
  }

  async dexOrderStopAutoSell(dexOrderId: number) {
    const order = await this._dexOrderRepository.findOne({
        where: {
            id: dexOrderId
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
            id: dexOrderId
        },
        relations: ['wallet'],
    });

    if (!order) {
        throw new Error(`Order with ID ${dexOrderId} not found.`);
    }
    order.isAutoSellEnabled = true;
    await this._dexOrderRepository.save(order);
  }

}
