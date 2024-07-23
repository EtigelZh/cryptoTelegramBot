import { ethers } from 'ethers';
import { Fungible } from './models';
import { Logger } from '@nestjs/common';

export const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
  'event SwapERC20(uint256 indexed nonce, address indexed signerWallet, address signerToken, uint256 signerAmount, uint256 protocolFee, address indexed senderWallet, address senderToken, uint256 senderAmount)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];

export async function getTokenMetaData(
  contractAddress: string,
  provider: ethers.providers.AlchemyProvider,
  tokensMap: Map<string, Fungible>
): Promise<Fungible> {
  if (tokensMap.has(contractAddress)) {
    return tokensMap.get(contractAddress);
  }

  const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);

  try {
    const [name, symbol] = await Promise.all([
      contract.name(),
      contract.symbol(),
    ]);

    const tokenData: Fungible = { name, symbol, contractAddress };
    tokensMap.set(contractAddress, tokenData);

    return tokenData;
  } catch (error) {
    Logger.error(
      `Failed to fetch token metadata for contract ${contractAddress}: ${error.message}`
    );
    const tokenData: Fungible = {
      name: 'Unknown',
      symbol: 'UNK',
      contractAddress,
    };
    tokensMap.set(contractAddress, tokenData);
    return tokenData;
  }
}
