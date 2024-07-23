import { Logger } from '@nestjs/common';
import { ethers } from 'ethers';
const POOL_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

export async function getTokenAddresses(
  poolAddress: string,
  provider: ethers.providers.AlchemyProvider,
  poolsCache: Map<string, [string, string]>,
): Promise<[string, string]> {
  if (poolsCache.has(poolAddress)) {
    return poolsCache.get(poolAddress);
  }
  const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

  try {
    const [token0, token1] = await Promise.all([
      poolContract.token0(),
      poolContract.token1(),
    ]);

    poolsCache.set(poolAddress, [token0, token1]);
    return [token0, token1];
  } catch (error) {
    Logger.error(
      `Failed to fetch token addresses for pool ${poolAddress}: ${error.message}`
    );
    return ['0x0', '0x0'];
  }
}
