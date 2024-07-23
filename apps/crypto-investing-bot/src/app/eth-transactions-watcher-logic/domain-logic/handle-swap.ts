import { Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { Fungible, Log } from './models';
import { getTokenAddresses } from './get-token-address';
import { ERC20_ABI, getTokenMetaData } from './get-token-metadata';

export type HandledSwap = {
  action: string;
  amountToken: string;
  amountWETH: string;
  amountUSD: string;
  tokenSymbol: string;
  tokenPerEth: string;
  tokenPerUsd: string;
};

export async function handleSwap(
  swapLog: Log,
  provider: ethers.providers.AlchemyProvider,
  poolCache: Map<string, [string, string]>,
  tokenCache: Map<string, Fungible>,
  ethPrice: number
): Promise<HandledSwap | undefined> {
  const parsedLog = new ethers.utils.Interface(ERC20_ABI).parseLog(swapLog);
  if (!parsedLog) {
    Logger.warn('Parsed swapLog is missing');
    return;
  }

  let amount0In, amount1In, amount0Out, amount1Out, token0Address, token1Address;
  
  if (parsedLog.name === 'Swap') {
    ({ amount0In, amount1In, amount0Out, amount1Out } = parsedLog.args);
    [token0Address, token1Address] = await getTokenAddresses(
      swapLog.address,
      provider,
      poolCache
    );
  } else if (parsedLog.name === 'SwapERC20') {
    ({ signerToken: token0Address, signerAmount: amount0In, senderToken: token1Address, senderAmount: amount1In } = parsedLog.args);
    amount0Out = amount1In;
    amount1Out = amount0In;
  } else {
    Logger.warn('Unknown swap event type');
    return;
  }

  const token0 = await getTokenMetaData(token0Address, provider, tokenCache);
  const token1 = await getTokenMetaData(token1Address, provider, tokenCache);

  const amount0InFormatted = ethers.utils.formatUnits(amount0In, 18);
  const amount1InFormatted = ethers.utils.formatUnits(amount1In, 18);
  const amount0OutFormatted = ethers.utils.formatUnits(amount0Out, 18);
  const amount1OutFormatted = ethers.utils.formatUnits(amount1Out, 18);

  let action, amountToken, amountWETH, tokenSymbol, tokenPerEth;

  if (token0.symbol === 'WETH') {
    if (parseFloat(amount0InFormatted) > 0) {
      action = 'BUY';
      amountToken = amount1OutFormatted;
      amountWETH = amount0InFormatted;
      tokenSymbol = token1.symbol;
      tokenPerEth = (
        parseFloat(amount1OutFormatted) / parseFloat(amount0InFormatted)
      ).toFixed(6);
    } else {
      action = 'SELL';
      amountToken = amount1InFormatted;
      amountWETH = amount0OutFormatted;
      tokenSymbol = token1.symbol;
      tokenPerEth = (
        parseFloat(amount1InFormatted) / parseFloat(amount0OutFormatted)
      ).toFixed(6);
    }
  } else {
    if (parseFloat(amount1InFormatted) > 0) {
      action = 'BUY';
      amountToken = amount0OutFormatted;
      amountWETH = amount1InFormatted;
      tokenSymbol = token0.symbol;
      tokenPerEth = (
        parseFloat(amount0OutFormatted) / parseFloat(amount1InFormatted)
      ).toFixed(6);
    } else {
      action = 'SELL';
      amountToken = amount0InFormatted;
      amountWETH = amount1OutFormatted;
      tokenSymbol = token0.symbol;
      tokenPerEth = (
        parseFloat(amount0InFormatted) / parseFloat(amount1OutFormatted)
      ).toFixed(6);
    }
  }

  const amountUSD = (parseFloat(amountWETH) * ethPrice).toFixed(2);
  const tokenPerUsd = (parseFloat(tokenPerEth) / ethPrice).toFixed(6);

  return {
    action,
    amountToken,
    amountWETH,
    amountUSD,
    tokenSymbol,
    tokenPerEth,
    tokenPerUsd,
  };
}
