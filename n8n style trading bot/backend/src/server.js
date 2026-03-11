/**
 * TradeFlow – Main Server Entry Point
 * Express + WebSocket server with strategy engine
 */

require("dotenv").config();
const http = require("http");
const app = require("./app");
const { initWebSocketServer } = require("./services/websocket.service");
const { startMarketSimulator } = require("./services/market.service");
const { scheduleHealthCheck } = require("./utils/scheduler");

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

// Attach WebSocket server to the same HTTP server
const wss = initWebSocketServer(server);

// Start simulated market data feed
startMarketSimulator(wss);

// Cron-based health check / strategy heartbeat
scheduleHealthCheck();

server.listen(PORT, () => {
  console.log(`\n🚀 TradeFlow Backend running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`📊 REST API base:      http://localhost:${PORT}/api/v1\n`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received – shutting down gracefully");
  server.close(() => process.exit(0));
});
