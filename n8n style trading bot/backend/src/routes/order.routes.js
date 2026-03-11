/**
 * Order Routes  –  /api/v1/orders
 */
const orderRouter = require("express").Router();
const { body, validationResult } = require("express-validator");
const Store = require("../models/store");
const { getMarketSnapshot } = require("../services/market.service");
const { broadcastEvent } = require("../services/websocket.service");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

/* GET /api/v1/orders */
orderRouter.get("/", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({ orders: Store.getOrders(limit) });
});

/* POST /api/v1/orders  – manual paper trade */
orderRouter.post("/",
  body("symbol").isString().notEmpty(),
  body("side").isIn(["BUY", "SELL"]),
  body("qty").isFloat({ gt: 0 }),
  validate,
  (req, res) => {
    const { symbol, side, qty, type = "MARKET" } = req.body;
    const snap = getMarketSnapshot();
    const asset = symbol.replace("/USDT", "");
    const price = snap.prices[asset] || 0;

    const order = Store.createOrder({ symbol, side, qty: Number(qty), type, price, status: "FILLED", filledAt: new Date().toISOString() });
    Store.applyFill(symbol, side, Number(qty), price);
    broadcastEvent("order:filled", order);
    res.status(201).json(order);
  }
);

module.exports = orderRouter;


/**
 * Portfolio Routes  –  /api/v1/portfolio
 */
const portfolioRouter = require("express").Router();

portfolioRouter.get("/", (req, res) => {
  const snap = getMarketSnapshot();
  res.json(Store.getPortfolio(snap.prices));
});

module.exports.portfolioRouter = portfolioRouter;


/**
 * Market Routes  –  /api/v1/market
 */
const marketRouter = require("express").Router();
const { priceHistory, state } = require("../services/market.service");
const { computeRSI, computeMACD, computeEMA, computeBollingerBands } = require("../engine/indicators");

marketRouter.get("/snapshot", (req, res) => {
  const snap = getMarketSnapshot();
  res.json({
    prices: snap.prices,
    timestamp: snap.timestamp,
  });
});

marketRouter.get("/indicators/:asset", (req, res) => {
  const asset = req.params.asset.toUpperCase();
  const prices = priceHistory[asset];
  if (!prices) return res.status(404).json({ error: "Asset not found" });

  res.json({
    asset,
    price: state[asset]?.price,
    rsi14:   computeRSI(prices, 14),
    macd:    computeMACD(prices),
    ema50:   computeEMA(prices, 50),
    ema200:  computeEMA(prices, 200),
    bb20:    computeBollingerBands(prices, 20, 2),
    priceHistory: prices.slice(-100),
    timestamp: Date.now(),
  });
});

module.exports.marketRouter = marketRouter;
