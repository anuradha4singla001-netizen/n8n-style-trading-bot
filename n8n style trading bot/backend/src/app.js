/**
 * Express Application Setup
 * Middleware, routes, error handling
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const strategyRoutes = require("./routes/strategy.routes");
const orderRoutes = require("./routes/order.routes");
const { portfolioRouter, marketRouter } = require("./routes/order.routes");
const { errorHandler } = require("./utils/errorHandler");

const app = express();

/* ── Security & Middleware ── */
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

/* ── Rate Limiting ── */
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 120,              // 120 req/min per IP
  message: { error: "Too many requests, slow down." },
});
app.use("/api", limiter);

/* ── Routes ── */
app.use("/api/v1/strategies", strategyRoutes);
app.use("/api/v1/orders",     orderRoutes);
app.use("/api/v1/portfolio",  portfolioRouter);
app.use("/api/v1/market",     marketRouter);

/* ── Health check ── */
app.get("/health", (req, res) =>
  res.json({ status: "ok", uptime: process.uptime(), ts: Date.now() })
);

/* ── 404 ── */
app.use((req, res) =>
  res.status(404).json({ error: "Route not found" })
);

/* ── Global error handler ── */
app.use(errorHandler);

module.exports = app;
