import { Token } from "@uniswap/sdk-core";
import { ethers } from "ethers";
import { SwapTokensArgs } from '../../utils/crypto-core/buy-coins';
import { Logger } from "@nestjs/common";
import { Pool } from "@uniswap/v3-sdk";
import { smartRound } from "./smart-round";
import ERC20_abi from "../../utils/crypto-core/ERC20-abi.json";
import IUniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json';
import IUniswapV3Pool from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import QuoterABI from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';

const UNISWAP_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const UNISWAP_QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
const WETH_ADDRESS_NETWORK_MAP = {
    [1]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    [42161]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
};

export async function getTokenPrice({
    chainId,
    walletAddress,
    tokenInAddress,
    tokenOutAddress,
    amountInStr,
    alchemyApiToken,
    privateKey
}: SwapTokensArgs) {
    const provider = new ethers.providers.AlchemyProvider(chainId, alchemyApiToken);
    const signer = new ethers.Wallet(privateKey, provider);

    const getTokenAndBalance = async (contract) => {
        const [dec, symbol, name, balance] = await Promise.all([
            contract.decimals(),
            contract.symbol(),
            contract.name(),
            contract.balanceOf(walletAddress)
        ]);
        return [new Token(chainId, contract.address, dec, symbol, name), balance];
    };

    const WETH_ADDRESS = WETH_ADDRESS_NETWORK_MAP[+chainId];
    if (!WETH_ADDRESS) {
        throw new Error(`WETH address is not defined for chainId ${chainId}`);
    }

    const isETH = (address) => address?.toLowerCase() === ethers.constants.AddressZero?.toLowerCase();

    let tokenIn, tokenOut, balanceTokenIn, balanceTokenOut, tokenOutContract, tokenInContract;
    if (isETH(tokenInAddress)) {
        tokenOutContract = new ethers.Contract(tokenOutAddress, ERC20_abi, signer);
        [tokenOut, balanceTokenOut] = await getTokenAndBalance(tokenOutContract);
        tokenIn = new Token(chainId, WETH_ADDRESS, 18, "WETH", "Wrapped Ether");
        balanceTokenIn = await provider.getBalance(walletAddress);
    } else if (isETH(tokenOutAddress)) {
        tokenInContract = new ethers.Contract(tokenInAddress, ERC20_abi, signer);
        [tokenIn, balanceTokenIn] = await getTokenAndBalance(tokenInContract);
        tokenOut = new Token(chainId, WETH_ADDRESS, 18, "WETH", "Wrapped Ether");
        balanceTokenOut = await provider.getBalance(walletAddress);
    } else {
        tokenInContract = new ethers.Contract(tokenInAddress, ERC20_abi, signer);
        tokenOutContract = new ethers.Contract(tokenOutAddress, ERC20_abi, signer);
        [tokenIn, balanceTokenIn] = await getTokenAndBalance(tokenInContract);
        [tokenOut, balanceTokenOut] = await getTokenAndBalance(tokenOutContract);
    }

    try {
        Logger.log(`Wallet ${walletAddress} balances:`);
        Logger.log(`   Input: ${tokenIn.symbol} (${tokenIn.name}): ${ethers.utils.formatUnits(balanceTokenIn, tokenIn.decimals)}`);
        Logger.log(`   Output: ${tokenOut.symbol} (${tokenOut.name}): ${ethers.utils.formatUnits(balanceTokenOut, tokenOut.decimals)}`);    
    } catch (error) {
        Logger.error(`Error while logging balances: ${error}`);
    }

    const factoryContract = new ethers.Contract(UNISWAP_FACTORY_ADDRESS, IUniswapV3Factory.abi, provider);
    const poolAddress = await factoryContract.getPool(tokenIn.address, tokenOut.address, 3000);
    if (Number(poolAddress).toString() === "0") throw `Error: No pool ${tokenIn.symbol}-${tokenOut.symbol}`;

    const poolContract = new ethers.Contract(poolAddress, IUniswapV3Pool.abi, provider);
    const [liquidity, slot] = await Promise.all([poolContract.liquidity(), poolContract.slot0()]);
    const pool = new Pool(tokenIn, tokenOut, 3000, slot[0].toString(), liquidity.toString(), slot[1]);

    const amountIn = ethers.utils.parseUnits(amountInStr, tokenIn.decimals);
    const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS, QuoterABI.abi, provider);
    const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
        tokenIn.address, tokenOut.address, pool.fee, amountIn, 0);

    let numberQuotedAmountOut = ethers.utils.formatUnits(quotedAmountOut, tokenOut.decimals)
    let priceEthToken = (Number(amountInStr)/Number(numberQuotedAmountOut)).toFixed(30)
    priceEthToken = smartRound(Number(priceEthToken))
    numberQuotedAmountOut = smartRound(Number(numberQuotedAmountOut))
    const message = `You'll get approximately ${numberQuotedAmountOut} ${tokenOut.symbol} for ${amountInStr} ${tokenIn.symbol}\n${amountInStr} ${tokenOut.symbol} for ${priceEthToken} ${tokenIn.symbol}`
    return message
    // ТУТ вычисляем из примерного количества токенов какова сейчас цена
}
