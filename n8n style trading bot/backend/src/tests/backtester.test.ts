import { runBacktest } from '../engine/backtester';

const req = {
  strategy: {
    type: 'rsi' as const,
    pair: 'BTC/USDT',
    interval: '1h' as const,
    params: { period: 14, oversold: 30, overbought: 70 },
    risk: { maxPositionSizePct: 0.02, stopLossPct: 0.015, takeProfitPct: 0.03, maxDrawdownPct: 0.15, maxOpenPositions: 5, maxDailyLossPct: 0.05 },
  },
  fromDate: Date.now() - 30 * 86_400_000,
  toDate: Date.now(),
  initialBalance: 10_000,
};

describe('Backtester', () => {
  it('returns a complete result object', async () => {
    const result = await runBacktest(req);
    expect(result).toHaveProperty('totalReturn');
    expect(result).toHaveProperty('winRate');
    expect(result).toHaveProperty('sharpeRatio');
    expect(result).toHaveProperty('trades');
    expect(result).toHaveProperty('equityCurve');
    expect(Array.isArray(result.trades)).toBe(true);
    expect(Array.isArray(result.equityCurve)).toBe(true);
  }, 15_000);

  it('equity curve starts at initialBalance', async () => {
    const result = await runBacktest(req);
    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(result.equityCurve[0].equity).toBeCloseTo(req.initialBalance, -2);
  }, 15_000);

  it('winRate is between 0 and 1', async () => {
    const result = await runBacktest(req);
    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(1);
  }, 15_000);
});
