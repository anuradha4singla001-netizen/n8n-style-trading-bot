/**
 * Market Simulator Service
 * ────────────────────────
 * Generates realistic price data using geometric Brownian motion.
 * In production, swap this for a real exchange WebSocket feed
 * (Binance, Coinbase, Kraken) with the same broadcastEvent interface.
 */

const { broadcastEvent } = require("./websocket.service");

/* ── State ── */
const state = {
  BTC: { price: 64821, volatility: 0.012, trend: 0.0001 },
  ETH: { price: 3412,  volatility: 0.015, trend: 0.0001 },
  SOL: { price: 182.4, volatility: 0.022, trend: 0.0002 },
  BNB: { price: 420,   volatility: 0.014, trend: 0.0001 },
};

// Rolling price history (last 200 candles per asset)
const priceHistory = {
  BTC: generateHistory(64821, 200, 0.012),
  ETH: generateHistory(3412,  200, 0.015),
  SOL: generateHistory(182.4, 200, 0.022),
  BNB: generateHistory(420,   200, 0.014),
};

const volumeHistory = {
  BTC: Array.from({ length: 200 }, () => 800 + Math.random() * 400),
  ETH: Array.from({ length: 200 }, () => 5000 + Math.random() * 2000),
  SOL: Array.from({ length: 200 }, () => 20000 + Math.random() * 10000),
  BNB: Array.from({ length: 200 }, () => 3000 + Math.random() * 1500),
};

function generateHistory(basePrice, length, vol) {
  const prices = [basePrice];
  for (let i = 1; i < length; i++) {
    const ret = (Math.random() - 0.5) * vol * 2;
    prices.push(Math.max(prices[i - 1] * (1 + ret), 1));
  }
  return prices;
}

/* ── GBM price step ── */
function nextPrice(asset) {
  const s = state[asset];
  const dt = 1 / (365 * 24 * 60); // 1 minute in years
  const shock = gaussianRandom() * s.volatility * Math.sqrt(dt);
  const drift = (s.trend - 0.5 * s.volatility ** 2) * dt;
  s.price = s.price * Math.exp(drift + shock);
  return s.price;
}

/* Box–Muller transform for Gaussian random */
function gaussianRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/* Build a full candle for an asset */
function buildCandle(asset) {
  const close = nextPrice(asset);
  const open = state[asset].prevClose || close * (1 + (Math.random() - 0.5) * 0.002);
  const high = Math.max(open, close) * (1 + Math.random() * 0.003);
  const low  = Math.min(open, close) * (1 - Math.random() * 0.003);
  const volume = volumeHistory[asset].slice(-1)[0] * (0.8 + Math.random() * 0.4);

  state[asset].prevClose = close;

  // Append to history
  priceHistory[asset].push(close);
  if (priceHistory[asset].length > 500) priceHistory[asset].shift();
  volumeHistory[asset].push(volume);
  if (volumeHistory[asset].length > 500) volumeHistory[asset].shift();

  return { asset, open, high, low, close, volume, ts: Date.now() };
}

/** Called by the strategy engine to get a market snapshot */
function getMarketSnapshot() {
  const prices = {};
  const avgVols = {};
  for (const asset of Object.keys(state)) {
    prices[asset] = state[asset].price;
    const vols = volumeHistory[asset];
    avgVols[asset] = vols.reduce((a, b) => a + b, 0) / vols.length;
  }
  return {
    prices,
    priceHistory: priceHistory.BTC, // default to BTC for single-asset indicators
    priceHistories: { ...priceHistory },
    volume: volumeHistory.BTC.slice(-1)[0],
    avgVolume: avgVols.BTC,
    timestamp: Date.now(),
  };
}

/** Start the market feed – emits candles every 2s via WebSocket */
function startMarketSimulator(wss) {
  console.log("[Market] Simulator started – emitting candles every 2s");

  setInterval(() => {
    const candles = Object.keys(state).map(buildCandle);
    const snapshot = {
      type: "market:tick",
      candles,
      prices: Object.fromEntries(candles.map(c => [c.asset, c.close])),
      ts: Date.now(),
    };
    broadcastEvent("market:tick", snapshot);
  }, 2000);
}

module.exports = { startMarketSimulator, getMarketSnapshot, priceHistory, state };
