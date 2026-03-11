
TradeFlow is a visual algorithmic trading bot builder. You design strategies as node graphs in the browser, connect the nodes together, and the backend engine evaluates them against live simulated market data. The idea is that instead of writing a trading script from scratch every time you want to try a new strategy, you wire up a flow — trigger, indicator, condition, action, alert — and the engine handles the logic of walking that graph and deciding what fires.

The backend is Node.js with Express. There's a WebSocket server sitting on the same HTTP server that pushes market ticks to the frontend every two seconds. Prices are generated using Geometric Brownian Motion, which is the standard stochastic model from quantitative finance — it's the same math you'd find in Black-Scholes. Each tick produces a full OHLCV candle per asset. When you're ready to connect a real exchange like Binance or Coinbase, you just replace that simulator with their WebSocket feed and nothing else changes.

The strategy execution engine is the most interesting part. It takes your node graph, builds an adjacency list from the edge definitions, and walks it depth-first from the trigger nodes. Every node type has its own evaluator. If a trigger condition isn't met, traversal stops — nothing downstream fires. If a condition node checks RSI and it doesn't pass the threshold, that branch short-circuits. Action nodes create paper orders and update the portfolio. The whole execution trace gets sent back over WebSocket so the frontend can light up each node green or red.

The indicators library is a set of pure functions with no dependencies. RSI uses Wilder's smoothing method, not a simple moving average — there's a meaningful difference and most amateur implementations get it wrong. MACD builds proper EMA series and the histogram is always exactly line minus signal, which is verified in the unit tests. Bollinger Bands return upper, lower, middle, bandwidth, and %B. There's also EMA, SMA, ATR, VWAP, and Stochastic. Everything is tested with Jest.

The store layer is intentionally thin. It's just a Map with named methods — getStrategy, createOrder, applyFill, and so on. Nothing in the routes or engine touches the Map directly. If you want to swap in Postgres or MongoDB you replace the method bodies and that's it, the rest of the codebase doesn't care.

On the frontend, state is managed with Zustand. There's one store that's the source of truth for everything — prices, strategies, orders, portfolio, WebSocket status. All the WebSocket events from the backend flow into a single handler that updates the relevant slice. Components are thin. The FlowCanvas is an SVG-based editor, nodes and edges are native SVG so they render crisp at any size. You can drag nodes, pan the canvas, double-click to configure a node, and hit Delete to remove the selected one.

The CSS is split into three files. global.css has all the design tokens as CSS custom properties — colors, spacing, radius, fonts, transitions. canvas.css is specific to the flow editor. layout.css covers the app shell and all the reusable component patterns. No CSS-in-JS, no utility framework, just organized vanilla CSS.

To run it, you need Node 18 and npm 9. Clone the repo, run `npm run install:all`, then `npm run dev`. That spins up both the backend on port 4000 and the frontend on 5173 concurrently. There's a proxy in the Vite config so API calls and WebSocket connections from the frontend route through without any CORS issues in development.

The REST API has endpoints for creating, updating, deleting, and running strategies, placing manual paper trades, reading order history, checking the portfolio, and fetching indicator values for any asset. Full list is in the routes file.

The project is paper trading only right now — no real money, no exchange API keys needed. The architecture is designed so adding live trading is a contained change: swap the market simulator for a real feed, add exchange credentials to the env file, and change the order execution in the action node evaluator to call the exchange API instead of the in-memory store.


tradeflow/
├── backend/
│   ├── src/
│   │   ├── server.js                   # HTTP + WS server entry
│   │   ├── app.js                      # Express app + middleware
│   │   ├── engine/
│   │   │   ├── strategyEngine.js       # Graph execution engine
│   │   │   └── indicators.js           # RSI, MACD, EMA, BB, ATR, VWAP
│   │   ├── services/
│   │   │   ├── websocket.service.js    # Real-time event bus
│   │   │   └── market.service.js       # GBM price simulator
│   │   ├── routes/strategy.routes.js   # REST API
│   │   ├── models/store.js             # In-memory store (swap → Postgres)
│   │   └── utils/
│   │       ├── errorHandler.js
│   │       └── scheduler.js            # Cron heartbeat
│   └── tests/indicators.test.js        # Jest unit tests
│
└── frontend/
    └── src/
        ├── App.jsx                     # Root: Builder / Dashboard / Orders / Portfolio tabs
        ├── components/FlowCanvas.jsx   # SVG node-graph editor
        ├── store/useStore.js           # Zustand state + API layer
        ├── hooks/useWebSocket.js       # Auto-reconnecting WS hook
        └── styles/
            ├── global.css              # Design tokens + utilities
            ├── canvas.css              # Flow canvas
            └── layout.css              # Shell, topbar, sidebar
```

## Quick Start

```bash
npm run install:all
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:4000/api/v1
# WS:       ws://localhost:4000/ws
```

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/strategies | List strategies |
| POST | /api/v1/strategies | Create strategy |
| POST | /api/v1/strategies/:id/run | Run strategy now |
| POST | /api/v1/strategies/:id/toggle | Enable / disable |
| GET | /api/v1/orders | Order history |
| GET | /api/v1/portfolio | Live P&L |
| GET | /api/v1/market/indicators/:asset | RSI, MACD, EMA, BB |

## Tech Stack
- **Backend**: Node.js, Express, ws, node-cron
- **Frontend**: React 18, Vite, Zustand, Recharts
- **Testing**: Jest

## License
MIT
