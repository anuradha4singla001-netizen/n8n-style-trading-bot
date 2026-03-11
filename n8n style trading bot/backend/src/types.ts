// ─── Core domain types ────────────────────────────────────────────────────────

export type Side = 'BUY' | 'SELL';
export type Signal = 'BUY' | 'SELL' | 'HOLD';
export type BotStatus = 'idle' | 'running' | 'stopped' | 'error';
export type OrderStatus = 'open' | 'filled' | 'cancelled';
export type NodeType = 'trigger' | 'condition' | 'indicator' | 'action' | 'alert';

// OHLCV candle
export interface Candle {
  timestamp: number;   // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// A single price tick
export interface Tick {
  pair: string;
  price: number;
  volume: number;
  timestamp: number;
}

// Indicator output
export interface IndicatorResult {
  name: string;
  value: number | null;
  values?: Record<string, number | null>; // e.g. { macd, signal, histogram }
}

// Strategy signal output
export interface StrategySignal {
  signal: Signal;
  confidence: number;       // 0–1
  indicators: IndicatorResult[];
  reason: string;
  timestamp: number;
}

// ─── Order & Position ─────────────────────────────────────────────────────────

export interface Order {
  id: string;
  botId: string;
  pair: string;
  side: Side;
  quantity: number;
  price: number;
  status: OrderStatus;
  createdAt: number;
  filledAt?: number;
}

export interface Position {
  pair: string;
  side: Side;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealisedPnl: number;
  realisedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: number;
}

// ─── Risk config ──────────────────────────────────────────────────────────────

export interface RiskConfig {
  maxPositionSizePct: number;   // % of balance per trade (e.g. 0.02 = 2%)
  stopLossPct: number;          // e.g. 0.015 = 1.5%
  takeProfitPct: number;        // e.g. 0.03 = 3%
  maxDrawdownPct: number;       // halt bot if drawdown exceeds this
  maxOpenPositions: number;
  maxDailyLossPct: number;
}

// ─── Strategy config ──────────────────────────────────────────────────────────

export interface StrategyConfig {
  type: 'rsi' | 'macd' | 'bollinger' | 'ema_cross' | 'composite';
  pair: string;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  params: Record<string, number | string>;
  risk: RiskConfig;
}

// ─── Bot ──────────────────────────────────────────────────────────────────────

export interface BotConfig {
  name: string;
  strategy: StrategyConfig;
  nodes: FlowNode[];   // visual flow definition
  edges: FlowEdge[];
}

export interface BotState {
  id: string;
  config: BotConfig;
  status: BotStatus;
  balance: number;
  startBalance: number;
  positions: Position[];
  orders: Order[];
  signals: StrategySignal[];
  pnl: number;
  pnlPct: number;
  trades: number;
  winRate: number;
  createdAt: number;
  startedAt?: number;
  stoppedAt?: number;
  error?: string;
}

// ─── Flow nodes (from visual builder) ────────────────────────────────────────

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  config: Record<string, string | number>;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
}

// ─── Backtest ─────────────────────────────────────────────────────────────────

export interface BacktestRequest {
  strategy: StrategyConfig;
  fromDate: number;   // unix ms
  toDate: number;
  initialBalance: number;
}

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  side: Side;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  reason: string;
}

export interface BacktestResult {
  totalReturn: number;
  totalReturnPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  trades: BacktestTrade[];
  equityCurve: Array<{ timestamp: number; equity: number }>;
}

// ─── WebSocket messages ───────────────────────────────────────────────────────

export type WsMessageType = 'tick' | 'signal' | 'order' | 'position' | 'bot_status' | 'error';

export interface WsMessage {
  type: WsMessageType;
  botId?: string;
  payload: unknown;
  timestamp: number;
}
