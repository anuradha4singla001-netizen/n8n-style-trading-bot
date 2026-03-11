/**
 * Global State Store  (Zustand)
 * ──────────────────────────────
 * Single source of truth for the entire frontend.
 * All WebSocket events update this store.
 */

import { create } from "zustand";

const API = "http://localhost:4000/api/v1";
const WS_URL = "ws://localhost:4000/ws";

export const useStore = create((set, get) => ({
  /* ── Market ── */
  prices: { BTC: 64821, ETH: 3412, SOL: 182.4, BNB: 420 },
  prevPrices: {},
  candles: {},
  indicators: {},

  /* ── Strategies ── */
  strategies: [],
  activeStrategy: null,
  executionLog: [],

  /* ── Orders & Portfolio ── */
  orders: [],
  portfolio: { balance: 50000, equity: 50000, pnl: 0, positions: {} },

  /* ── UI ── */
  wsStatus: "disconnected",  // connected | disconnected | error
  loading: {},
  error: null,

  /* ── WebSocket ── */
  ws: null,

  connectWS: () => {
    const existing = get().ws;
    if (existing) existing.close();

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      set({ wsStatus: "connected" });
      ws.send(JSON.stringify({ type: "subscribe", channels: ["market", "executions", "orders"] }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        get()._handleWSMessage(msg);
      } catch {}
    };

    ws.onclose = () => set({ wsStatus: "disconnected" });
    ws.onerror = () => set({ wsStatus: "error" });

    set({ ws });
  },

  _handleWSMessage: (msg) => {
    switch (msg.type) {
      case "market:tick": {
        const { candles, prices } = msg.data;
        set(s => ({
          prevPrices: { ...s.prices },
          prices: { ...s.prices, ...prices },
          candles: candles.reduce((acc, c) => {
            const history = (s.candles[c.asset] || []).slice(-199);
            return { ...acc, [c.asset]: [...history, c] };
          }, s.candles),
        }));
        break;
      }
      case "execution:result":
        set(s => ({ executionLog: [msg.data, ...s.executionLog].slice(0, 100) }));
        break;
      case "order:filled":
        set(s => ({ orders: [msg.data, ...s.orders].slice(0, 200) }));
        get().fetchPortfolio();
        break;
    }
  },

  /* ── API calls ── */
  fetchStrategies: async () => {
    set(s => ({ loading: { ...s.loading, strategies: true } }));
    try {
      const res = await fetch(`${API}/strategies`);
      const data = await res.json();
      set({ strategies: data.strategies });
    } catch (e) {
      set({ error: e.message });
    } finally {
      set(s => ({ loading: { ...s.loading, strategies: false } }));
    }
  },

  saveStrategy: async (strategy) => {
    const method = strategy.id ? "PATCH" : "POST";
    const url = strategy.id ? `${API}/strategies/${strategy.id}` : `${API}/strategies`;
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(strategy),
    });
    const saved = await res.json();
    set(s => ({
      strategies: strategy.id
        ? s.strategies.map(x => x.id === saved.id ? saved : x)
        : [...s.strategies, saved],
    }));
    return saved;
  },

  deleteStrategy: async (id) => {
    await fetch(`${API}/strategies/${id}`, { method: "DELETE" });
    set(s => ({ strategies: s.strategies.filter(x => x.id !== id) }));
  },

  runStrategy: async (id) => {
    set(s => ({ loading: { ...s.loading, [`run_${id}`]: true } }));
    try {
      const res = await fetch(`${API}/strategies/${id}/run`, { method: "POST" });
      return await res.json();
    } finally {
      set(s => ({ loading: { ...s.loading, [`run_${id}`]: false } }));
    }
  },

  toggleStrategy: async (id) => {
    const res = await fetch(`${API}/strategies/${id}/toggle`, { method: "POST" });
    const updated = await res.json();
    set(s => ({ strategies: s.strategies.map(x => x.id === updated.id ? updated : x) }));
  },

  fetchOrders: async () => {
    const res = await fetch(`${API}/orders`);
    const data = await res.json();
    set({ orders: data.orders });
  },

  placeOrder: async (order) => {
    const res = await fetch(`${API}/orders`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order),
    });
    return await res.json();
  },

  fetchPortfolio: async () => {
    const res = await fetch(`${API}/portfolio`);
    const data = await res.json();
    set({ portfolio: data });
  },

  fetchIndicators: async (asset) => {
    const res = await fetch(`${API}/market/indicators/${asset}`);
    const data = await res.json();
    set(s => ({ indicators: { ...s.indicators, [asset]: data } }));
  },

  setActiveStrategy: (s) => set({ activeStrategy: s }),
}));
