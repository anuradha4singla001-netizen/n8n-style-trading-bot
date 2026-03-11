/**
 * Backtester
 *
 * Runs a strategy against historical candle data and returns
 * full performance metrics: returns, drawdown, Sharpe, win rate, etc.
 */
import type { BacktestRequest, BacktestResult, BacktestTrade } from '../types';
import { generateHistoricalCandles } from '../data/marketData';
import { createStrategy } from '../strategies';
import { RiskManager } from '../risk/riskManager';
import { logger } from '../utils/logger';

export async function runBacktest(req: BacktestRequest): Promise<BacktestResult> {
  logger.info(`Backtester: running ${req.strategy.type} on ${req.strategy.pair}`);

  const intervalMs: Record<string, number> = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000,
    '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
  };
  const ms = intervalMs[req.strategy.interval] ?? 60_000;
  const totalMs = req.toDate - req.fromDate;
  const count = Math.min(Math.floor(totalMs / ms), 1000);

  const candles = generateHistoricalCandles(req.strategy.pair, ms, count);
  const strategy = createStrategy(req.strategy);

  let balance = req.initialBalance;
  const startBalance = req.initialBalance;
  const trades: BacktestTrade[] = [];
  const equityCurve: Array<{ timestamp: number; equity: number }> = [];

  type OpenPos = { entryTime: number; entryPrice: number; side: 'BUY' | 'SELL'; quantity: number; stopLoss: number; takeProfit: number };
  let openPos: OpenPos | null = null;

  const rm = new RiskManager(req.strategy.risk);
  const fakeState = () => ({ balance, startBalance, positions: openPos ? [openPos as any] : [], signals: [], trades: trades.length, winRate: 0, config: { strategy: req.strategy }, id: '', status: 'running' as any, orders: [], pnl: 0, pnlPct: 0, createdAt: 0 });

  for (const candle of candles) {
    // Check SL/TP on current candle
    if (openPos) {
      let closed = false;
      let closePrice = candle.close;
      let reason = '';

      if (openPos.side === 'BUY') {
        if (candle.low <= openPos.stopLoss)   { closePrice = openPos.stopLoss; reason = 'Stop-loss'; closed = true; }
        if (candle.high >= openPos.takeProfit) { closePrice = openPos.takeProfit; reason = 'Take-profit'; closed = true; }
      } else {
        if (candle.high >= openPos.stopLoss)  { closePrice = openPos.stopLoss; reason = 'Stop-loss'; closed = true; }
        if (candle.low <= openPos.takeProfit) { closePrice = openPos.takeProfit; reason = 'Take-profit'; closed = true; }
      }

      if (closed) {
        const pnl = openPos.side === 'BUY'
          ? (closePrice - openPos.entryPrice) * openPos.quantity
          : (openPos.entryPrice - closePrice) * openPos.quantity;
        balance += openPos.quantity * closePrice;
        trades.push({ entryTime: openPos.entryTime, exitTime: candle.timestamp, side: openPos.side, entryPrice: openPos.entryPrice, exitPrice: closePrice, quantity: openPos.quantity, pnl, pnlPct: pnl / (openPos.entryPrice * openPos.quantity), reason });
        openPos = null;
      }
    }

    const signal = strategy.addCandle(candle);
    if (signal && signal.signal !== 'HOLD' && !openPos) {
      const decision = rm.checkRules(fakeState() as any, signal.signal, candle.close);
      if (decision.approved) {
        balance -= decision.quantity * candle.close;
        openPos = { entryTime: candle.timestamp, entryPrice: candle.close, side: signal.signal as 'BUY'|'SELL', quantity: decision.quantity, stopLoss: decision.stopLoss, takeProfit: decision.takeProfit };
      }
    }

    equityCurve.push({ timestamp: candle.timestamp, equity: balance + (openPos ? openPos.quantity * candle.close : 0) });
  }

  // Close any open position at end
  if (openPos && candles.length > 0) {
    const lastPrice = candles.at(-1)!.close;
    const pnl = openPos.side === 'BUY' ? (lastPrice - openPos.entryPrice) * openPos.quantity : (openPos.entryPrice - lastPrice) * openPos.quantity;
    balance += openPos.quantity * lastPrice;
    trades.push({ entryTime: openPos.entryTime, exitTime: candles.at(-1)!.timestamp, side: openPos.side, entryPrice: openPos.entryPrice, exitPrice: lastPrice, quantity: openPos.quantity, pnl, pnlPct: pnl / (openPos.entryPrice * openPos.quantity), reason: 'End of backtest' });
  }

  // ── Metrics ────────────────────────────────────────────────────────────────
  const finalEquity = balance;
  const totalReturn = finalEquity - startBalance;
  const totalReturnPct = totalReturn / startBalance;

  const wins  = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const winRate = trades.length ? wins.length / trades.length : 0;
  const avgWin  = wins.length  ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
  const profitFactor = avgLoss > 0 ? (wins.reduce((s, t) => s + t.pnl, 0)) / Math.abs(losses.reduce((s, t) => s + t.pnl, 0)) : 0;

  // Max drawdown
  let peak = startBalance, maxDrawdown = 0;
  equityCurve.forEach(p => {
    if (p.equity > peak) peak = p.equity;
    const dd = (peak - p.equity) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  // Sharpe ratio (simplified, annualised, assumes daily returns)
  const returns = equityCurve.slice(1).map((p, i) => (p.equity - equityCurve[i].equity) / equityCurve[i].equity);
  const meanReturn = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  const variance = returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (returns.length || 1);
  const sharpeRatio = variance > 0 ? (meanReturn / Math.sqrt(variance)) * Math.sqrt(252) : 0;

  logger.info(`Backtester: ${trades.length} trades, return=${(totalReturnPct * 100).toFixed(2)}%, winRate=${(winRate * 100).toFixed(1)}%`);

  return {
    totalReturn: +totalReturn.toFixed(2),
    totalReturnPct: +totalReturnPct.toFixed(4),
    maxDrawdown: +(maxDrawdown * startBalance).toFixed(2),
    maxDrawdownPct: +maxDrawdown.toFixed(4),
    sharpeRatio: +sharpeRatio.toFixed(3),
    winRate: +winRate.toFixed(4),
    totalTrades: trades.length,
    profitFactor: +profitFactor.toFixed(3),
    avgWin: +avgWin.toFixed(2),
    avgLoss: +avgLoss.toFixed(2),
    trades,
    equityCurve,
  };
}
