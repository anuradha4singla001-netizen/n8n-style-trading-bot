
**TradeFlow**

A browser-based algorithmic trading platform where you design strategies visually as node graphs and a backend engine executes them against live market data in real time. Built this to go deeper on both financial engineering and full-stack architecture — ended up being one of the more technically interesting projects I've worked on.


---

**What it does**

You drag nodes onto a canvas — triggers, indicators, conditions, actions, alerts — connect them together, and hit run. The backend walks the graph, evaluates each node against the current market snapshot, and either fires a trade or short-circuits the branch if a condition fails. Everything happens over WebSocket so the frontend lights up in real time as each node passes or fails.

It runs in paper trading mode, meaning real financial math but no real money. Positions, P&L, and order history all update live.

---

**The parts I'm most proud of**

The strategy execution engine builds an adjacency list from your node graph and walks it depth-first. If a trigger condition isn't met the whole strategy halts. If a condition node fails, that branch short-circuits and nothing downstream fires. It sounds simple but getting the graph traversal and context-sharing between nodes right took a few iterations.

The indicators library is pure functions, no dependencies. RSI uses Wilder's smoothing method rather than a simple moving average — most implementations get this wrong and it produces meaningfully different values, especially near the extremes. The MACD histogram identity (line minus signal) is verified in unit tests. Also implemented EMA, Bollinger Bands, ATR, VWAP, and Stochastic.

Market data uses Geometric Brownian Motion with a Box-Muller Gaussian draw per tick, which is the same stochastic model underlying Black-Scholes. Configurable volatility and drift per asset. The whole thing is swappable — replace one function with a Binance WebSocket stream and nothing else in the codebase changes.

The store layer is intentionally a thin interface of named methods so the rest of the app never touches the underlying data structure directly. Swapping in Postgres means rewriting method bodies, nothing else.

---

**Stack**

Node.js, Express, WebSocket (ws), node-cron — backend
React 18, Vite, Zustand, Recharts — frontend
Jest for the indicators library

---

**Running it**

```
npm run install:all
npm run dev
```

Frontend at localhost:5173, API at localhost:4000/api/v1, WebSocket at localhost:4000/ws.

```
cd backend && npm test
```

---

**API**

`GET /api/v1/strategies` — list strategies  
`POST /api/v1/strategies` — create  
`POST /api/v1/strategies/:id/run` — execute now  
`POST /api/v1/strategies/:id/toggle` — enable / disable  
`GET /api/v1/portfolio` — positions and live P&L  
`GET /api/v1/market/indicators/:asset` — RSI, MACD, EMA, Bollinger Bands  
Full list in `backend/src/routes/`

---
**If I kept going**

Connect a live exchange feed (Binance stream is a one-function swap). Add Postgres — the store layer is already designed for it. Backtesting against historical data. Position sizing and risk management as node types.
