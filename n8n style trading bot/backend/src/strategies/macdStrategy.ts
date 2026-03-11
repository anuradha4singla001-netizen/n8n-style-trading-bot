/**
 * MACD Trend-Following Strategy
 *
 * Logic:
 *   BUY  when MACD line crosses above signal line (bullish momentum)
 *   SELL when MACD line crosses below signal line (bearish momentum)
 *
 * Params: { fast: 12, slow: 26, signal: 9 }
 */
import type { Candle, StrategySignal } from '../types';
import { BaseStrategy } from './baseStrategy';
import { calcMACD } from '../utils/indicators';

export class MACDStrategy extends BaseStrategy {
  minCandles(): number {
    return (this.config.params.slow as number ?? 26) + (this.config.params.signal as number ?? 9) + 2;
  }

  evaluate(candles: Candle[]): StrategySignal {
    const fast = this.config.params.fast as number ?? 12;
    const slow = this.config.params.slow as number ?? 26;
    const sig  = this.config.params.signal as number ?? 9;

    const closes = candles.map(c => c.close);
    const macdNow  = calcMACD(closes, fast, slow, sig);
    const macdPrev = calcMACD(closes.slice(0, -1), fast, slow, sig);

    const nMacd = macdNow.values?.macd ?? null;
    const nSig  = macdNow.values?.signal ?? null;
    const pMacd = macdPrev.values?.macd ?? null;
    const pSig  = macdPrev.values?.signal ?? null;

    if (nMacd === null || nSig === null || pMacd === null || pSig === null) {
      return { signal: 'HOLD', confidence: 0, indicators: [macdNow], reason: 'Insufficient MACD data', timestamp: Date.now() };
    }

    const histogram = macdNow.values?.histogram ?? 0;

    if (pMacd <= pSig && nMacd > nSig) {
      return {
        signal: 'BUY',
        confidence: Math.min(1, Math.abs(histogram ?? 0) / 100),
        indicators: [macdNow],
        reason: `MACD bullish cross. Histogram: ${(histogram ?? 0).toFixed(4)}`,
        timestamp: Date.now(),
      };
    }

    if (pMacd >= pSig && nMacd < nSig) {
      return {
        signal: 'SELL',
        confidence: Math.min(1, Math.abs(histogram ?? 0) / 100),
        indicators: [macdNow],
        reason: `MACD bearish cross. Histogram: ${(histogram ?? 0).toFixed(4)}`,
        timestamp: Date.now(),
      };
    }

    return { signal: 'HOLD', confidence: 0, indicators: [macdNow], reason: 'No MACD crossover', timestamp: Date.now() };
  }
}
