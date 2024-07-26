import { DexTransactionEntity } from "../../dex-transactions/dex-transaction.entity";
import { DexTransactionEconomics, DexTransactionType } from "./handle-swap";

/** 
 * Если есть история транзакций и текущая сделка на продажу - ищем за сколько покупали токены, что бы вычислить итоговый результат в эфирах 
 * BUY - это сделки когда токены купили за эфиры
 * SELL - это сделки которые токены продали за эфиры
 * 
 * Жадный алгоритм, перебираем предыдущие транзакции (они переданы отсортированные по убыванию)
 * Пока сумма текущих проданных токенов меньше суммы покупок - для каждой покупки смотрим сколько эфиров на них потратили и сколько токенов купили
 * В итоге получаем сколько эфиров потратили на покупку токенов и за сколько продали, возвращаем разницу
 * Если в истории нет покупок - возвращаем NO_DATA
*/
export type TradeProfitResult = {
    profit: number | string;
    profitUSD: number | string;
    timeHeld: number | string; // in milliseconds or 'NO_DATA'
    roi: number | string; // as a percentage or 'NO_DATA'
    details: {
        tokenSymbol: string;
        tokenAddress: string;
        tokensBought: number;
        ethSpent: number;
        purchaseDate: Date;
        ethUsdPrice: number;
    }[];
};


export function calculateTradeProfit(economics: DexTransactionEconomics, prevTransactions: DexTransactionEntity[]): TradeProfitResult {
    if (economics.action !== DexTransactionType.SELL) {
        return {
            profit: 'NO_DATA',
            profitUSD: 'NO_DATA',
            timeHeld: 'NO_DATA',
            roi: 'NO_DATA',
            details: []
        };
    }

    let remainingTokensToSell = economics.amountToken;
    let totalEthSpent = 0;
    const totalEthReceived = economics.amountWETH;
    let totalUsdSpent = 0;
    const details: TradeProfitResult['details'] = [];
    const purchaseDates: Date[] = [];

    for (const transaction of prevTransactions) {
        if (transaction.economics.action === DexTransactionType.BUY) {
            const buyEconomics = transaction.economics;
            const tokensBought = buyEconomics.amountToken;
            const ethSpent = buyEconomics.amountWETH;
            const ethUsdPrice = buyEconomics.ethPrice;
            const purchaseDate = transaction.createdAt;

            if (remainingTokensToSell <= tokensBought) {
                const ethForThisPart = (remainingTokensToSell / tokensBought) * ethSpent;
                totalEthSpent += ethForThisPart;
                totalUsdSpent += ethForThisPart * ethUsdPrice;
                details.push({
                    tokenSymbol: buyEconomics.tokenSymbol,
                    tokenAddress: buyEconomics.tokenAddress,
                    tokensBought: remainingTokensToSell,
                    ethSpent: ethForThisPart,
                    purchaseDate,
                    ethUsdPrice
                });
                purchaseDates.push(purchaseDate);
                remainingTokensToSell = 0;
                break;
            } else {
                totalEthSpent += ethSpent;
                totalUsdSpent += ethSpent * ethUsdPrice;
                details.push({
                    tokenSymbol: buyEconomics.tokenSymbol,
                    tokenAddress: buyEconomics.tokenAddress,
                    tokensBought: tokensBought,
                    ethSpent: ethSpent,
                    purchaseDate,
                    ethUsdPrice
                });
                purchaseDates.push(purchaseDate);
                remainingTokensToSell -= tokensBought;
            }
        }
    }

    if (remainingTokensToSell > 0) {
        return {
            profit: 'NO_DATA',
            profitUSD: 'NO_DATA',
            timeHeld: 'NO_DATA',
            roi: 'NO_DATA',
            details: []
        };
    }

    const profit = totalEthReceived - totalEthSpent;
    const profitUSD = totalEthReceived * economics.ethPrice - totalUsdSpent;
    const timeHeld = purchaseDates.length > 0 ? economics.calculatedAt.getTime() - Math.min(...purchaseDates.map(date => date.getTime())) : 'NO_DATA';
    const roi = totalUsdSpent > 0 ? (profitUSD / totalUsdSpent) * 100 : 'NO_DATA';

    return {
        profit,
        profitUSD,
        timeHeld,
        roi,
        details
    };
}
