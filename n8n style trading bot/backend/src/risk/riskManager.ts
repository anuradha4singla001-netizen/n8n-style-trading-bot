/**
 * Risk Manager
 *
 * Responsibilities:
 *  - Calculate position size based on % risk per trade
 *  - Compute stop-loss and take-profit prices
 *  - Enforce max drawdown circuit breaker
 *  - Track daily P&L limits
 *  - Gate all trade decisions through checkRules()
 */
import type { RiskConfig, Position, BotState, Signal } from '../types';
import { logger } from '../utils/logger';

export interface TradeDecision {
  approved: boolean;
  reason: string;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
}

export class RiskManager {
  private config: RiskConfig;
  private dailyLoss = 0;
  private dailyLossResetAt = Date.now();

  constructor(config: RiskConfig) {
    this.config = config;
  }

  /** Main gate — call before every potential trade */
  checkRules(state: BotState, signal: Signal, price: number): TradeDecision {
    const deny = (reason: string): TradeDecision =>
      ({ approved: false, reason, quantity: 0, stopLoss: 0, takeProfit: 0 });

    if (signal === 'HOLD') return deny('Signal is HOLD');

    // Reset daily loss counter at midnight
    if (Date.now() - this.dailyLossResetAt > 86_400_000) {
      this.dailyLoss = 0;
      this.dailyLossResetAt = Date.now();
    }

    // Max drawdown circuit breaker
    const drawdownPct = (state.startBalance - state.balance) / state.startBalance;
    if (drawdownPct >= this.config.maxDrawdownPct) {
      logger.warn(`RiskManager: max drawdown breached (${(drawdownPct * 100).toFixed(2)}%)`);
      return deny(`Max drawdown breached: ${(drawdownPct * 100).toFixed(2)}% >= ${(this.config.maxDrawdownPct * 100).toFixed(2)}%`);
    }

    // Daily loss limit
    const dailyLossPct = this.dailyLoss / state.startBalance;
    if (dailyLossPct >= this.config.maxDailyLossPct) {
      return deny(`Daily loss limit hit: ${(dailyLossPct * 100).toFixed(2)}%`);
    }

    // Too many open positions
    if (state.positions.length >= this.config.maxOpenPositions) {
      return deny(`Max open positions reached: ${this.config.maxOpenPositions}`);
    }

    // Don't open duplicate positions on same pair
    const pair = state.config.strategy.pair;
    const existingPosition = state.positions.find(p => p.pair === pair);
    if (existingPosition && signal === 'BUY' && existingPosition.side === 'BUY') {
      return deny('Already long on this pair');
    }

    // Calculate position size: risk pct of balance / stop loss distance
    const riskAmount = state.balance * this.config.maxPositionSizePct;
    const stopLossDistance = price * this.config.stopLossPct;
    const quantity = +(riskAmount / stopLossDistance).toFixed(6);

    if (quantity * price > state.balance) {
      return deny('Insufficient balance for position');
    }

    const stopLoss = signal === 'BUY'
      ? +(price * (1 - this.config.stopLossPct)).toFixed(4)
      : +(price * (1 + this.config.stopLossPct)).toFixed(4);

    const takeProfit = signal === 'BUY'
      ? +(price * (1 + this.config.takeProfitPct)).toFixed(4)
      : +(price * (1 - this.config.takeProfitPct)).toFixed(4);

    logger.info(`RiskManager: approved ${signal} qty=${quantity} SL=${stopLoss} TP=${takeProfit}`);
    return { approved: true, reason: 'All checks passed', quantity, stopLoss, takeProfit };
  }

  /** Called when a position closes at a loss */
  recordLoss(amount: number): void {
    this.dailyLoss += amount;
  }

  updateConfig(config: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
