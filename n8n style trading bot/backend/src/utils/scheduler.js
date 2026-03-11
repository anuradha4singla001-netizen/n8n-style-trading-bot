/**
 * Scheduler – cron-based strategy execution heartbeat
 */
const cron = require("node-cron");
const Store = require("../models/store");
const { runStrategy } = require("../engine/strategyEngine");
const { getMarketSnapshot } = require("../services/market.service");
const { getClientCount } = require("../services/websocket.service");

function scheduleHealthCheck() {
  // Every minute: run all enabled strategies
  cron.schedule("* * * * *", async () => {
    const strategies = Store.getStrategies().filter(s => s.enabled);
    if (strategies.length === 0) return;

    console.log(`[Scheduler] Evaluating ${strategies.length} active strategy/strategies`);
    const snapshot = getMarketSnapshot();

    for (const strategy of strategies) {
      try {
        await runStrategy(strategy, snapshot);
      } catch (err) {
        console.error(`[Scheduler] Error running strategy ${strategy.id}:`, err.message);
      }
    }
  });

  // Every 10 seconds: log WS client count
  cron.schedule("*/10 * * * * *", () => {
    const count = getClientCount();
    if (count > 0) console.log(`[WS] ${count} client(s) connected`);
  });

  console.log("[Scheduler] Cron jobs registered");
}

module.exports = { scheduleHealthCheck };
