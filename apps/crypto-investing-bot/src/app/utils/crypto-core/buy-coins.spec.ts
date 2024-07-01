// buy-coins.test.ts
import { ethers } from 'ethers';
import { AlphaRouter, SwapType } from '@uniswap/smart-order-router';
import { swapTokens } from './buy-coins';
import dotenv from 'dotenv';

dotenv.config();
jest.setTimeout(60_000);
describe.skip('swapTokens', () => {
    const swapTokensArgs = {
        chainId: 42161,
        walletAddress: '0xCd4f2BACdE4E161aC0C204524fc0A58243fE447F',
        tokenInAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenOutAddress: '0x0000000000000000000000000000000000000000',
        amountInStr: '1.0',
        alchemyApiToken: process.env.ALCHEMY_API_TOKEN!,
        privateKey: 'your-private-key' // This won't be used, as we will mock the transaction sending part.
    };

    let provider: ethers.providers.AlchemyProvider;
    let wallet: ethers.Wallet;

    beforeAll(() => {
        provider = new ethers.providers.AlchemyProvider(swapTokensArgs.chainId, swapTokensArgs.alchemyApiToken);
        wallet = ethers.Wallet.createRandom().connect(provider);
    });

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('should swap tokens successfully', async () => {
        // Arrange
        const sendTransactionSpy = jest.spyOn(wallet, 'sendTransaction').mockResolvedValue({
            hash: '0xMockTransactionHash',
            wait: jest.fn().mockResolvedValue({ status: 1 })
        } as any);

        const getBalanceSpy = jest.spyOn(provider, 'getBalance').mockResolvedValue(ethers.BigNumber.from('1000000000000000000'));

        await swapTokens({
            ...swapTokensArgs,
            privateKey: wallet.privateKey
        });

        // Assert
        expect(sendTransactionSpy).toHaveBeenCalled();
        sendTransactionSpy.mockRestore();
        getBalanceSpy.mockRestore();
    });

    it('should throw an error if no route is found', async () => {
        // Arrange
        const routeSpy = jest.spyOn(AlphaRouter.prototype, 'route').mockResolvedValue(null);

        // Act & Assert
        await expect(swapTokens({
            ...swapTokensArgs,
            privateKey: wallet.privateKey
        })).rejects.toThrow('No route loaded');

        routeSpy.mockRestore();
    });
});
