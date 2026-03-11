/**
 * In-Memory Store
 * ───────────────
 * Acts as the database layer. Replace each Map/array
 * with a real DB adapter (Postgres, MongoDB, Redis)
 * without changing any business logic above this file.
 */

const { v4: uuidv4 } = require("uuid");

/* ── Seed data ── */
const strategies = new Map([
  ["strat-001", {
    id: "strat-001",
    name: "RSI Oversold Bounce",
    description: "Buy when RSI dips below 30, sell when it recovers above 60",
    enabled: false,
    assets: ["BTC/USDT"],
    nodes: [
      { id: "n1", type: "trigger",   label: "Price crosses above",   config: { asset: "BTC/USDT", value: 65000 } },
      { id: "n2", type: "indicator", label: "RSI (14 period)",        config: { period: 14 } },
      { id: "n3", type: "condition", label: "RSI < 30 oversold",      config: { indicator: "RSI", op: "<", threshold: 30 } },
      { id: "n4", type: "action",    label: "Buy Market Order",       config: { asset: "BTC", amount: 0.05, side: "BUY" } },
      { id: "n5", type: "alert",     label: "Telegram Message",       config: { chat: "@mybot" } },
    ],
    edges: [
      { from: "n1", to: "n2" }, { from: "n1", to: "n3" },
      { from: "n2", to: "n4" }, { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
    ],
    createdAt: new Date("2024-01-15").toISOString(),
    updatedAt: new Date().toISOString(),
    runCount: 12,
    lastRun: new Date(Date.now() - 3600_000).toISOString(),
  }],
]);

const orders = new Map();
const portfolio = {
  balance: 50000,     // USDT
  positions: {
    BTC: { qty: 0.45, avgPrice: 61200 },
    ETH: { qty: 3.2,  avgPrice: 3050  },
    SOL: { qty: 18,   avgPrice: 165   },
  },
  equity: 0,           // computed on read
  pnl: 0,
};

/* ── Helpers ── */
const Store = {
  /* Strategies */
  getStrategies: () => [...strategies.values()],
  getStrategy: (id) => strategies.get(id) || null,
  createStrategy: (data) => {
    const s = { id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), enabled: false, runCount: 0, lastRun: null, ...data };
    strategies.set(s.id, s);
    return s;
  },
  updateStrategy: (id, patch) => {
    const s = strategies.get(id);
    if (!s) return null;
    const updated = { ...s, ...patch, id, updatedAt: new Date().toISOString() };
    strategies.set(id, updated);
    return updated;
  },
  deleteStrategy: (id) => strategies.delete(id),

  /* Orders */
  getOrders: (limit = 50) => [...orders.values()].slice(-limit).reverse(),
  getOrder: (id) => orders.get(id) || null,
  createOrder: (data) => {
    const o = { id: uuidv4(), createdAt: new Date().toISOString(), status: "PENDING", ...data };
    orders.set(o.id, o);
    return o;
  },
  updateOrder: (id, patch) => {
    const o = orders.get(id);
    if (!o) return null;
    const updated = { ...o, ...patch };
    orders.set(id, updated);
    return updated;
  },

  /* Portfolio */
  getPortfolio: (prices = {}) => {
    let equity = portfolio.balance;
    const positions = {};
    for (const [sym, pos] of Object.entries(portfolio.positions)) {
      const price = prices[sym] || pos.avgPrice;
      const value = pos.qty * price;
      const pnl = (price - pos.avgPrice) * pos.qty;
      equity += value;
      positions[sym] = { ...pos, currentPrice: price, value, pnl };
    }
    return { ...portfolio, equity, positions, pnl: equity - 50000 };
  },
  applyFill: (symbol, side, qty, price) => {
    const base = symbol.replace("/USDT", "");
    if (side === "BUY") {
      const cost = qty * price;
      portfolio.balance -= cost;
      const existing = portfolio.positions[base] || { qty: 0, avgPrice: 0 };
      const totalQty = existing.qty + qty;
      portfolio.positions[base] = {
        qty: totalQty,
        avgPrice: ((existing.qty * existing.avgPrice) + (qty * price)) / totalQty,
      };
    } else {
      portfolio.balance += qty * price;
      const existing = portfolio.positions[base];
      if (existing) existing.qty = Math.max(0, existing.qty - qty);
    }
  },
};

module.exports = Store;
