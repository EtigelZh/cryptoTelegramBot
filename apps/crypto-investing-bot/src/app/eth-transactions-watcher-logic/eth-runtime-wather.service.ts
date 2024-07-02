import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { ethers } from "ethers";
import { AppConfig } from "../app.config";
import { Subscription, of, timer, Subject } from "rxjs";
import { filter, tap, catchError, retryWhen, delayWhen, bufferTime } from "rxjs/operators";
import { WalletService } from "../wallet/wallet.service";
import { WalletEntity } from "../wallet/wallet.entity";
import { TelegramJobApiService } from "../telegraf/telegram-job-api.service";
import { Alchemy, Network } from "alchemy-sdk";
import { Cron, CronExpression } from "@nestjs/schedule";
import WebSocket from 'ws';

type Log = { topics: Array<string>, data: string, transactionHash: string, blockNumber: number, removed: boolean, logIndex: number, address: string };
type Fungible = { name: string, symbol: string, contractAddress: string };

@Injectable()
export class EthRuntimeWatcherService implements OnModuleInit, OnModuleDestroy {
    private alchemy: Alchemy;
    private readonly _targetWalletAddresses: WalletEntity[] = [];
    private readonly _watchingWalletsHashesMap = new Map<string, Subscription[]>();
    private readonly _subscriptions: Subscription[] = [];
    private readonly _tokensMap = new Map<string, Fungible>();
    private readonly _poolsCache = new Map<string, [string, string]>();
    private readonly _blockCache: Array<{ blockNumber: number, transactions: ethers.providers.TransactionResponse[] }> = [];
    private blockSubject = new Subject<number>();
    private transferSubject = new Subject<Log>();
    private swapSubject = new Subject<Log>();
    private reconnectSubject = new Subject<void>();
    private ethUsdPrice = 0;

    private readonly ERC20_ABI = [
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
        "function name() view returns (string)",
        "function symbol() view returns (string)"
    ];

    private readonly POOL_ABI = [
        "function token0() external view returns (address)",
        "function token1() external view returns (address)"
    ];

    constructor(
        private readonly _config: AppConfig, 
        private readonly _walletService: WalletService,
        private readonly _telegramJobApiService: TelegramJobApiService,
    ) {}

    async onModuleInit() {
        const settings = {
            apiKey: this._config.alchemyApiKey,
            network: this._config.network === 'mainnet' ? Network.ETH_MAINNET : Network.ARB_MAINNET,
        };
        this.alchemy = new Alchemy(settings);
        this._setupWebSocket();
        this._connectToBinanceWebSocket();
    }

    async onModuleDestroy() {
        this.alchemy.ws.removeAllListeners();
        this._subscriptions.forEach(sub => sub.unsubscribe());
    }

    addTargetWalletAddress(walletEntity: WalletEntity) {
        if (!this._watchingWalletsHashesMap.has(walletEntity.hash)) {
            this._watchingWalletsHashesMap.set(walletEntity.hash, []);
            this._targetWalletAddresses.push(walletEntity);
        }
    }

    removeTargetWalletAddress(walletEntity: WalletEntity) {
        if (this._watchingWalletsHashesMap.has(walletEntity.hash)) {
            const subscriptions = this._watchingWalletsHashesMap.get(walletEntity.hash);
            subscriptions.forEach(sub => sub.unsubscribe());
            this._watchingWalletsHashesMap.delete(walletEntity.hash);
            const index = this._targetWalletAddresses.findIndex(wallet => wallet.hash === walletEntity.hash);
            if (index !== -1) {
                this._targetWalletAddresses.splice(index, 1);
            }
        }
    }

    private async _getTokenMetaData(contractAddress: string): Promise<Fungible> {
        if (this._tokensMap.has(contractAddress)) {
            return this._tokensMap.get(contractAddress);
        }

        const provider = new ethers.providers.AlchemyProvider(this._config.network, this._config.alchemyApiKey);
        const contract = new ethers.Contract(contractAddress, this.ERC20_ABI, provider);

        try {
            const [name, symbol] = await Promise.all([
                contract.name(),
                contract.symbol()
            ]);

            const tokenData: Fungible = { name, symbol, contractAddress };
            this._tokensMap.set(contractAddress, tokenData);

            return tokenData;
        } catch (error) {
            Logger.error(`Failed to fetch token metadata for contract ${contractAddress}: ${error.message}`);
            const tokenData: Fungible = { name: 'Unknown', symbol: 'UNK', contractAddress };
            this._tokensMap.set(contractAddress, tokenData);
            return tokenData;
        }
    }

    private async _getTokenAddresses(poolAddress: string): Promise<[string, string]> {
        if (this._poolsCache.has(poolAddress)) {
            return this._poolsCache.get(poolAddress);
        }

        const provider = new ethers.providers.AlchemyProvider(this._config.network, this._config.alchemyApiKey);
        const poolContract = new ethers.Contract(poolAddress, this.POOL_ABI, provider);

        try {
            const [token0, token1] = await Promise.all([
                poolContract.token0(),
                poolContract.token1()
            ]);

            this._poolsCache.set(poolAddress, [token0, token1]);
            return [token0, token1];
        } catch (error) {
            Logger.error(`Failed to fetch token addresses for pool ${poolAddress}: ${error.message}`);
            return ['0x0', '0x0'];
        }
    }

    private _setupWebSocket() {
        const transferFilter = {
            topics: [ethers.utils.id("Transfer(address,address,uint256)")],
        };

        const swapFilter = {
            topics: [ethers.utils.id("Swap(address,uint256,uint256,uint256,uint256,address)")],
        };

        this.alchemy.ws.on(transferFilter, (log) => this.transferSubject.next(log));
        this.alchemy.ws.on(swapFilter, (log) => this.swapSubject.next(log));

        const transferEvents$ = this.transferSubject
            .pipe(
                bufferTime(1000),
                filter((logs) => Array.isArray(logs) && logs.length > 0),
                tap((logs) => this._processTransferLogs(logs)),
                catchError(error => {
                    Logger.error(`Error processing transfer events: ${error.message}`);
                    return of();
                }),
                retryWhen(errors => errors.pipe(
                    tap(error => Logger.log(`WebSocket error: ${error.message}. Reconnecting...`)),
                    delayWhen(() => timer(3000))
                ))
            )
            .subscribe();

        this._subscriptions.push(transferEvents$);

        const swapEvents$ = this.swapSubject
            .pipe(
                bufferTime(1000),
                filter((logs) => Array.isArray(logs) && logs.length > 0),
                tap((logs) => this._processSwapLogs(logs)),
                catchError(error => {
                    Logger.error(`Error processing swap events: ${error.message}`);
                    return of();
                }),
                retryWhen(errors => errors.pipe(
                    tap(error => Logger.log(`WebSocket error: ${error.message}. Reconnecting...`)),
                    delayWhen(() => timer(3000))
                ))
            )
            .subscribe();

        this._subscriptions.push(swapEvents$);

        this.alchemy.ws.on("block", (blockNumber) => {
            this.blockSubject.next(blockNumber);
            this._handleBlock(blockNumber);
        });

        this.alchemy.ws.on("open", () => {
            this.reconnectSubject.next();
            Logger.log('WebSocket connection established');
        });

        this.alchemy.ws.on("error", (error) => {
            Logger.log(`WebSocket Error: ${error.message}`);
        });

        this.alchemy.ws.on("close", (code) => {
            Logger.log(`WebSocket Closed: ${code}`);
            Logger.log('Attempting to reconnect in 3 seconds...');
            setTimeout(() => {
                this._reconnectWebSocket();
            }, 3000);
        });

        Logger.log('WebSocket connection setup complete, listening for ERC-20 transfers and DEX logs involving target wallets...');
    }

    private _processTransferLogs(logs: Log[]) {
        const logsByBlock = logs.reduce((acc, log) => {
            const blockNumber = log.blockNumber;
            if (!acc[blockNumber]) {
                acc[blockNumber] = { logs: [], emptyDataLogsCount: 0 };
            }
            
            if (log.data === "0x" || !log.data) {
                acc[blockNumber].emptyDataLogsCount++;
            } else {
                acc[blockNumber].logs.push(log);
            }
            return acc;
        }, {});
    
        for (const blockNumber in logsByBlock) {
            const blockLogs = logsByBlock[blockNumber].logs;
            const emptyDataLogsCount = logsByBlock[blockNumber].emptyDataLogsCount;
    
            Logger.log(`Block ${blockNumber} - Received ${blockLogs.length} transfer events; ${emptyDataLogsCount} logs with empty data; ${this._tokensMap.size} tokens cached.`);
    
            blockLogs.forEach(async log => {
                try {
                    const parsedLog = new ethers.utils.Interface(this.ERC20_ABI).parseLog(log);
                    const { from, to, value } = parsedLog.args;
                    if (!this._isWatchingTransaction(from, to)) {
                        return;
                    }
                    const walletEntity = this._getWalletEntity(from, to);
                    
                    const tokenData = await this._getTokenMetaData(log.address);
                    const valueFormatted = ethers.utils.formatUnits(value, 18);
    
                    const message = [
                        `Value: \`${walletEntity?.hash || from || to}\` (${walletEntity?.alias || 'Unknown'}) ${valueFormatted} ${tokenData.symbol} Transaction: [${log.transactionHash}](${this._config.getEtherscanTxUrl(log.transactionHash)})`,
                    ].join('\n');
                    
                    Logger.log(`Transfer event: ${message}`);
                    if (walletEntity && walletEntity.walletSubscriptionMessages) {
                        const entries = Object.entries(walletEntity.walletSubscriptionMessages);
                        Promise.allSettled(entries.map(([chatId, messageId]) => this._telegramJobApiService.sendMessage(+chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true })));
                    }
                } catch (error) {
                    Logger.error(`Error processing transfer event: ${error.message}`);
                    Logger.verbose(log);
                }
            });
        }
    }

    private async _processSwapLogs(logs: Log[]) {
        for (const log of logs) {
            try {
                const parsedLog = new ethers.utils.Interface(this.ERC20_ABI).parseLog(log);
                const { sender, amount0In, amount1In, amount0Out, amount1Out, to } = parsedLog.args;
                
                let walletEntity = this._getWalletEntity(sender, to);
                if (!walletEntity) {
                    const foundTx = await this._getTransactionFromCache(log.transactionHash, log.blockNumber);
                    walletEntity = this._getWalletEntity(foundTx?.from, foundTx?.to);  
                }
                if (!walletEntity) {
                    return;
                }
                const [token0Address, token1Address] = await this._getTokenAddresses(log.address);
    
                const token0 = await this._getTokenMetaData(token0Address);
                const token1 = await this._getTokenMetaData(token1Address);
    
                const amount0InFormatted = ethers.utils.formatUnits(amount0In, 18);
                const amount1InFormatted = ethers.utils.formatUnits(amount1In, 18);
                const amount0OutFormatted = ethers.utils.formatUnits(amount0Out, 18);
                const amount1OutFormatted = ethers.utils.formatUnits(amount1Out, 18);
    
                let action, amountToken, amountWETH, tokenSymbol, tokenPerEth;
    
                if (token0.symbol === 'WETH') {
                    if (parseFloat(amount0InFormatted) > 0) {
                        action = 'BUY';
                        amountToken = amount1OutFormatted;
                        amountWETH = amount0InFormatted;
                        tokenSymbol = token1.symbol;
                        tokenPerEth = (parseFloat(amount1OutFormatted) / parseFloat(amount0InFormatted)).toFixed(6);
                    } else {
                        action = 'SELL';
                        amountToken = amount1InFormatted;
                        amountWETH = amount0OutFormatted;
                        tokenSymbol = token1.symbol;
                        tokenPerEth = (parseFloat(amount1InFormatted) / parseFloat(amount0OutFormatted)).toFixed(6);
                    }
                } else {
                    if (parseFloat(amount1InFormatted) > 0) {
                        action = 'BUY';
                        amountToken = amount0OutFormatted;
                        amountWETH = amount1InFormatted;
                        tokenSymbol = token0.symbol;
                        tokenPerEth = (parseFloat(amount0OutFormatted) / parseFloat(amount1InFormatted)).toFixed(6);
                    } else {
                        action = 'SELL';
                        amountToken = amount0InFormatted;
                        amountWETH = amount1OutFormatted;
                        tokenSymbol = token0.symbol;
                        tokenPerEth = (parseFloat(amount0InFormatted) / parseFloat(amount1OutFormatted)).toFixed(6);
                    }
                }
    
                const amountUSD = (parseFloat(amountWETH) * this.ethUsdPrice).toFixed(2);
                const tokenPerUsd = (parseFloat(tokenPerEth) / this.ethUsdPrice).toFixed(6);
    
                const message = `[${action} ${amountToken} ${tokenSymbol} ${action === 'BUY' ? '<=' : '=>'} ${amountWETH} WETH (~$${amountUSD}). Price: 1 ETH = ~${tokenPerEth} ${tokenSymbol}, 1$ = ~${tokenPerUsd} ${tokenSymbol}](${this._config.getEtherscanTxUrl(log.transactionHash)})`;
                Logger.log(message);
                
                if (walletEntity && walletEntity.walletSubscriptionMessages) {
                    const entries = Object.entries(walletEntity.walletSubscriptionMessages);
                    Promise.allSettled(entries.map(([chatId, messageId]) => this._telegramJobApiService.sendMessage(+chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true })));
                }
            } catch (error) {
                Logger.error(`Error processing swap event: ${error.message}`);
                Logger.verbose(log);
            }
        }
    }
    
    private async _handleBlock(blockNumber: number) {
        const block = await this.alchemy.core.getBlockWithTransactions(blockNumber);
        Logger.log(`New block received: ${blockNumber} Transactions: ${block.transactions.length} ${this._watchingWalletsHashesMap.size}`);

        this._blockCache.push({ blockNumber, transactions: block.transactions });
        if (this._blockCache.length > 30) {
            this._blockCache.shift();
        }

        for (const tx of block.transactions) {
            if (tx.to && this._isWatchingTransaction(tx.from, tx.to)) {
                Logger.log(`Transaction involving target wallet found: ${tx.hash}`);
                Logger.log(tx);

                const walletEntity = this._getWalletEntity(tx.from, tx.to);
                const message = this._formatTransactionMessage(walletEntity, tx.from, tx.to, tx.value, null, 'Transaction', tx.hash);

                if (walletEntity && walletEntity.walletSubscriptionMessages) {
                    const entries = Object.entries(walletEntity.walletSubscriptionMessages);
                    Promise.allSettled(entries.map(([chatId, messageId]) => this._telegramJobApiService.sendMessage(+chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true })));
                }
            }
        }
    }

    private _isWatchingTransaction(from: string, to: string) {
        return this._watchingWalletsHashesMap.has(from.toLowerCase()) || (typeof to === 'string' && this._watchingWalletsHashesMap.has(to.toLowerCase()));
    }

    private _getWalletEntity(from: string, to: string): WalletEntity | undefined {
        return this._targetWalletAddresses.find(wallet => wallet.hash === from.toLowerCase() || wallet.hash === to.toLowerCase());
    }

    private async _getTransactionFromCache(txHash: string, blockNumber: number): Promise<ethers.providers.TransactionResponse | null> {
        if (!this._blockCache.length || this._blockCache[this._blockCache.length - 1].blockNumber < blockNumber) {
            await this.blockSubject.pipe(filter(block => block >= blockNumber)).toPromise();
        }
        for (const block of this._blockCache) {
            const tx = block.transactions.find(tx => tx.hash === txHash);
            if (tx) {
                return tx;
            }
        }
        return null;
    }

    private _formatTransactionMessage(walletEntity: WalletEntity | undefined, from: string, to: string, value: ethers.BigNumber, tokenData: Fungible | null, type: string, txHash: string): string {
        const txUrl = this._config.getEtherscanTxUrl(txHash);
        const valueFormatted = tokenData ? ethers.utils.formatUnits(value, 18) : ethers.utils.formatEther(value);
        const symbol = tokenData ? tokenData.symbol : 'ETH';
        const walletInfo = walletEntity ? `(${walletEntity.alias})` : '';
    
        return `Wallet: ${walletEntity?.hash} ${walletInfo} ${type} involving target wallet: From: ${from} To: ${to} Value: ${valueFormatted} ${symbol}. Transaction: [${txHash}](${txUrl})`;
    }

    private _reconnectWebSocket() {
        Logger.log('Attempting to reconnect WebSocket...');
        this.alchemy.ws.removeAllListeners();
        this._setupWebSocket();
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async getActualWatchingWalletsAndTokens() {
        const watchingWallets = await this._walletService.getWatchingWallets();
        watchingWallets.forEach(wallet => wallet.hash = wallet.hash.toLowerCase());
        const watchingWalletsSet = new Set(watchingWallets.map(wallet => wallet.hash));
        const walletsForSubscribe = watchingWallets.filter(wallet => !this._watchingWalletsHashesMap.has(wallet.hash));
        const walletsForUnsubscribe = this._targetWalletAddresses.filter(wallet => !watchingWalletsSet.has(wallet.hash));

        walletsForSubscribe.forEach(wallet => this.addTargetWalletAddress(wallet));
        walletsForUnsubscribe.forEach(wallet => this.removeTargetWalletAddress(wallet));
    }

    private _connectToBinanceWebSocket() {
        const ws = new WebSocket('wss://stream.binance.com:9443/ws/ethusdt@trade');

        ws.on('message', (data) => {
            const trade = JSON.parse(data.toString());
            const price = parseFloat(trade.p);
            this.ethUsdPrice = price;
        });

        ws.on('error', (error) => {
            Logger.error(`WebSocket Error: ${error.message}`);
        });

        ws.on('close', () => {
            Logger.log('WebSocket connection closed. Attempting to reconnect...');
            setTimeout(() => this._connectToBinanceWebSocket(), 3000);
        });

        Logger.log('Connected to Binance WebSocket for ETH/USD price updates.');
    }
}
