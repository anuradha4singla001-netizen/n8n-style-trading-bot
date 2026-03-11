export const NODE_TYPES = {
  trigger:   { label: 'Trigger',   color: '#f0b429', dim: '#2d1e04', icon: '◈', glyph: 'TRG' },
  condition: { label: 'Condition', color: '#3d9eff', dim: '#0a2444', icon: '⬡', glyph: 'CND' },
  indicator: { label: 'Indicator', color: '#a78bfa', dim: '#1e1040', icon: '◎', glyph: 'IND' },
  action:    { label: 'Action',    color: '#00e5a0', dim: '#003d28', icon: '▶', glyph: 'ACT' },
  alert:     { label: 'Alert',     color: '#ff4d6a', dim: '#3d0010', icon: '◉', glyph: 'ALT' },
} as const;

export const PRESETS: Record<string, string[]> = {
  trigger:   ['Price crosses above','Price crosses below','Volume spike detected','Time interval','Market open/close'],
  condition: ['RSI > 70 overbought','RSI < 30 oversold','MACD bullish cross','Price above EMA 50','Bollinger squeeze'],
  indicator: ['RSI (14 period)','MACD (12,26,9)','EMA 50 / EMA 200','Bollinger Bands (20,2)','ATR Volatility'],
  action:    ['Buy Market Order','Sell Market Order','Buy Limit Order','Close All Positions','Scale In / DCA'],
  alert:     ['Send Email','Telegram Message','Discord Webhook','Push Notification','REST API Callback'],
};

export const DEFAULT_STRATEGY = {
  type: 'rsi' as const, pair: 'BTC/USDT', interval: '5m' as const,
  params: { period: 14, oversold: 30, overbought: 70 },
  risk: { maxPositionSizePct: 0.02, stopLossPct: 0.015, takeProfitPct: 0.03,
          maxDrawdownPct: 0.1, maxOpenPositions: 3, maxDailyLossPct: 0.05 },
};

export const NW = 200;
export const NH = 78;
