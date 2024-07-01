import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { ethers } from "ethers";
import { AppConfig } from "../app.config";
import { fromEvent, Subscription } from "rxjs";
import { catchError, filter, switchMap, tap } from "rxjs/operators";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WalletService } from "../wallet/wallet.service";
import { WalletEntity } from "../wallet/wallet.entity";
import { TelegramJobApiService } from "../telegraf/telegram-job-api.service";

@Injectable()
export class EthRuntimeWatcherService implements OnModuleInit, OnModuleDestroy {
    private _provider: ethers.providers.WebSocketProvider;
    private _httpProvider: ethers.providers.JsonRpcProvider;
    private readonly _targetWalletAddresses: WalletEntity[] = [];
    private readonly _watchingWalletsHashesMap = new Map<string, Subscription[]>();
    private readonly _subscriptions: Subscription[] = [];

    private readonly ERC20_ABI = [
        "event Transfer(address indexed from, address indexed to, uint256 value)"
    ];

    private readonly UNISWAP_V2_PAIR_ABI = [
        "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
    ];

    constructor(
        private readonly _config: AppConfig, 
        private readonly _walletService: WalletService,
        private readonly _telegramJobApiService: TelegramJobApiService,
    ) {}

    async onModuleInit() {
        const websocketUrl = this._config.getAlchemyWebsocketUrl();
        const httpUrl = this._config.getAlchemyHttpUrl();

        this._provider = new ethers.providers.WebSocketProvider(websocketUrl);
        this._httpProvider = new ethers.providers.JsonRpcProvider(httpUrl);

        this._setupWebSocket();
    }

    async onModuleDestroy() {
        if (this._provider) {
            this._provider.removeAllListeners();
            await this._provider.destroy();
        }
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

    private _trackTransfers(contractAddress: string) {
        const contract = new ethers.Contract(contractAddress, this.ERC20_ABI, this._provider);
        const transferEvents$ = fromEvent(contract, "Transfer");

        const subscription = transferEvents$
            .pipe(
                filter(([from, to]) => this._isWatchingTransaction(from, to)),
                tap(([from, to, value, event]) => {
                    const walletEntity = this._getWalletEntity(from, to);
                    
                    const message = [
                        `Wallet ${walletEntity?.hash} (${walletEntity?.alias})`,
                        `ERC-20 Transfer involving target wallet:`,
                        `From: ${from}`,
                        `To: ${to}`,
                        `Value: ${ethers.utils.formatUnits(value, 18)}`
                    ].join('\n');

                    Logger.log(message);
                    Logger.log(event);

                    if (walletEntity && walletEntity.walletSubscriptionMessages) {
                        const entries = Object.entries(walletEntity.walletSubscriptionMessages);
                        Promise.allSettled(entries.map(([chatId, messageId]) => this._telegramJobApiService.sendMessage(+chatId, message)));
                    }
                })
            )
            .subscribe();

        this._subscriptions.push(subscription);
    }

    private _trackSwaps(pairAddress: string) {
        const pairContract = new ethers.Contract(pairAddress, this.UNISWAP_V2_PAIR_ABI, this._provider);
        const swapEvents$ = fromEvent(pairContract, "Swap");

        const subscription = swapEvents$
            .pipe(
                filter(([sender, , , , , to]) => this._isWatchingTransaction(sender, to)),
                tap(([sender, amount0In, amount1In, amount0Out, amount1Out, to, event]) => {
                    const walletEntity = this._getWalletEntity(sender, to);
                    
                    const message = [
                        `Wallet ${walletEntity?.hash} (${walletEntity?.alias})`,
                        `Swap involving target wallet:`,
                        `Sender: ${sender}`,
                        `To: ${to}`,
                        `Amount0 In: ${ethers.utils.formatUnits(amount0In, 18)}`,
                        `Amount1 In: ${ethers.utils.formatUnits(amount1In, 18)}`,
                        `Amount0 Out: ${ethers.utils.formatUnits(amount0Out, 18)}`,
                        `Amount1 Out: ${ethers.utils.formatUnits(amount1Out, 18)}`
                    ].join('\n');

                    Logger.log(message);
                    Logger.log(event);

                    if (walletEntity && walletEntity.walletSubscriptionMessages) {
                        const entries = Object.entries(walletEntity.walletSubscriptionMessages);
                        Promise.allSettled(entries.map(([chatId, messageId]) => this._telegramJobApiService.sendMessage(+chatId, message)));
                    }
                })
            )
            .subscribe();

        this._subscriptions.push(subscription);
    }

    private _setupWebSocket() {
        const blockEvents$ = fromEvent(this._provider, "block");

        const subscription = blockEvents$
            .pipe(
                switchMap(async (blockNumber: number) => {
                    const block = await this._provider.getBlockWithTransactions(blockNumber);
                    // Logger.verbose(`Block ${blockNumber} transactions: ${block.transactions.length}`);

                    for (const tx of block.transactions) {
                        if (tx.to && this._isWatchingTransaction(tx.from, tx.to)) {
                            Logger.log(`Transaction involving target wallet found: ${tx.hash}`);
                            Logger.log(tx);

                            const walletEntity = this._getWalletEntity(tx.from, tx.to);

                            const message = [
                                `Wallet ${walletEntity?.hash} (${walletEntity?.alias})`,
                                `Transaction involving target wallet found: ${tx.hash}`,
                                `From: ${tx.from}`,
                                `To: ${tx.to}`,
                                `Value: ${ethers.utils.formatUnits(tx.value, 18)}`
                            ].join('\n');

                            if (walletEntity && walletEntity.walletSubscriptionMessages) {
                                const entries = Object.entries(walletEntity.walletSubscriptionMessages);
                                Promise.allSettled(entries.map(([chatId, messageId]) => this._telegramJobApiService.sendMessage(+chatId, message)));
                            }

                            // Проверяем, является ли адрес контракта ERC-20 токеном
                            const code = await this._provider.getCode(tx.to);
                            if (code !== '0x') {
                                const contract = new ethers.Contract(tx.to, this.ERC20_ABI, this._provider);
                                try {
                                    await contract.deployed();
                                    // Подписываемся на события Transfer для этого контракта
                                    this._trackTransfers(tx.to);
                                } catch (error) {
                                    Logger.log(`Contract at ${tx.to} is not a valid ERC-20 token contract.`);
                                }

                                // Проверяем, является ли адрес контракта парой Uniswap V2
                                const pairContract = new ethers.Contract(tx.to, this.UNISWAP_V2_PAIR_ABI, this._provider);
                                try {
                                    await pairContract.deployed();
                                    // Подписываемся на события Swap для этой пары
                                    this._trackSwaps(tx.to);
                                } catch (error) {
                                    Logger.log(`Contract at ${tx.to} is not a valid Uniswap V2 pair contract.`);
                                }
                            }
                        }
                    }
                }),
                catchError(error => {
                    Logger.error(`Error processing block: ${error.message} ${error.message}`);
                    return [];
                })
            )
            .subscribe();

        this._subscriptions.push(subscription);

        const websocketErrorEvents$ = fromEvent(this._provider._websocket, "error");
        const websocketCloseEvents$ = fromEvent(this._provider._websocket, "close");

        this._subscriptions.push(
            websocketErrorEvents$.subscribe((error: Error) => {
                Logger.log(`WebSocket Error: ${error.message}`);
            })
        );

        this._subscriptions.push(
            websocketCloseEvents$.subscribe((code: number) => {
                Logger.log(`WebSocket Closed: ${code}`);
                // Реализуйте переподключение при закрытии соединения
                Logger.log('Attempting to reconnect in 3 seconds...');
                setTimeout(() => {
                    this._provider = new ethers.providers.WebSocketProvider(this._config.getAlchemyWebsocketUrl());
                    this._setupWebSocket();
                }, 3000);
            })
        );

        Logger.log('WebSocket connection established, listening for ERC-20 transfers and swaps involving target wallet...');
    }

    private _isWatchingTransaction(from: string, to: string) {
        return this._watchingWalletsHashesMap.has(from) || (typeof to === 'string' && this._watchingWalletsHashesMap.has(to));
    }

    private _getWalletEntity(from: string, to: string): WalletEntity | undefined {
        return this._targetWalletAddresses.find(wallet => wallet.hash === from || wallet.hash === to);
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
    async getActualWatchingWallets() {
        const watchingWallets = await this._walletService.getWatchingWallets();
        const watchingWalletsSet = new Set(watchingWallets.map(wallet => wallet.hash));
        const walletsForSubscribe = watchingWallets.filter(wallet => !this._watchingWalletsHashesMap.has(wallet.hash));
        const walletsForUnsubscribe = this._targetWalletAddresses.filter(wallet => !watchingWalletsSet.has(wallet.hash));

        walletsForSubscribe.forEach(wallet => this.addTargetWalletAddress(wallet));
        walletsForUnsubscribe.forEach(wallet => this.removeTargetWalletAddress(wallet));
    }
}
