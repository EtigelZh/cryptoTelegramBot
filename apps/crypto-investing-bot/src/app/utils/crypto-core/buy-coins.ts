import { ethers } from "ethers";
import QuoterABI from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { Pool } from '@uniswap/v3-sdk/';
import { TradeType, Token, CurrencyAmount, Percent } from '@uniswap/sdk-core';
import { AlphaRouter, SwapType } from '@uniswap/smart-order-router';
import IUniswapV3Pool from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import IUniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json';
import { BigNumber } from '@ethersproject/bignumber';
import ERC20_abi from "./ERC20-abi.json";
import dotenv from 'dotenv';
import { resolve } from "path";

const WETH_ADDRESS_NETWORK_MAP = {
    [1]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    [42161]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
};

const defaultEnvPath = resolve(__dirname, '.env');
dotenv.config({ path: defaultEnvPath });

type SwapTokensArgs = {
    chainId: number;
    walletAddress: string;
    tokenInAddress: string;
    tokenOutAddress: string;
    amountInStr: string;
    alchemyApiToken: string;
    privateKey: string;
};

const UNISWAP_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const UNISWAP_QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
const V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';

export async function swapTokens({
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

    const isETH = (address) => address.toLowerCase() === ethers.constants.AddressZero.toLowerCase();

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
        console.log(`Wallet ${walletAddress} balances:`);
        console.log(`   Input: ${tokenIn.symbol} (${tokenIn.name}): ${ethers.utils.formatUnits(balanceTokenIn, tokenIn.decimals)}`);
        console.log(`   Output: ${tokenOut.symbol} (${tokenOut.name}): ${ethers.utils.formatUnits(balanceTokenOut, tokenOut.decimals)}`);    
    } catch (e) {
        console.log(e);
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

    console.log(`You'll get approximately ${ethers.utils.formatUnits(quotedAmountOut, tokenOut.decimals)} ${tokenOut.symbol} for ${amountInStr} ${tokenIn.symbol}`);

    const inAmount = CurrencyAmount.fromRawAmount(tokenIn, amountIn.toString());
    const router = new AlphaRouter({ chainId: tokenIn.chainId, provider: provider });
    const route = await router.route(
        inAmount, tokenOut, TradeType.EXACT_INPUT,
        {
            type: SwapType.SWAP_ROUTER_02,
            recipient: walletAddress,
            slippageTolerance: new Percent(5, 100),
            deadline: Math.floor(Date.now() / 1000 + 1800)
        },
        { maxSwapsPerPath: 1 }
    );

    if (!route || !route.methodParameters) throw "No route loaded";

    if (!isETH(tokenInAddress)) {
        const approveTxUnsigned = await tokenInContract.populateTransaction.approve(V3_SWAP_ROUTER_ADDRESS, amountIn);
        approveTxUnsigned.chainId = chainId;
        approveTxUnsigned.gasLimit = await tokenInContract.estimateGas.approve(V3_SWAP_ROUTER_ADDRESS, amountIn);
        approveTxUnsigned.gasPrice = await provider.getGasPrice();
        approveTxUnsigned.nonce = await provider.getTransactionCount(walletAddress);

        const approveTxSigned = await signer.signTransaction(approveTxUnsigned);
        const submittedTx = await provider.sendTransaction(approveTxSigned);
        const approveReceipt = await submittedTx.wait();
        if (approveReceipt.status === 0) throw new Error("Approve transaction failed");
    }

    const value = isETH(tokenInAddress) ? amountIn : BigNumber.from(route.methodParameters.value);
    const transaction = {
        data: route.methodParameters.calldata,
        to: V3_SWAP_ROUTER_ADDRESS,
        value: value,
        from: walletAddress,
        gasPrice: route.gasPriceWei,
        gasLimit: BigNumber.from(50_000_000)
    };

    const tx = await signer.sendTransaction(transaction);
    const receipt = await tx.wait();
    if (receipt.status === 0) throw new Error("Swap transaction failed");

    const [newBalanceIn, newBalanceOut] = await Promise.all([
        isETH(tokenInAddress) ? provider.getBalance(walletAddress) : tokenInContract.balanceOf(walletAddress),
        isETH(tokenOutAddress) ? provider.getBalance(walletAddress) : tokenOutContract.balanceOf(walletAddress)
    ]);

    console.log('Swap completed successfully!');
    console.log(`Updated balances: ${tokenIn.symbol}: ${ethers.utils.formatUnits(newBalanceIn, tokenIn.decimals)}, ${tokenOut.symbol}: ${ethers.utils.formatUnits(newBalanceOut, tokenOut.decimals)}`);
}
