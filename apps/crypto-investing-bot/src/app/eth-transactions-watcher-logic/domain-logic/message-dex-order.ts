import { retry } from "rxjs";
import { DexOrderEntity } from "../../dex-order/dex-order.entity";
import { TokenEconomics } from "./handle-swap";
import { smartRound } from "./smart-round";

async function getElapsedTime(calculatedAt: Date): Promise<string> {
    const now = new Date();
    const elapsedMilliseconds = now.getTime() - calculatedAt.getTime();
  
    const millisecondsPerSecond = 1000;
    const millisecondsPerMinute = millisecondsPerSecond * 60;
    const millisecondsPerHour = millisecondsPerMinute * 60;
    const millisecondsPerDay = millisecondsPerHour * 24;
  
    const days = Math.floor(elapsedMilliseconds / millisecondsPerDay);
    const hours = Math.floor((elapsedMilliseconds % millisecondsPerDay) / millisecondsPerHour);
    const minutes = Math.floor((elapsedMilliseconds % millisecondsPerHour) / millisecondsPerMinute);
    const seconds = Math.floor((elapsedMilliseconds % millisecondsPerMinute) / millisecondsPerSecond);
  
    return `${days} days, ${hours} hours, ${minutes} minutes, and ${seconds} seconds ago`;
  }

async function messageEconmics(tokenEconomics: TokenEconomics, order: DexOrderEntity) {

    const initialValue = order.sourceBuyingTransactionPrice * order.sourceBuyingTransactionAmount;
    const currentValue = tokenEconomics.ethPerToken * order.sourceBuyingTransactionAmount;
    const percentChange = ((currentValue - initialValue) / initialValue) * 100;
    const dexOrderPercent = order.targetSellingPrice / order.sourceBuyingTransactionPrice * 100 - 100
    const timeElapsed = await getElapsedTime(order.createdAt)

    return {
        tokenEconmicsSymbol: tokenEconomics.tokenSymbol,
        statusDexOrder: order.status,
        percentChange,
        initialValue,
        currentValue,
        timeElapsed,
        price: tokenEconomics.usdPerToken,
        targetBuyingPrice: order.targetBuyingPrice,
        dexOrderPercent,
        isAutoSellEnabled: order.isAutoSellEnabled,
        priceEth: tokenEconomics.ethPerToken
    };
  }

export async function messageDexOrder(tokenEconomics: TokenEconomics, orderPromise: DexOrderEntity) {
    const result = await messageEconmics(tokenEconomics, orderPromise)
    const dextoolsLink = `https://www.dextools.io/app/ru/ether/pair-explorer/${tokenEconomics.tokenAddress}`;
    let messageText =
    `[${tokenEconomics.tokenSymbol}](${dextoolsLink}) 🚀 ${smartRound(
      result.percentChange
    )}% status: ${result.statusDexOrder}\n` +
    `Initial: ${smartRound(result.initialValue)} ETH\n` +
    `Worth: ${smartRound(result.currentValue)} ETH\n` +
    `Time elapsed: ${result.timeElapsed}\n` +
    `💵 Price: ${smartRound(result.price)} $\n` +
    `💵 Price to ETH: ${smartRound(result.priceEth)} ETH\n`;

    if (result.statusDexOrder === "SELLING") {
      if (result.isAutoSellEnabled) {
        messageText += `DEX ORDER PERCENT: ${smartRound(result.dexOrderPercent)}% (AutoSell ON)`;
      }
      else {
        messageText += `DEX ORDER PERCENT: ${smartRound(result.dexOrderPercent)}% (AutoSell OFF)`;
      }
    }
    if (result.statusDexOrder === "BUYING") {
      messageText += `TARGET BUY PRICE: ${smartRound(result.targetBuyingPrice)} ETH`;
    }
    return messageText
}