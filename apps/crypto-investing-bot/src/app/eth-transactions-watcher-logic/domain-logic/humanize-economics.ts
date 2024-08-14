import { DexTransactionEconomics, formatAction } from "./handle-swap";
import { smartRound } from "./smart-round";
import { WalletEntity } from "../../wallet/wallet.entity";

export function humanizeEconomics(economics: DexTransactionEconomics, walletEntity: WalletEntity, etherscanTxUrl: string): string{

    const {
        action,
        amountToken,
        amountWETH,
        amountUSD,
        tokenSymbol,
        ethPrice,
        ethPerToken,
        usdPerToken
      } = economics;
      const messageParts = [
        `${formatAction(action)} [${
          walletEntity?.alias || walletEntity?.hash
        }](${etherscanTxUrl})`,
        `${smartRound(amountToken)} ${tokenSymbol} ${
          action === 'BUY' ? '←' : '→'
        } ${smartRound(amountWETH)} ETH (${smartRound(amountUSD)}$)`,
        `1 ${tokenSymbol} = ${smartRound(ethPerToken)} ETH (${smartRound(
          usdPerToken
        )}$), 1 ETH = ${smartRound(ethPrice)}$`,
      ];
  
      if (action === 'BUY') {
        messageParts.push(`TARGET BUY PRICE: \`${smartRound(usdPerToken * 0.98)}\`$`);
      }
      return messageParts.join('\n');
}