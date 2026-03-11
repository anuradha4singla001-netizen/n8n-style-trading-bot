/**
 * Bollinger Bands Mean-Reversion Strategy
 *
 * Logic:
 *   BUY  when price touches/breaks lower band (oversold squeeze)
 *   SELL when price touches/breaks upper band (overbought)
 *   Adds ATR filter to avoid low-volatility false signals
 *
 * Params: { period: 20, stdDev: 2 }
 */
import type { Candle, StrategySignal } from '../types';
import { BaseStrategy } from './baseStrategy';
import { calcBollingerBands, calcATR } from '../utils/indicators';

export class BollingerStrategy extends BaseStrategy {
  minCandles(): number {
    return (this.config.params.period as number ?? 20) + 5;
  }

  evaluate(candles: Candle[]): StrategySignal {
    const period = this.config.params.period as number ?? 20;
    const stdDev = this.config.params.stdDev as number ?? 2;

    const closes = candles.map(c => c.close);
    const bb  = calcBollingerBands(closes, period, stdDev);
    const atr = calcATR(candles, 14);

    const price  = closes.at(-1)!;
    const upper  = bb.values?.upper ?? null;
    const lower  = bb.values?.lower ?? null;
    const middle = bb.values?.middle ?? null;

    if (!upper || !lower || !middle) {
      return { signal: 'HOLD', confidence: 0, indicators: [bb], reason: 'BB not ready', timestamp: Date.now() };
    }

    // Band width — skip if bands are too narrow (low volatility)
    const bandWidth = (upper - lower) / middle;
    if (bandWidth < 0.01) {
      return { signal: 'HOLD', confidence: 0, indicators: [bb, atr], reason: 'Low volatility — bands too narrow', timestamp: Date.now() };
    }

    const distFromLower = (price - lower) / (upper - lower);

    if (price <= lower) {
      const conf = Math.min(1, (lower - price) / (atr.value ?? 1) + 0.5);
      return { signal: 'BUY', confidence: conf, indicators: [bb, atr], reason: `Price ${price} hit lower band ${lower.toFixed(4)}`, timestamp: Date.now() };
    }

    if (price >= upper) {
      const conf = Math.min(1, (price - upper) / (atr.value ?? 1) + 0.5);
      return { signal: 'SELL', confidence: conf, indicators: [bb, atr], reason: `Price ${price} hit upper band ${upper.toFixed(4)}`, timestamp: Date.now() };
    }

    return { signal: 'HOLD', confidence: 0, indicators: [bb], reason: `Price in band: ${(distFromLower * 100).toFixed(1)}%`, timestamp: Date.now() };
  }
}
