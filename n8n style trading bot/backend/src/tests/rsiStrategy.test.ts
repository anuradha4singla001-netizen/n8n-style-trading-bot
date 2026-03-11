import { RSIStrategy } from '../strategies/rsiStrategy';
import { generateHistoricalCandles } from '../data/marketData';

const baseConfig = {
  type: 'rsi' as const,
  pair: 'BTC/USDT',
  interval: '5m' as const,
  params: { period: 14, oversold: 30, overbought: 70 },
  risk: { maxPositionSizePct: 0.02, stopLossPct: 0.015, takeProfitPct: 0.03, maxDrawdownPct: 0.1, maxOpenPositions: 3, maxDailyLossPct: 0.05 },
};

describe('RSIStrategy', () => {
  it('returns null until enough candles are loaded', () => {
    const strategy = new RSIStrategy(baseConfig);
    const candles = generateHistoricalCandles('BTC/USDT', 300_000, 10);
    const results = candles.map(c => strategy.addCandle(c));
    expect(results.every(r => r === null)).toBe(true);
  });

  it('returns a valid signal after enough candles', () => {
    const strategy = new RSIStrategy(baseConfig);
    const candles = generateHistoricalCandles('BTC/USDT', 300_000, 100);
    let lastSignal = null;
    candles.forEach(c => { const s = strategy.addCandle(c); if (s) lastSignal = s; });
    expect(lastSignal).not.toBeNull();
    expect(['BUY', 'SELL', 'HOLD']).toContain((lastSignal as any).signal);
  });

  it('signal confidence is between 0 and 1', () => {
    const strategy = new RSIStrategy(baseConfig);
    const candles = generateHistoricalCandles('BTC/USDT', 300_000, 100);
    candles.forEach(c => {
      const s = strategy.addCandle(c);
      if (s) {
        expect(s.confidence).toBeGreaterThanOrEqual(0);
        expect(s.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});
