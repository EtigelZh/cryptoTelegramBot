// buy-coins.test.ts
import { swapTokens } from './buy-coins';
import { ethers } from 'ethers';
import { AlphaRouter } from '@uniswap/smart-order-router';
import { Token } from '@uniswap/sdk-core';

// Mock dependencies
jest.mock('ethers');
jest.mock('@uniswap/smart-order-router');
jest.mock('@uniswap/sdk-core');

const mockProvider = {
    getBalance: jest.fn(),
    getGasPrice: jest.fn(),
    getTransactionCount: jest.fn(),
    sendTransaction: jest.fn()
};
const mockSigner = {
    signTransaction: jest.fn(),
    sendTransaction: jest.fn()
};
const mockContract = {
    decimals: jest.fn(),
    symbol: jest.fn(),
    name: jest.fn(),
    balanceOf: jest.fn(),
    populateTransaction: {
        approve: jest.fn()
    },
    estimateGas: {
        approve: jest.fn()
    }
};
const mockRouter = {
    route: jest.fn()
};

beforeEach(() => {
    jest.resetAllMocks();
    
    (ethers.providers.AlchemyProvider as any).mockImplementation(() => mockProvider);
    (ethers.Wallet as any).mockImplementation(() => mockSigner);
    (ethers.Contract as any).mockImplementation(() => mockContract);
    (AlphaRouter as any).mockImplementation(() => mockRouter);

    mockSigner.signTransaction.mockResolvedValue('signedTransaction');
    mockProvider.sendTransaction.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ status: 1 })
    });
});

describe('swapTokens', () => {
    it('should swap tokens successfully', async () => {
        // Arrange
        const swapTokensArgs = {
            chainId: 1,
            walletAddress: '0xWalletAddress',
            tokenInAddress: '0xTokenInAddress',
            tokenOutAddress: '0xTokenOutAddress',
            amountInStr: '1.0',
            alchemyApiToken: 'alchemyApiToken',
            privateKey: 'privateKey'
        };

        // Mock responses for contract calls
        mockContract.decimals.mockResolvedValue(18);
        mockContract.symbol.mockResolvedValue('TOKEN');
        mockContract.name.mockResolvedValue('Test Token');
        mockContract.balanceOf.mockResolvedValue(ethers.BigNumber.from('1000000000000000000'));
        mockProvider.getBalance.mockResolvedValue(ethers.BigNumber.from('1000000000000000000'));

        // Mock Uniswap router responses
        const mockToken = new Token(1, '0xTokenInAddress', 18, 'TOKEN', 'Test Token');
        mockRouter.route.mockResolvedValue({
            methodParameters: {
                calldata: '0xCalldata',
                value: '1000000000000000000'
            },
            gasPriceWei: ethers.BigNumber.from('1000000000')
        });

        // Mock static call to quoteExactInputSingle
        (ethers.Contract.prototype as any).callStatic = {
            quoteExactInputSingle: jest.fn().mockResolvedValue(ethers.BigNumber.from('1000000000000000000'))
        };

        // Act
        await swapTokens(swapTokensArgs);

        // Assert
        expect(mockProvider.getBalance).toHaveBeenCalledWith(swapTokensArgs.walletAddress);
        expect(mockSigner.sendTransaction).toHaveBeenCalled();
        expect(mockRouter.route).toHaveBeenCalled();
    });

    it('should throw an error if no route is found', async () => {
        // Arrange
        const swapTokensArgs = {
            chainId: 1,
            walletAddress: '0xWalletAddress',
            tokenInAddress: '0xTokenInAddress',
            tokenOutAddress: '0xTokenOutAddress',
            amountInStr: '1.0',
            alchemyApiToken: 'alchemyApiToken',
            privateKey: 'privateKey'
        };

        mockRouter.route.mockResolvedValue(null);

        // Act & Assert
        await expect(swapTokens(swapTokensArgs)).rejects.toThrow('No route loaded');
    });
});
