import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DexOrderEntity } from './dex-order.entity';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { DexOrderStatus } from './dex-order.models';
import { DexTransactionEntity } from '../dex-transactions/dex-transaction.entity';
import { DexTransactionService } from '../dex-transactions/dex-transactions.service';
import { DexTransactionEconomics, DexTransactionType, TokenEconomics } from '../eth-transactions-watcher-logic/domain-logic/handle-swap';

@Injectable()
export class DexOrderService {
  constructor(
    @InjectRepository(DexOrderEntity)
    private readonly _dexOrderRepository: Repository<DexOrderEntity>,
    private readonly _dexTransactionService: DexTransactionService
  ) {}

  async createOrder(order: DexOrderEntity) {
    // TODO implement order creation
    return this._dexOrderRepository.save(order);
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
      // TODO add handling for selling orders
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

  async handleTokenPriceChangeSell(
    tokenEconomics: TokenEconomics,
  ) {
    await Promise.allSettled([
      this.handleTokenPriceChangeSellOrders(
        tokenEconomics
      ),
      // TODO add handling for selling orders
    ]);
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
        const mockBuyingTransaction = await this.createMockDexBuyingTransaction(
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
        order.buyingTransactions = [mockBuyingTransaction];
        const savedOrder = await this._dexOrderRepository.save(order);
        return savedOrder;
      })
    );
    Logger.log(`Handled ${results.length} buy orders for token ${tokenEconomics.tokenSymbol}`);
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
}
