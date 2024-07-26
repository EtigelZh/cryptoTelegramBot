import { TradeProfitResult } from "./calculate-profit";

export function formatTradeProfitResult(result: TradeProfitResult): string {
    if (result.profit === 'NO_DATA') {
        return '❌ No Data Available';
    }

    const profitEth = typeof result.profit === 'number' ? result.profit.toFixed(4) : result.profit;
    const profitUSD = typeof result.profitUSD === 'number' ? result.profitUSD.toFixed(2) : result.profitUSD;
    const timeHeld = typeof result.timeHeld === 'number' ? (result.timeHeld / (1000 * 60 * 60 * 24)).toFixed(2) + ' days' : result.timeHeld;
    const roi = typeof result.roi === 'number' ? result.roi.toFixed(2) + '%' : result.roi;

    const profitEmoji = typeof result.profit === 'number' && result.profit > 0 ? '🟢' : '🔴';

    const detailsStr = result.details.map(detail => {
        return `🛒 ${detail.tokensBought} ${detail.tokenSymbol} bought for ${detail.ethSpent.toFixed(4)} ETH at ${detail.ethUsdPrice} USD/ETH on ${detail.purchaseDate.toDateString()}`;
    }).join('\n');

    return `
${profitEmoji} Profit: ${profitEth} ETH (${profitUSD}$)
⏳ Time Held: ${timeHeld}
📈 ROI: ${roi}
📋 Details:
${detailsStr}
    `.trim();
}