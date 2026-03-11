/**
 * BotEngine — the core runtime for a single trading bot.
 *
 * Lifecycle:
 *   start() → subscribes to market feed → evaluates strategy on each tick
 *           → passes signals through RiskManager → executes paper orders
 *           → monitors open positions for SL/TP
 *
 * All state is kept in BotState so it can be serialized and sent to clients.
 */
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import type { BotConfig, BotState, Order, Position, StrategySignal, Tick } from '../types';
import { marketFeed, generateHistoricalCandles } from '../data/marketData';
import { createStrategy } from '../strategies';
import { RiskManager } from '../risk/riskManager';
import { logger } from '../utils/logger';

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000,
  '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
};

export class BotEngine extends EventEmitter {
  readonly id: string;
  private state: BotState;
  private strategy: ReturnType<typeof createStrategy>;
  private riskManager: RiskManager;
  private candleBuffer: Tick[] = [];
  private candleIntervalTimer?: NodeJS.Timeout;

  constructor(config: BotConfig) {
    super();
    this.id = uuid();
    this.strategy = createStrategy(config.strategy);
    this.riskManager = new RiskManager(config.strategy.risk);

    const balance = Number(process.env.INITIAL_BALANCE ?? 10_000);
    this.state = {
      id: this.id,
      config,
      status: 'idle',
      balance,
      startBalance: balance,
      positions: [],
      orders: [],
      signals: [],
      pnl: 0,
      pnlPct: 0,
      trades: 0,
      winRate: 0,
      createdAt: Date.now(),
    };
  }

  async start(): Promise<void> {
    logger.info(`BotEngine[${this.id}]: starting`);
    this.state.status = 'running';
    this.state.startedAt = Date.now();

    // Pre-load historical candles to warm up indicators
    const pair = this.state.config.strategy.pair;
    const intervalMs = INTERVAL_MS[this.state.config.strategy.interval] ?? 60_000;
    const historical = generateHistoricalCandles(pair, intervalMs, 200);
    historical.forEach(c => this.strategy.addCandle(c));
    logger.info(`BotEngine[${this.id}]: warmed up with ${historical.length} historical candles`);

    // Subscribe to live feed
    marketFeed.subscribe(pair);
    marketFeed.on('tick', this.onTick);

    // Build synthetic candles from ticks on interval
    this.candleIntervalTimer = setInterval(() => this.closeSyntheticCandle(), Math.min(intervalMs, 10_000));

    this.emit('status', this.state);
  }

  stop(): void {
    logger.info(`BotEngine[${this.id}]: stopping`);
    this.state.status = 'stopped';
    this.state.stoppedAt = Date.now();
    marketFeed.off('tick', this.onTick);
    if (this.candleIntervalTimer) clearInterval(this.candleIntervalTimer);
    this.emit('status', this.state);
  }

  getState(): BotState {
    // Refresh unrealised PnL before returning state
    const pair = this.state.config.strategy.pair;
    const currentPrice = marketFeed.currentPrice(pair);
    this.state.positions = this.state.positions.map(pos => ({
      ...pos,
      currentPrice,
      unrealisedPnl: pos.side === 'BUY'
        ? (currentPrice - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - currentPrice) * pos.quantity,
    }));
    const totalUnrealised = this.state.positions.reduce((s, p) => s + p.unrealisedPnl, 0);
    this.state.pnl = this.state.balance - this.state.startBalance + totalUnrealised;
    this.state.pnlPct = this.state.pnl / this.state.startBalance;
    return this.state;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private onTick = (tick: Tick): void => {
    if (tick.pair !== this.state.config.strategy.pair) return;
    this.candleBuffer.push(tick);
    this.checkStopLossTakeProfit(tick.price);
  };

  private closeSyntheticCandle(): void {
    if (this.candleBuffer.length === 0) return;
    const prices = this.candleBuffer.map(t => t.price);
    const candle = {
      timestamp: this.candleBuffer[0].timestamp,
      open:   prices[0],
      high:   Math.max(...prices),
      low:    Math.min(...prices),
      close:  prices.at(-1)!,
      volume: this.candleBuffer.reduce((s, t) => s + t.volume, 0),
    };
    this.candleBuffer = [];

    const signal = this.strategy.addCandle(candle);
    if (signal) this.handleSignal(signal, candle.close);
  }

  private handleSignal(signal: StrategySignal, price: number): void {
    this.state.signals.unshift(signal);
    if (this.state.signals.length > 50) this.state.signals.pop();

    this.emit('signal', { botId: this.id, signal });
    logger.info(`BotEngine[${this.id}]: signal=${signal.signal} conf=${signal.confidence.toFixed(2)} reason="${signal.reason}"`);

    if (signal.signal === 'HOLD') return;

    const decision = this.riskManager.checkRules(this.state, signal.signal, price);
    if (!decision.approved) {
      logger.info(`BotEngine[${this.id}]: trade rejected — ${decision.reason}`);
      return;
    }

    this.executeOrder(signal, price, decision.quantity, decision.stopLoss, decision.takeProfit);
  }

  private executeOrder(signal: StrategySignal, price: number, quantity: number, stopLoss: number, takeProfit: number): void {
    const pair = this.state.config.strategy.pair;
    const side = signal.signal as 'BUY' | 'SELL';

    // Close opposing position first
    const opposing = this.state.positions.find(p => p.pair === pair && p.side !== side);
    if (opposing) this.closePosition(opposing, price, 'Signal reversal');

    const order: Order = {
      id: uuid(), botId: this.id, pair, side, quantity, price,
      status: 'filled', createdAt: Date.now(), filledAt: Date.now(),
    };

    this.state.orders.unshift(order);
    if (this.state.orders.length > 100) this.state.orders.pop();

    // Deduct cost from balance
    const cost = quantity * price;
    this.state.balance -= cost;

    const position: Position = {
      pair, side, quantity, entryPrice: price, currentPrice: price,
      unrealisedPnl: 0, realisedPnl: 0, stopLoss, takeProfit, openedAt: Date.now(),
    };

    this.state.positions.push(position);
    this.state.trades++;

    logger.info(`BotEngine[${this.id}]: order filled ${side} ${quantity} ${pair} @ ${price}`);
    this.emit('order', { botId: this.id, order });
    this.emit('position', { botId: this.id, position });
  }

  private closePosition(position: Position, price: number, reason: string): void {
    const pnl = position.side === 'BUY'
      ? (price - position.entryPrice) * position.quantity
      : (position.entryPrice - price) * position.quantity;

    if (pnl < 0) this.riskManager.recordLoss(Math.abs(pnl));

    // Return position value + pnl to balance
    this.state.balance += position.quantity * price;

    // Track win/loss
    const wins = this.state.signals.filter((_, i) => i < this.state.trades && pnl > 0).length;
    this.state.winRate = this.state.trades > 0 ? wins / this.state.trades : 0;

    this.state.positions = this.state.positions.filter(p => p !== position);
    logger.info(`BotEngine[${this.id}]: closed position pnl=${pnl.toFixed(2)} reason="${reason}"`);
    this.emit('position_closed', { botId: this.id, pnl, reason });
  }

  private checkStopLossTakeProfit(price: number): void {
    this.state.positions.forEach(pos => {
      if (pos.stopLoss && pos.side === 'BUY'  && price <= pos.stopLoss)  this.closePosition(pos, price, 'Stop-loss hit');
      if (pos.stopLoss && pos.side === 'SELL' && price >= pos.stopLoss)  this.closePosition(pos, price, 'Stop-loss hit');
      if (pos.takeProfit && pos.side === 'BUY'  && price >= pos.takeProfit) this.closePosition(pos, price, 'Take-profit hit');
      if (pos.takeProfit && pos.side === 'SELL' && price <= pos.takeProfit) this.closePosition(pos, price, 'Take-profit hit');
    });
  }
}
