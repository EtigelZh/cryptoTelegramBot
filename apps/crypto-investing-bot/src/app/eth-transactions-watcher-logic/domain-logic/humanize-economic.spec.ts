import { humanizeEconomics } from './humanize-economics';
import { DexTransactionEconomics, DexTransactionType } from './handle-swap';
import { WalletEntity, WalletStatus } from '../../wallet/wallet.entity';

describe('humanizeEconomics', () => {
  it('correct output of BUY transaction', () => {
    const economics: DexTransactionEconomics = {
        action: DexTransactionType.BUY,
        amountToken: 5099019996.8680611,
        amountUSD: 4860.78,
        amountWETH: 2.0,
        calculatedAt: new Date('2024-08-08T13:23:27+08:00'),
        ethPerToken: 3.9223223310135035e-10,
        ethPrice: 2430.39,
        tokenAddress: '0xaaeE1A9723aaDB7afA2810263653A34bA2C21C7a',
        tokenPerEth: 2549509998.4340305,
        tokenPerUsd: 1049012.7092499684,
        tokenSymbol: 'Mog',
        usdPerToken: 9.532772970071908e-7,
        calculatedAtBlockNumber: 12345,
      };
    const mockWallet: WalletEntity = {
        alias: 'вкусный сирень',
        createdAt: new Date('2024-08-07T08:46:22+08:00'),
        firstTransactionDate: new Date('2024-06-10T21:32:35+08:00'),
        hash: '0x1f5ce57481c7886aa0b0395f161b5f78dc5c8348',
        isUseMaestroBot: false,
        isWatching: true,
        lastCalculatedAt: new Date('2024-08-07T16:46:24+08:00'),
        lastTransactionDate: new Date('2024-08-07T06:10:23+08:00'),
        searchLastBlockNo: null,
        status: WalletStatus.ACTIVE,
        updatedAt: new Date('2024-08-08T05:07:42+08:00'),
        walletSubscriptionMessages: undefined
    }

    const etherscanTxUrl = 'https://etherscan.io/tx/0x2aa8e698e478069756b04c9d596e64a7ab3477dd8fdcf19ab79a4fbd3d380b05';

    const result = humanizeEconomics(economics, mockWallet, etherscanTxUrl);
    expect(result).toContain('BUY [вкусный сирень](https://etherscan.io/tx/0x2aa8e698e478069756b04c9d596e64a7ab3477dd8fdcf19ab79a4fbd3d380b05)');
    expect(result).toContain('5.1B Mog ← 2 ETH (4.86K$)');
    expect(result).toContain('1 Mog = 0.0000000003922 ETH (0.0000009533$), 1 ETH = 2.43K$');
    expect(result).toContain('TARGET BUY PRICE: `0.0000009342`$');
  });

  it('correct output of BUY transaction', () => {
    const economics: DexTransactionEconomics = {
        action: DexTransactionType.BUY,
        amountToken: 18222.97549601,
        amountUSD: 255.95888569944225,
        amountWETH: 0.10523024280822500,
        calculatedAt: new Date('2024-08-08T14:37:03+08:00'),
        ethPerToken: 0.00000577459168681128,
        ethPrice: 2432.37,
        tokenAddress: '0xF33893DE6eB6aE9A67442E066aE9aBd228f5290c',
        tokenPerEth: 173172.4170704437,
        tokenPerUsd: 71.19493213221826,
        tokenSymbol: 'GRV',
        usdPerToken: 0.014045943581249153,
        calculatedAtBlockNumber: 12345,
    };

    const mockWallet: WalletEntity = {
        alias: 'невинное армадилло',
        createdAt: new Date('2024-08-08T06:29:14+08:00'),
        firstTransactionDate: new Date('2024-08-06T09:30:59+08:00'),
        hash: '0xda5dd51a8869aa961b13a3fcae5ef5e2cd565bef',
        isUseMaestroBot: false,
        isWatching: true,
        lastCalculatedAt: new Date('2024-08-08T14:29:32+08:00'),
        lastTransactionDate: new Date('2024-08-08T14:28:35+08:00'),
        searchLastBlockNo: null,
        status: WalletStatus.ACTIVE,
        updatedAt: new Date('2024-08-08T06:31:00+08:00'),
        walletSubscriptionMessages: undefined,
    };

    const etherscanTxUrl = 'https://etherscan.io/tx/0x2d3e4fc12ad83f0efe39446a2bb28593340bf1f085e51c74366f002c6a373a62';
    const result = humanizeEconomics(economics, mockWallet, etherscanTxUrl);
    
    expect(result).toContain('💸 BUY [невинное армадилло](https://etherscan.io/tx/0x2d3e4fc12ad83f0efe39446a2bb28593340bf1f085e51c74366f002c6a373a62)');
    expect(result).toContain('18.22K GRV ← 0.1052 ETH (255.95$)');
    expect(result).toContain('1 GRV = 0.000005775 ETH (0.01405$), 1 ETH = 2.43K$');
    expect(result).toContain('TARGET BUY PRICE: `0.01377`$');
  });

  it('correct output of BUY transaction without alias', () => {
    const economics: DexTransactionEconomics = {
      action: DexTransactionType.BUY,
      amountToken: 186250.2172437807,
      amountUSD: 2437.16,
      amountWETH: 1.0,
      calculatedAt: new Date('2024-08-08T18:32:45+08:00'),
      ethPerToken: 0.000005369121254184157,
      ethPrice: 2437.16,
      tokenAddress: '0xFEdFDD6afAE3EbB4A2B0c770481683433929F10E',
      tokenPerEth: 186250.2172437808,
      tokenPerUsd: 76.42100528639105,
      tokenSymbol: 'ANIMAL',
      usdPerToken: 0.013085407555847459,
      calculatedAtBlockNumber: 12345,
  };

    const mockWallet: WalletEntity = {
      alias: '',
      createdAt: new Date('2024-08-08T10:14:09+08:00'),
      firstTransactionDate: new Date('2024-06-07T21:57:59+08:00'),
      hash: '0x82984a263c8598738e7f64f2d94399f2c7e2f14c',
      isUseMaestroBot: false,
      isWatching: true,
      lastCalculatedAt: new Date('2024-08-08T18:14:11+08:00'),
      lastTransactionDate: new Date('2024-07-25T00:33:47+08:00'),
      searchLastBlockNo: null,
      status: WalletStatus.ACTIVE,
      updatedAt: new Date('2024-08-08T10:16:41+08:00'),
      walletSubscriptionMessages: undefined,
  };

    const etherscanTxUrl = 'https://etherscan.io/tx/0xa811bc98d879d92ab4632c49d776de697a1e903c22d19ffd06fbbbb2e38d67a1';
    const result = humanizeEconomics(economics, mockWallet, etherscanTxUrl);
    
    expect(result).toContain('💸 BUY [0x82984a263c8598738e7f64f2d94399f2c7e2f14c](https://etherscan.io/tx/0xa811bc98d879d92ab4632c49d776de697a1e903c22d19ffd06fbbbb2e38d67a1)');
    expect(result).toContain('186.25K ANIMAL ← 1 ETH (2.44K$)');
    expect(result).toContain('1 ANIMAL = 0.000005369 ETH (0.01309$), 1 ETH = 2.44K$');
    expect(result).toContain('TARGET BUY PRICE: `0.01282`$');
  });

  it('correct output of SELL transaction', () => {
    const economics: DexTransactionEconomics = {
      action: DexTransactionType.SELL,
      amountToken: 4500.0,
      amountUSD: 4442.534914956169,
      amountWETH: 1.6687394739544097,
      calculatedAt: new Date('2024-08-09T17:48:38+08:00'),
      ethPerToken: 0.000370830994212091,
      ethPrice: 2662.21,
      tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      tokenPerEth: 2696.64622323361,
      tokenPerUsd: 1.012935201668392,
      tokenSymbol: 'USDC',
      usdPerToken: 0.9872299811013708,
      calculatedAtBlockNumber: 12345,
  };

    const mockWallet: WalletEntity = {
      alias: 'вкусная яблоня',
      createdAt: new Date('2024-08-09T09:38:55+08:00'),
      firstTransactionDate: new Date('2024-07-11T08:17:11+08:00'),
      hash: '0x42e48d5e0b43c0ddfed449e789df354b05d2f49d',
      isUseMaestroBot: false,
      isWatching: true,
      lastCalculatedAt: new Date('2024-08-09T17:39:06+08:00'),
      lastTransactionDate: new Date('2024-08-09T16:53:23+08:00'),
      searchLastBlockNo: null,
      status: WalletStatus.ACTIVE,
      updatedAt: new Date('2024-08-09T09:40:05+08:00'),
      walletSubscriptionMessages: undefined,
  };

    const etherscanTxUrl = 'https://etherscan.io/tx/0xed808a5351d19ab651d07106d31c1c05a537da67b94bcf5059cf022501a41c05';
    const result = humanizeEconomics(economics, mockWallet, etherscanTxUrl);
    
    expect(result).toContain('💰 SELL [вкусная яблоня](https://etherscan.io/tx/0xed808a5351d19ab651d07106d31c1c05a537da67b94bcf5059cf022501a41c05)');
    expect(result).toContain('4.5K USDC → 1.66 ETH (4.44K$)');
    expect(result).toContain('1 USDC = 0.0003708 ETH (0.9872$)');
  });
});