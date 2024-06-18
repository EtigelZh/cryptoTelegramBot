// Command-line utilities
import yargs from "yargs/yargs"
import { hideBin } from 'yargs/helpers'
import dotenv from 'dotenv';

// Uniswap and Web3 modules
import { ethers } from "ethers";
import QuoterABI from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { Pool } from '@uniswap/v3-sdk/'
import { TradeType, Token, CurrencyAmount, Percent } from '@uniswap/sdk-core'
import { AlphaRouter, SwapType } from '@uniswap/smart-order-router'
import IUniswapV3Pool from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'
import IUniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json'
import { BigNumber } from '@ethersproject/bignumber';

import ERC20_abi from "./ERC20-abi.json"
import { resolve } from "path";

const WETH_ADDRESS_NETWORK_MAP = {
    [1]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    [42161]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
};

const defaultEnvPath = resolve(__dirname, '.env');
dotenv.config({ path: defaultEnvPath })

async function main() {
    const options = await yargs(hideBin(process.argv))
        .usage("Swaps tokens, based on Uniswap V3 SDK")
        .option("chain-id", { describe: "Chain id to work on", type: "string", demandOption: true })
        .option("wallet-address", { describe: "Your wallet address", type: "string", demandOption: true })
        .option("token-in-address", { describe: "Input token (that you'd spend) smart contract address", type: "string", demandOption: true })
        .option("token-out-address", { describe: "Output token (that you'd receive) smart contract address", type: "string", demandOption: true })
        .option("amount-in", { describe: "Input token amount to swap", type: "string", demandOption: true })
        .argv;

    const chainId = parseInt(options.chainId);  // chainId must be integer
    const walletAddress = options.walletAddress;
    const tokenInContractAddress = options.tokenInAddress;
    const tokenOutContractAddress = options.tokenOutAddress;
    const inAmountStr = options.amountIn;
    const { API_URL = '', PRIVATE_KEY = '' } = process.env;
    console.log(`API_URL: ${API_URL}`);
    console.log("Connecting to blockchain, loading token balances...");
    console.log('');

    const provider = new ethers.providers.AlchemyProvider(chainId, API_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY!, provider);

    const getTokenAndBalance = async function (contract: ethers.Contract) {
        const [dec, symbol, name, balance] = await Promise.all(
            [
                contract.decimals(),
                contract.symbol(),
                contract.name(),
                contract.balanceOf(walletAddress)
            ]);
        return [new Token(chainId, contract.address, dec, symbol, name), balance];
    }

    const WETH_ADDRESS = WETH_ADDRESS_NETWORK_MAP[+chainId]; // WETH address on mainnet, replace with appropriate address for other chains
    if (!WETH_ADDRESS) {
        throw new Error(`WETH address is not defined for chainId ${chainId}`);
    }
    const isETH = (address: string) => address.toLowerCase() === ethers.constants.AddressZero.toLowerCase();

    let tokenIn, tokenOut, balanceTokenIn, balanceTokenOut, tokenOutContract, tokenInContract;
    if (isETH(tokenInContractAddress)) {
        tokenOutContract = new ethers.Contract(tokenOutContractAddress, ERC20_abi, signer);
        [tokenOut, balanceTokenOut] = await getTokenAndBalance(tokenOutContract);
        tokenIn = new Token(chainId, WETH_ADDRESS, 18, "WETH", "Wrapped Ether");
        balanceTokenIn = await provider.getBalance(walletAddress);
    } else if (isETH(tokenOutContractAddress)) {
        tokenInContract = new ethers.Contract(tokenInContractAddress, ERC20_abi, signer);
        [tokenIn, balanceTokenIn] = await getTokenAndBalance(tokenInContract);
        tokenOut = new Token(chainId, WETH_ADDRESS, 18, "WETH", "Wrapped Ether");
        balanceTokenOut = await provider.getBalance(walletAddress);
    } else {
        tokenInContract = new ethers.Contract(tokenInContractAddress, ERC20_abi, signer);
        tokenOutContract = new ethers.Contract(tokenOutContractAddress, ERC20_abi, signer);
        [tokenIn, balanceTokenIn] = await getTokenAndBalance(tokenInContract);
        [tokenOut, balanceTokenOut] = await getTokenAndBalance(tokenOutContract);
    }

    console.log(`Wallet ${walletAddress} balances:`);
    console.log(`   Input: ${tokenIn.symbol} (${tokenIn.name}): ${ethers.utils.formatUnits(balanceTokenIn, tokenIn.decimals)}`);
    console.log(`   Output: ${tokenOut.symbol} (${tokenOut.name}): ${ethers.utils.formatUnits(balanceTokenOut, tokenOut.decimals)}`);
    console.log("");

    console.log("Loading pool information...");

    const UNISWAP_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
    const factoryContract = new ethers.Contract(UNISWAP_FACTORY_ADDRESS, IUniswapV3Factory.abi, provider);

    const poolAddress = await factoryContract.getPool(
        tokenIn.address,
        tokenOut.address,
        3000);

    if (Number(poolAddress).toString() === "0")
        throw `Error: No pool ${tokenIn.symbol}-${tokenOut.symbol}`;

    const poolContract = new ethers.Contract(poolAddress, IUniswapV3Pool.abi, provider);

    const getPoolState = async function () {
        const [liquidity, slot] = await Promise.all([poolContract.liquidity(), poolContract.slot0()]);
        return {
            liquidity: liquidity,
            sqrtPriceX96: slot[0],
            tick: slot[1],
            observationIndex: slot[2],
            observationCardinality: slot[3],
            observationCardinalityNext: slot[4],
            feeProtocol: slot[5],
            unlocked: slot[6],
        }
    }

    const getPoolImmutables = async function () {
        const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] = await Promise.all([
            poolContract.factory(),
            poolContract.token0(),
            poolContract.token1(),
            poolContract.fee(),
            poolContract.tickSpacing(),
            poolContract.maxLiquidityPerTick(),
        ]);

        return {
            factory: factory,
            token0: token0,
            token1: token1,
            fee: fee,
            tickSpacing: tickSpacing,
            maxLiquidityPerTick: maxLiquidityPerTick,
        }
    }

    const [immutables, state] = await Promise.all([getPoolImmutables(), getPoolState()]);

    const pool = new Pool(
        tokenIn,
        tokenOut,
        immutables.fee,
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        state.tick
    );

    console.log("Token prices in pool:");
    console.log(`   1 ${pool.token0.symbol} = ${pool.token0Price.toSignificant()} ${pool.token1.symbol}`);
    console.log(`   1 ${pool.token1.symbol} = ${pool.token1Price.toSignificant()} ${pool.token0.symbol}`);
    console.log('');

    console.log("Loading up quote for a swap...");

    const amountIn = ethers.utils.parseUnits(inAmountStr, tokenIn.decimals);

    const UNISWAP_QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'
    const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS, QuoterABI.abi, provider);

    const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
        tokenIn.address,
        tokenOut.address,
        pool.fee,
        amountIn,
        0
    );

    console.log(`   You'll get approximately ${ethers.utils.formatUnits(quotedAmountOut, tokenOut.decimals)} ${tokenOut.symbol} for ${inAmountStr} ${tokenIn.symbol}`);
    console.log('');

    console.log('');
    console.log("Loading a swap route...");

    const inAmount = CurrencyAmount.fromRawAmount(tokenIn, amountIn.toString());

    const router = new AlphaRouter({ chainId: tokenIn.chainId, provider: provider });
    const route = await router.route(
        inAmount,
        tokenOut,
        TradeType.EXACT_INPUT,
        {
            type: SwapType.SWAP_ROUTER_02,
            recipient: walletAddress,
            slippageTolerance: new Percent(5, 100),
            deadline: Math.floor(Date.now() / 1000 + 1800)
        },
        {
            maxSwapsPerPath: 1
        }
    );

    if (route == null || route.methodParameters === undefined)
        throw "No route loaded";

    console.log(`   You'll get ${route.quote.toFixed()} of ${tokenOut.symbol}`);

    console.log(`   Gas Adjusted Quote: ${route.quoteGasAdjusted.toFixed()}`);
    console.log(`   Gas Used Quote Token: ${route.estimatedGasUsedQuoteToken.toFixed()}`);
    console.log(`   Gas Used USD: ${route.estimatedGasUsedUSD.toFixed()}`);
    console.log(`   Gas Used: ${route.estimatedGasUsed.toString()}`);
    console.log(`   Gas Price Wei: ${route.gasPriceWei}`);
    console.log('');

    if (!isETH(tokenInContractAddress)) {
        console.log("Approving amount to spend...");
        const V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
        const approveTxUnsigned = await tokenInContract.populateTransaction.approve(V3_SWAP_ROUTER_ADDRESS, amountIn);
        approveTxUnsigned.chainId = chainId;
        approveTxUnsigned.gasLimit = await tokenInContract.estimateGas.approve(V3_SWAP_ROUTER_ADDRESS, amountIn);
        approveTxUnsigned.gasPrice = await provider.getGasPrice();
        approveTxUnsigned.nonce = await provider.getTransactionCount(walletAddress);

        const approveTxSigned = await signer.signTransaction(approveTxUnsigned);
        const submittedTx = await provider.sendTransaction(approveTxSigned);
        const approveReceipt = await submittedTx.wait();
        if (approveReceipt.status === 0)
            throw new Error("Approve transaction failed");
    }

    console.log("Making a swap...");
    const V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
    const value = isETH(tokenInContractAddress) ? amountIn : BigNumber.from(route.methodParameters.value);

    const transaction = {
        data: route.methodParameters.calldata,
        to: V3_SWAP_ROUTER_ADDRESS,
        value: value,
        from: walletAddress,
        gasPrice: route.gasPriceWei,
        // gasLimit: BigNumber.from("800_000")
        gasLimit: BigNumber.from(20_000_000)
    };

    const tx = await signer.sendTransaction(transaction);
    const receipt = await tx.wait();
    if (receipt.status === 0) {
        throw new Error("Swap transaction failed");
    }

    const [newBalanceIn, newBalanceOut] = await Promise.all([
        isETH(tokenInContractAddress) ? provider.getBalance(walletAddress) : tokenInContract.balanceOf(walletAddress),
        isETH(tokenOutContractAddress) ? provider.getBalance(walletAddress) : tokenOutContract.balanceOf(walletAddress)
    ]);

    console.log('');
    console.log('Swap completed successfully! ');
    console.log('');
    console.log('Updated balances:');
    console.log(`   ${tokenIn.symbol}: ${ethers.utils.formatUnits(newBalanceIn, tokenIn.decimals)}`);
    console.log(`   ${tokenOut.symbol}: ${ethers.utils.formatUnits(newBalanceOut, tokenOut.decimals)}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
