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


    let numberQuotedAmountOut, priceEthToken, message;

    try {
        const factoryContractV3 = new ethers.Contract(UNISWAP_FACTORY_ADDRESS_V3, IUniswapV3Factory.abi, provider);

        const fees = [100, 500, 3000, 10000];
        let poolAddressV3;
        let fee;
        for (const f of fees) {
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

        try {

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

export async function getTokenPriceV2({
  chainId,
  walletAddress,
  tokenInAddress,
  tokenOutAddress,
  amountInStr,
  alchemyApiToken,
  privateKey,
}) {
  // Проверка chainId
  if (chainId !== 1) {
    throw new Error('В настоящее время поддерживается только Ethereum mainnet (chainId 1).');
  }

  // Инициализация провайдера
  const provider = new ethers.providers.AlchemyProvider(chainId, alchemyApiToken);

  // Проверка наличия и корректности адресов токенов
  if (!tokenInAddress || !ethers.utils.isAddress(tokenInAddress)) {
    throw new Error(`Некорректный tokenInAddress: ${tokenInAddress}`);
  }

  if (!tokenOutAddress || !ethers.utils.isAddress(tokenOutAddress)) {
    throw new Error(`Некорректный tokenOutAddress: ${tokenOutAddress}`);
  }

  // Приведение адресов к чексумированному формату
  const tokenInAddressChecksummed = ethers.utils.getAddress(tokenInAddress);
  const tokenOutAddressChecksummed = ethers.utils.getAddress(tokenOutAddress);

  // Минимальный ABI ERC20 для получения decimals и symbol
  const ERC20_ABI = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
  ];

  // Функция для получения данных о токене
  async function getTokenData(tokenAddress) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    let decimals, symbol;

    try {
      decimals = await tokenContract.decimals();
    } catch (error) {
      throw new Error(`Ошибка при получении decimals для токена по адресу ${tokenAddress}: ${error.message}`);
    }

    try {
      symbol = await tokenContract.symbol();
    } catch (error) {
      symbol = 'UNKNOWN';
      console.log(`Ошибка при получении symbol для токена по адресу ${tokenAddress}`);
    }

    return { decimals, symbol };
  }

  // Получение данных о токенах
  const [tokenInData, tokenOutData] = await Promise.all([
    getTokenData(tokenInAddressChecksummed),
    getTokenData(tokenOutAddressChecksummed),
  ]);

  // Конвертация входной суммы в наименьшие единицы (wei)
  const amountIn = ethers.utils.parseUnits(amountInStr, tokenInData.decimals);

  // Попытка получить котировку через Uniswap V3
  let amountOut;
  let selectedFee;
  let price;

  // Адрес контракта Quoter Uniswap V3 на Ethereum mainnet
  const QUOTER_ADDRESS_V3 = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

  // ABI для функции quoteExactInputSingle
  const quoterAbiV3 = [
    'function quoteExactInputSingle(' +
      'address tokenIn,' +
      'address tokenOut,' +
      'uint24 fee,' +
      'uint256 amountIn,' +
      'uint160 sqrtPriceLimitX96' +
    ') external returns (uint256 amountOut)',
  ];

  // Инициализация контракта Quoter для V3
  const quoterContractV3 = new ethers.Contract(QUOTER_ADDRESS_V3, quoterAbiV3, provider);

  // Возможные уровни комиссии для Uniswap V3
  const feeOptions = [100, 500, 1000, 3000, 10000]

  let v3Success = false;

  for (const fee of feeOptions) {
    try {
      amountOut = await quoterContractV3.callStatic.quoteExactInputSingle(
        tokenInAddressChecksummed,
        tokenOutAddressChecksummed,
        fee,
        amountIn,
        0 // Без ограничения цены
      );
      selectedFee = fee;
      v3Success = true;
      break;
    } catch (error) {
      console.log(`Не удалось получить котировку через Uniswap V3 для уровня комиссии ${fee}`);
    }
  }

  // Если не удалось получить котировку через Uniswap V3, пробуем через Uniswap V2
  if (!v3Success) {
    console.log('Переход к Uniswap V2 для получения котировки.');

    // Адреса фабрики и роутера Uniswap V2
    const UNISWAP_V2_FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
    const UNISWAP_V2_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

    // ABI для функции getAmountsOut
    const routerAbiV2 = [
      'function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint256[] memory amounts)',
    ];

    // Инициализация контракта роутера Uniswap V2
    const routerContractV2 = new ethers.Contract(UNISWAP_V2_ROUTER_ADDRESS, routerAbiV2, provider);

    // Путь обмена токенов
    const path = [tokenInAddressChecksummed, tokenOutAddressChecksummed];
    const pathP = [tokenOutAddressChecksummed, tokenInAddressChecksummed];

    try {
      const amountsOut = await routerContractV2.getAmountsOut(amountIn, path);
      amountOut = amountsOut[amountsOut.length - 1];

      // Получение текущего номера блока
      const blockNumber = await provider.getBlockNumber();

      // Форматирование выходной суммы для удобочитаемого вида
      const amountOutFormatted = ethers.utils.formatUnits(amountOut, tokenOutData.decimals);

      // Расчет цены (amountOut / amountIn)
      const amountInDecimal = parseFloat(amountInStr);
      const amountOutDecimal = parseFloat(amountOutFormatted);
      price = amountOutDecimal / amountInDecimal;

      // Инициализация переменной для количества токенов за 1 Ether
      let tokensPerEther = null;

      // Проверяем, является ли tokenInAddress WETH
      const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        try {
          const oneEtherIn = ethers.utils.parseEther('1'); // 1 Ether = 1e18 wei
          const amountsOutEther = await routerContractV2.getAmountsOut(oneEtherIn, pathP);
          const tokensOutEther = amountsOutEther[amountsOutEther.length - 1];
          tokensPerEther = ethers.utils.formatUnits(tokensOutEther, tokenInData.decimals);
        } catch (error) {
          console.log(`Не удалось получить количество токенов за 1 Ether через Uniswap V2`);
        }
      const message = `You'll get approximately ${tokensPerEther} ${tokenOutData.symbol} for ${amountInStr} ${tokenInData.symbol} on Uniswap V2`;
      // Возврат результата
      return {
        tokenInSymbol: tokenInData.symbol,
        tokenOutSymbol: tokenOutData.symbol,
        amountIn: amountInStr,
        amountOut: amountOutFormatted,
        priceEthToken: price,
        platform: 'Uniswap V2',
        currentBlockNumber: blockNumber,
        fee: 0.003, // Комиссия Uniswap V2 составляет 0.3%
        numberQuotedAmountOut: tokensPerEther, // Добавленное поле
        message
      };
    } catch (error) {
      throw new Error(`Не удалось получить котировку через Uniswap V2: ${error.message}`);
    }
  } else {
    // Если удалось получить котировку через Uniswap V3
    // Получение текущего номера блока
    const blockNumber = await provider.getBlockNumber();

    // Форматирование выходной суммы для удобочитаемого вида
    const amountOutFormatted = ethers.utils.formatUnits(amountOut, tokenOutData.decimals);

    // Расчет цены (amountOut / amountIn)
    const amountInDecimal = parseFloat(amountInStr);
    const amountOutDecimal = parseFloat(amountOutFormatted);
    price = amountOutDecimal / amountInDecimal;

    // Инициализация переменной для количества токенов за 1 Ether
    const tokensPerEther = 1 / Number(amountOutFormatted);
    const message = `You'll get approximately ${tokensPerEther} ${tokenOutData.symbol} for ${amountInStr} ${tokenInData.symbol} on Uniswap V3`;
    // Возврат результата
    return {
      tokenInSymbol: tokenInData.symbol,
      tokenOutSymbol: tokenOutData.symbol,
      amountIn: amountInStr,
      amountOut: amountOutFormatted,
      priceEthToken: price,
      feeTier: selectedFee,
      platform: 'Uniswap V3',
      currentBlockNumber: blockNumber,
      fee: selectedFee / 1e6, // Преобразование комиссии в десятичный формат (например, 3000 => 0.003)
      numberQuotedAmountOut: tokensPerEther, // Добавленное поле
      message
    };
  }
}


type AlchemyTokenPriceResponse = {
  data: AlchemyTokenPriceInfo[];
}

type AlchemyTokenPriceInfo = {
  network: string;
  address: string;
  prices: AlchemyTokenPriceEntry[];
}

type AlchemyTokenPriceEntry = {
  value: string;
  currency: string;
  lastUpdatedAt: string;
}

export type TokenPrice = {
  tokenAddress: string;
  // цена токена в USD
  tokenPriceUSD: number;
  // цена ETH в USD
  ethPriceUSD: number;
  // сколько стоит 1 токен в ETH
  priceInEthPerToken: number;
  // сколько получим токенов за 1 ETH
  tokenAmountForOneETH: number;

  lastUpdatedAt: Date;
  calculatedAt: Date;
}

export async function getTokenPricesFromAlchemyApi(tokenAddresses: string[], apiKey: string): Promise<TokenPrice[]> {
  const url = `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-address`;
  const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  tokenAddresses.unshift(WETH_ADDRESS);

  // разбиваем по 25 адресов на запрос
  const chunks: string[][] = [];
  const chunkSize = 25;

  for (let i = 0; i < tokenAddresses.length; i += chunkSize) {
    chunks.push(tokenAddresses.slice(i, i + chunkSize));
  }

  const requestOptions = chunks.map((chunk) => ({
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      addresses: chunk.map(address => ({ network: 'eth-mainnet', address })),
    })
  }));

  const responsesResults = await Promise.allSettled(requestOptions.map((options) => fetch(url, options)));

  const responses = await Promise.all(
    responsesResults.filter(responseResult => responseResult.status === 'fulfilled' && responseResult.value)
    .map((responseResult: PromiseFulfilledResult<Response>) => responseResult.value.json() as Promise<AlchemyTokenPriceResponse>)
  );

  const rates = responses.flatMap(response => response.data);

  const ethPriceEntry = rates.find(rate => rate.address === WETH_ADDRESS);

  const ethPrice = ethPriceEntry.prices[0].value;


  return rates.map(rate => {
    const tokenPriceUSD = parseFloat(rate.prices[0].value);
    const priceInEthPerToken = tokenPriceUSD / parseFloat(ethPrice);
    const tokenAmountForOneETH = 1 / priceInEthPerToken;

    return {
      tokenAddress: rate.address,
      tokenPriceUSD,
      ethPriceUSD: parseFloat(ethPrice),
      tokenAmountForOneETH,
      priceInEthPerToken,
      lastUpdatedAt: new Date(rate.prices[0].lastUpdatedAt),
      calculatedAt: new Date(),
    };
  });

}
