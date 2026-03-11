import { RiskManager } from '../risk/riskManager';

const config = {
  maxPositionSizePct: 0.02,
  stopLossPct: 0.015,
  takeProfitPct: 0.03,
  maxDrawdownPct: 0.10,
  maxOpenPositions: 3,
  maxDailyLossPct: 0.05,
};

const makeState = (overrides = {}) => ({
  id: 'test', balance: 10_000, startBalance: 10_000, positions: [], signals: [],
  status: 'running', orders: [], pnl: 0, pnlPct: 0, trades: 0, winRate: 0,
  config: { name: 'test', strategy: { type: 'rsi', pair: 'BTC/USDT', interval: '5m', params: {}, risk: config }, nodes: [], edges: [] },
  createdAt: Date.now(),
  ...overrides,
} as any);

describe('RiskManager', () => {
  it('approves a valid trade', () => {
    const rm = new RiskManager(config);
    const result = rm.checkRules(makeState(), 'BUY', 65_000);
    expect(result.approved).toBe(true);
    expect(result.quantity).toBeGreaterThan(0);
  });

  it('rejects HOLD signal', () => {
    const rm = new RiskManager(config);
    const result = rm.checkRules(makeState(), 'HOLD', 65_000);
    expect(result.approved).toBe(false);
  });

  it('rejects when drawdown limit exceeded', () => {
    const rm = new RiskManager(config);
    const state = makeState({ balance: 8_000 }); // 20% drawdown > 10% limit
    const result = rm.checkRules(state, 'BUY', 65_000);
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('drawdown');
  });

  it('sets stop-loss below entry for BUY', () => {
    const rm = new RiskManager(config);
    const price = 65_000;
    const result = rm.checkRules(makeState(), 'BUY', price);
    expect(result.stopLoss).toBeLessThan(price);
    expect(result.takeProfit).toBeGreaterThan(price);
  });
});
