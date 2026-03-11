/**
 * RSI Mean-Reversion Strategy
 *
 * Logic:
 *   BUY  when RSI crosses UP through oversold threshold (default 30)
 *   SELL when RSI crosses DOWN through overbought threshold (default 70)
 *   HOLD otherwise
 *
 * Params: { period: 14, oversold: 30, overbought: 70 }
 */
import type { Candle, StrategySignal } from '../types';
import { BaseStrategy } from './baseStrategy';
import { calcRSI } from '../utils/indicators';

export class RSIStrategy extends BaseStrategy {
  minCandles(): number {
    return (this.config.params.period as number ?? 14) + 2;
  }

  evaluate(candles: Candle[]): StrategySignal {
    const period = this.config.params.period as number ?? 14;
    const oversold = this.config.params.oversold as number ?? 30;
    const overbought = this.config.params.overbought as number ?? 70;

    const closes = candles.map(c => c.close);
    const rsiNow = calcRSI(closes, period);
    const rsiPrev = calcRSI(closes.slice(0, -1), period);

    const now = rsiNow.value;
    const prev = rsiPrev.value;

    if (now === null || prev === null) {
      return { signal: 'HOLD', confidence: 0, indicators: [rsiNow], reason: 'Insufficient data', timestamp: Date.now() };
    }

    // Bullish crossover: RSI was below oversold, now above
    if (prev <= oversold && now > oversold) {
      return {
        signal: 'BUY',
        confidence: Math.min(1, (oversold - now + 10) / 20),
        indicators: [rsiNow],
        reason: `RSI crossed above oversold: ${now.toFixed(2)}`,
        timestamp: Date.now(),
      };
    }

    // Bearish crossover: RSI was above overbought, now below
    if (prev >= overbought && now < overbought) {
      return {
        signal: 'SELL',
        confidence: Math.min(1, (now - overbought + 10) / 20),
        indicators: [rsiNow],
        reason: `RSI crossed below overbought: ${now.toFixed(2)}`,
        timestamp: Date.now(),
      };
    }

    return { signal: 'HOLD', confidence: 0, indicators: [rsiNow], reason: `RSI neutral: ${now.toFixed(2)}`, timestamp: Date.now() };
  }
}
