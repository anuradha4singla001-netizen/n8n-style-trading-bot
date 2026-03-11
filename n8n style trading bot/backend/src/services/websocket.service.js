/**
 * WebSocket Service
 * ─────────────────
 * Manages all real-time connections and event broadcasting.
 * Clients subscribe to channels: market, executions, orders, portfolio
 */

const { WebSocketServer, WebSocket } = require("ws");

let wss = null;
const clients = new Set();

function initWebSocketServer(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    clients.add(ws);
    const ip = req.socket.remoteAddress;
    console.log(`[WS] Client connected: ${ip} (total: ${clients.size})`);

    // Send welcome + current state
    send(ws, "connected", {
      message: "TradeFlow WebSocket connected",
      channels: ["market", "executions", "orders", "portfolio"],
      serverTime: Date.now(),
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleClientMessage(ws, msg);
      } catch {
        send(ws, "error", { message: "Invalid JSON" });
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (total: ${clients.size})`);
    });

    ws.on("error", (err) => {
      console.error("[WS] Error:", err.message);
      clients.delete(ws);
    });
  });

  // Ping/pong heartbeat every 30s
  setInterval(() => {
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    });
  }, 30_000);

  return wss;
}

function handleClientMessage(ws, msg) {
  switch (msg.type) {
    case "ping":
      send(ws, "pong", { ts: Date.now() });
      break;
    case "subscribe":
      ws.channels = msg.channels || [];
      send(ws, "subscribed", { channels: ws.channels });
      break;
    default:
      send(ws, "error", { message: `Unknown message type: ${msg.type}` });
  }
}

/** Broadcast an event to all connected clients */
function broadcastEvent(type, data) {
  const payload = JSON.stringify({ type, data, ts: Date.now() });
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

/** Send to a single client */
function send(ws, type, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data, ts: Date.now() }));
  }
}

function getClientCount() {
  return clients.size;
}

module.exports = { initWebSocketServer, broadcastEvent, send, getClientCount };
