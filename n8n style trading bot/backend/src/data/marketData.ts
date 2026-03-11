/**
 * Market data service.
 * - Generates realistic mock OHLCV candles using GBM (Geometric Brownian Motion)
 * - Simulates a live WebSocket price feed
 * - In production, swap mockFeed() for a real Binance/Coinbase WS connection
 */
import { EventEmitter } from 'events';
import type { Candle, Tick } from '../types';
import { logger } from '../utils/logger';

// Seed prices per pair
const BASE_PRICES: Record<string, number> = {
  'BTC/USDT': 65000, 'ETH/USDT': 3400, 'SOL/USDT': 182,
  'BNB/USDT': 580,   'ADA/USDT': 0.62, 'XRP/USDT': 0.52,
};

/** Generate N historical OHLCV candles using GBM */
export function generateHistoricalCandles(pair: string, intervalMs: number, count: number): Candle[] {
  const basePrice = BASE_PRICES[pair] ?? 100;
  const candles: Candle[] = [];
  const drift = 0.0001;
  const volatility = 0.002;
  let price = basePrice * (0.8 + Math.random() * 0.4);
  const now = Date.now();

  for (let i = count - 1; i >= 0; i--) {
    const ts = now - i * intervalMs;
    const open = price;
    const change = drift + volatility * (Math.random() * 2 - 1);
    price = price * (1 + change);
    const high = Math.max(open, price) * (1 + Math.random() * 0.003);
    const low  = Math.min(open, price) * (1 - Math.random() * 0.003);
    const volume = basePrice * (0.5 + Math.random() * 2) * 10;
    candles.push({ timestamp: ts, open: +open.toFixed(4), high: +high.toFixed(4), low: +low.toFixed(4), close: +price.toFixed(4), volume: +volume.toFixed(2) });
  }
  return candles;
}

/** Live price feed emitter — emits 'tick' events every ~1s per pair */
export class MarketDataFeed extends EventEmitter {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private prices: Map<string, number> = new Map();

  subscribe(pair: string): void {
    if (this.intervals.has(pair)) return;
    this.prices.set(pair, BASE_PRICES[pair] ?? 100);
    logger.info(`MarketDataFeed: subscribing to ${pair}`);

    const iv = setInterval(() => {
      const prev = this.prices.get(pair)!;
      const change = (Math.random() - 0.498) * 0.003; // slight upward drift
      const price = +(prev * (1 + change)).toFixed(4);
      this.prices.set(pair, price);
      const tick: Tick = { pair, price, volume: +(Math.random() * 5).toFixed(3), timestamp: Date.now() };
      this.emit('tick', tick);
    }, 800 + Math.random() * 400);

    this.intervals.set(pair, iv);
  }

  unsubscribe(pair: string): void {
    const iv = this.intervals.get(pair);
    if (iv) { clearInterval(iv); this.intervals.delete(pair); }
  }

  currentPrice(pair: string): number {
    return this.prices.get(pair) ?? BASE_PRICES[pair] ?? 0;
  }

  stop(): void {
    this.intervals.forEach(iv => clearInterval(iv));
    this.intervals.clear();
  }
}

// Singleton feed
export const marketFeed = new MarketDataFeed();
