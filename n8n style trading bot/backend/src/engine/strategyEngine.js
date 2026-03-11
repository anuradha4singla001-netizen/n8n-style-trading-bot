/**
 * Strategy Execution Engine
 * ─────────────────────────
 * Evaluates a strategy's node graph against live market data.
 * Each node type has a dedicated evaluator. The engine walks
 * the graph in topological order and short-circuits on failure.
 *
 * Architecture:
 *   MarketData → TriggerNode → IndicatorNode(s) → ConditionNode(s) → ActionNode → AlertNode
 */

const { computeRSI, computeMACD, computeEMA, computeBollingerBands } = require("./indicators");
const Store = require("../models/store");
const { broadcastEvent } = require("../services/websocket.service");

/**
 * Run a full strategy against the current market snapshot.
 * Returns an ExecutionResult with per-node traces.
 */
async function runStrategy(strategy, marketSnapshot) {
  const result = {
    strategyId: strategy.id,
    strategyName: strategy.name,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    triggered: false,
    nodeResults: [],
    ordersPlaced: [],
    error: null,
  };

  try {
    // Build adjacency list for graph traversal
    const graph = buildGraph(strategy.nodes, strategy.edges);
    const startNodes = strategy.nodes.filter(n => n.type === "trigger");

    // Context shared across nodes during one evaluation pass
    const ctx = {
      market: marketSnapshot,
      indicators: {},
      signals: {},
    };

    for (const startNode of startNodes) {
      await traverseGraph(startNode, graph, ctx, strategy, result);
    }

  } catch (err) {
    result.error = err.message;
  }

  result.finishedAt = new Date().toISOString();

  // Update strategy run metadata
  Store.updateStrategy(strategy.id, {
    runCount: (strategy.runCount || 0) + 1,
    lastRun: result.startedAt,
  });

  // Broadcast execution trace via WebSocket
  broadcastEvent("execution:result", result);

  return result;
}

/* ── Graph traversal ── */
async function traverseGraph(node, graph, ctx, strategy, result) {
  const nodeResult = await evaluateNode(node, ctx, strategy);
  result.nodeResults.push(nodeResult);

  if (!nodeResult.pass) return; // short-circuit

  if (node.type === "action") {
    result.triggered = true;
    const order = await executeAction(node, ctx);
    if (order) result.ordersPlaced.push(order);
  }

  // Walk outbound edges
  const children = graph.adjacency[node.id] || [];
  for (const childId of children) {
    const childNode = graph.nodeMap[childId];
    if (childNode) await traverseGraph(childNode, graph, ctx, strategy, result);
  }
}

/* ── Node evaluators ── */
async function evaluateNode(node, ctx, strategy) {
  const base = { nodeId: node.id, type: node.type, label: node.label, pass: false, detail: "" };

  switch (node.type) {
    case "trigger":   return evaluateTrigger(node, ctx, base);
    case "indicator": return evaluateIndicator(node, ctx, base);
    case "condition": return evaluateCondition(node, ctx, base);
    case "action":    return { ...base, pass: true, detail: "Action queued" };
    case "alert":     return evaluateAlert(node, ctx, base);
    default:          return { ...base, pass: false, detail: `Unknown node type: ${node.type}` };
  }
}

function evaluateTrigger(node, ctx, base) {
  const { asset, value } = node.config;
  const price = ctx.market.prices[asset?.replace("/USDT", "")] || 0;

  if (node.label.includes("crosses above")) {
    base.pass = price > Number(value);
    base.detail = `${asset} price ${price} ${base.pass ? ">" : "<="} threshold ${value}`;
  } else if (node.label.includes("crosses below")) {
    base.pass = price < Number(value);
    base.detail = `${asset} price ${price} ${base.pass ? "<" : ">="} threshold ${value}`;
  } else if (node.label.includes("Volume spike")) {
    base.pass = ctx.market.volume > ctx.market.avgVolume * 1.5;
    base.detail = `Volume ratio: ${(ctx.market.volume / ctx.market.avgVolume).toFixed(2)}x`;
  } else if (node.label.includes("Time interval")) {
    base.pass = true; // always fires on interval
    base.detail = "Interval trigger fired";
  } else {
    base.pass = true;
    base.detail = "Generic trigger activated";
  }
  return base;
}

function evaluateIndicator(node, ctx, base) {
  const { period = 14 } = node.config;
  const prices = ctx.market.priceHistory || [];

  if (node.label.includes("RSI")) {
    const rsi = computeRSI(prices, Number(period));
    ctx.indicators.RSI = rsi;
    base.pass = rsi !== null;
    base.detail = `RSI(${period}) = ${rsi?.toFixed(2) ?? "N/A"}`;

  } else if (node.label.includes("MACD")) {
    const macd = computeMACD(prices);
    ctx.indicators.MACD = macd;
    base.pass = macd !== null;
    base.detail = `MACD line = ${macd?.line?.toFixed(4) ?? "N/A"}, Signal = ${macd?.signal?.toFixed(4) ?? "N/A"}`;

  } else if (node.label.includes("EMA")) {
    const ema = computeEMA(prices, Number(period));
    ctx.indicators[`EMA${period}`] = ema;
    base.pass = ema !== null;
    base.detail = `EMA(${period}) = ${ema?.toFixed(2) ?? "N/A"}`;

  } else if (node.label.includes("Bollinger")) {
    const bb = computeBollingerBands(prices, 20, 2);
    ctx.indicators.BB = bb;
    base.pass = bb !== null;
    base.detail = bb ? `BB upper=${bb.upper.toFixed(2)}, lower=${bb.lower.toFixed(2)}` : "Insufficient data";

  } else {
    base.pass = true;
    base.detail = "Indicator computed (generic)";
  }
  return base;
}

function evaluateCondition(node, ctx, base) {
  const { indicator = "RSI", op = "<", threshold = 30 } = node.config;
  const value = ctx.indicators[indicator];

  if (value === undefined || value === null) {
    base.pass = false;
    base.detail = `Indicator ${indicator} not yet computed`;
    return base;
  }

  const numValue = typeof value === "object" ? value.line : value;
  const numThreshold = Number(threshold);

  switch (op) {
    case "<":  base.pass = numValue < numThreshold; break;
    case ">":  base.pass = numValue > numThreshold; break;
    case "<=": base.pass = numValue <= numThreshold; break;
    case ">=": base.pass = numValue >= numThreshold; break;
    case "==": base.pass = Math.abs(numValue - numThreshold) < 0.01; break;
    default:   base.pass = false;
  }

  base.detail = `${indicator} ${numValue?.toFixed(2)} ${op} ${threshold} → ${base.pass ? "PASS" : "FAIL"}`;
  return base;
}

function evaluateAlert(node, ctx, base) {
  // In production: send email/webhook/Telegram here
  console.log(`[ALERT] ${node.label} → ${node.config.chat || node.config.to || "stdout"}`);
  base.pass = true;
  base.detail = `Alert dispatched to ${node.config.chat || node.config.to || "console"}`;
  return base;
}

/* ── Order execution ── */
async function executeAction(node, ctx) {
  const { asset = "BTC", amount = 0.01, side = "BUY" } = node.config;
  const symbol = `${asset}/USDT`;
  const price = ctx.market.prices[asset] || 0;

  const order = Store.createOrder({
    symbol,
    side: side.toUpperCase(),
    type: node.label.includes("Limit") ? "LIMIT" : "MARKET",
    qty: Number(amount),
    price,
    strategyId: null,
    status: "FILLED",
    filledAt: new Date().toISOString(),
  });

  // Update paper portfolio
  Store.applyFill(symbol, order.side, order.qty, order.price);

  broadcastEvent("order:filled", order);
  return order;
}

/* ── Graph builder ── */
function buildGraph(nodes, edges) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const adjacency = {};
  for (const n of nodes) adjacency[n.id] = [];
  for (const e of edges) {
    if (adjacency[e.from]) adjacency[e.from].push(e.to);
  }
  return { nodeMap, adjacency };
}

module.exports = { runStrategy };
