import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import WebSocket from 'ws';

@Injectable()
export class EthPriceService implements OnModuleInit, OnModuleDestroy {
    private ethUsdPrice = 0;
    private ws: WebSocket;

    get price() {
        return this.ethUsdPrice;
    }

    onModuleInit() {
        this._connectToBinanceWebSocket();
    }

    onModuleDestroy() {
        if (this.ws) {
            this.ws.close();
        }
    }

    private _connectToBinanceWebSocket() {
        this.ws = new WebSocket('wss://stream.binance.com:9443/ws/ethusdt@trade');

        this.ws.on('message', (data) => {
            const trade = JSON.parse(data.toString());
            const price = parseFloat(trade.p);
            this.ethUsdPrice = price;
        });

        this.ws.on('error', (error) => {
            Logger.error(`WebSocket Error: ${error.message}`);
        });

        this.ws.on('close', () => {
            Logger.log('WebSocket connection closed. Attempting to reconnect...');
            setTimeout(() => this._connectToBinanceWebSocket(), 3000);
        });

        Logger.log('Connected to Binance WebSocket for ETH/USD price updates.');
    }
}
