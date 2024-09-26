import { Token as TokenV3 } from "@uniswap/sdk-core";
import { Token as TokenV2, Fetcher, Route, Trade, TokenAmount, TradeType } from "@uniswap/sdk";
import { ethers } from "ethers";
import { SwapTokensArgs } from '../../utils/crypto-core/buy-coins';
import { Logger } from "@nestjs/common";
import { Pool } from "@uniswap/v3-sdk";
import { smartRound } from "./smart-round";
import ERC20_abi from "../../utils/crypto-core/ERC20-abi.json";
import IUniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json';
import IUniswapV3Pool from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import QuoterABI from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { AppConfig } from "../../app.config";

const UNISWAP_FACTORY_ADDRESS_V2 = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const UNISWAP_FACTORY_ADDRESS_V3 = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const UNISWAP_QUOTER_ADDRESS_V3 = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
const WETH_ADDRESS_NETWORK_MAP = {
    [1]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    [42161]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
};
const _appConfig = new AppConfig();

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
    const currentBlockNumber = await provider.getBlockNumber();

    const getTokenAndBalance = async (contract) => {
        const [dec, symbol, name, balance] = await Promise.all([
            contract.decimals(),
            contract.symbol(),
            contract.name(),
            contract.balanceOf(walletAddress)
        ]);
        return [new TokenV3(chainId, contract.address, dec, symbol, name), balance];
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
        tokenIn = new TokenV3(chainId, WETH_ADDRESS, 18, "WETH", "Wrapped Ether");
        balanceTokenIn = await provider.getBalance(walletAddress);
    } else if (isETH(tokenOutAddress)) {
        tokenInContract = new ethers.Contract(tokenInAddress, ERC20_abi, signer);
        [tokenIn, balanceTokenIn] = await getTokenAndBalance(tokenInContract);
        tokenOut = new TokenV3(chainId, WETH_ADDRESS, 18, "WETH", "Wrapped Ether");
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

    // Попробуем получить цену через Uniswap V3
    let numberQuotedAmountOut, priceEthToken, message;

    try {
        const factoryContractV3 = new ethers.Contract(UNISWAP_FACTORY_ADDRESS_V3, IUniswapV3Factory.abi, provider);

        // Попробуем найти пул с разными комиссиями
        const fees = [100, 500, 3000, 10000]; // Возможные комиссии: 0.05%, 0.3%, 1%
        let poolAddressV3;
        let fee;
        for (let f of fees) {
            poolAddressV3 = await factoryContractV3.getPool(tokenIn.address, tokenOut.address, f);
            if (poolAddressV3 !== ethers.constants.AddressZero) {
                fee = f;
                break;
            }
        }

        if (poolAddressV3 === ethers.constants.AddressZero) {
            throw new Error(`No pool found on Uniswap V3 for ${tokenIn.symbol}-${tokenOut.symbol}`);
        }

        const poolContractV3 = new ethers.Contract(poolAddressV3, IUniswapV3Pool.abi, provider);
        const [liquidity, slot] = await Promise.all([poolContractV3.liquidity(), poolContractV3.slot0()]);
        const pool = new Pool(tokenIn, tokenOut, fee, slot[0].toString(), liquidity.toString(), slot[1]);

        const amountIn = ethers.utils.parseUnits(amountInStr, tokenIn.decimals);
        const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS_V3, QuoterABI.abi, provider);
        const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
            tokenIn.address, tokenOut.address, pool.fee, amountIn, 0);

        numberQuotedAmountOut = Number(ethers.utils.formatUnits(quotedAmountOut, tokenOut.decimals));
        priceEthToken = (Number(amountInStr) / numberQuotedAmountOut);

        message = `You'll get approximately ${ethers.utils.formatUnits(quotedAmountOut, tokenOut.decimals)} ${tokenOut.symbol} for ${amountInStr} ${tokenIn.symbol} on Uniswap V3`;

    } catch (error) {
        Logger.warn(`Uniswap V3 failed: ${error.message}`);
        // Попробуем через Uniswap V2
        try {
            // Создаем объекты токенов для Uniswap V2
            const tokenInV2 = new TokenV2(chainId, tokenIn.address, tokenIn.decimals, tokenIn.symbol, tokenIn.name);
            const tokenOutV2 = new TokenV2(chainId, tokenOut.address, tokenOut.decimals, tokenOut.symbol, tokenOut.name);

            const pair = await Fetcher.fetchPairData(tokenInV2, tokenOutV2, provider);
            const route = new Route([pair], tokenInV2);
            const amountIn = ethers.utils.parseUnits(amountInStr, tokenIn.decimals);
            const trade = new Trade(route, new TokenAmount(tokenInV2, amountIn.toString()), TradeType.EXACT_INPUT);

            numberQuotedAmountOut = Number(trade.outputAmount.toExact());
            priceEthToken = (Number(amountInStr) / numberQuotedAmountOut);

            message = `You'll get approximately ${numberQuotedAmountOut} ${tokenOut.symbol} for ${amountInStr} ${tokenIn.symbol} on Uniswap V2`;

        } catch (error) {
            Logger.error(`Uniswap V2 failed: ${error.message}`);
            throw new Error(`Unable to find price on both Uniswap V3 and V2 for ${tokenIn.symbol}-${tokenOut.symbol}`);
        }
    }

    return {
        message,
        numberQuotedAmountOut,
        priceEthToken,
        tokenOutSymbol: tokenOut.symbol,
        tokenInSymbol: tokenIn.symbol,
        currentBlockNumber
    }
}

export async function messageTokenPrice({
    chainId,
    walletAddress,
    tokenInAddress,
    tokenOutAddress,
    amountInStr,
    alchemyApiToken,
    privateKey
}: SwapTokensArgs) {
    const result = await getTokenPrice({
        chainId,
        walletAddress,
        tokenInAddress,
        tokenOutAddress,
        amountInStr,
        alchemyApiToken,
        privateKey
    });
    const message = `You'll get approximately ${smartRound(result.numberQuotedAmountOut)} ${result.tokenOutSymbol} for ${amountInStr} ${result.tokenInSymbol}\n${amountInStr} ${result.tokenOutSymbol} for ${smartRound(result.priceEthToken)} ${result.tokenInSymbol}`
    return message;
}
