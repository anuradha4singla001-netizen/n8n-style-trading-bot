/**
 * TradeFlow Backend — entry point
 *
 * Starts:
 *   1. Express REST API on PORT (default 3001)
 *   2. WebSocket server on WS_PORT (default 3002)
 *      Broadcasts: tick, signal, order, position, bot_status events
 */
import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { router } from './api/routes';
import { marketFeed } from './data/marketData';
import { botRegistry } from './engine/botRegistry';
import { logger } from './utils/logger';
import type { WsMessage } from './types';
import fs from 'fs';

// Ensure log dir exists
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

const PORT    = Number(process.env.PORT ?? 3001);
const WS_PORT = Number(process.env.WS_PORT ?? 3002);

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', router);

const httpServer = http.createServer(app);

// ── WebSocket ─────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: WS_PORT });

function broadcast(msg: WsMessage): void {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

// Broadcast all market ticks
marketFeed.on('tick', tick => {
  broadcast({ type: 'tick', payload: tick, timestamp: Date.now() });
});

// When a bot is created, wire its events to WS broadcast
const originalCreate = botRegistry.create.bind(botRegistry);
(botRegistry as any).create = async (config: any) => {
  const engine = await originalCreate(config);
  engine.on('signal',          s  => broadcast({ type: 'signal',     botId: engine.id, payload: s,  timestamp: Date.now() }));
  engine.on('order',           o  => broadcast({ type: 'order',      botId: engine.id, payload: o,  timestamp: Date.now() }));
  engine.on('position',        p  => broadcast({ type: 'position',   botId: engine.id, payload: p,  timestamp: Date.now() }));
  engine.on('status',          s  => broadcast({ type: 'bot_status', botId: engine.id, payload: s,  timestamp: Date.now() }));
  return engine;
};

wss.on('connection', ws => {
  logger.info('WebSocket: client connected');
  // Send current bot states on connect
  ws.send(JSON.stringify({ type: 'bot_status', payload: botRegistry.list(), timestamp: Date.now() }));
  ws.on('close', () => logger.info('WebSocket: client disconnected'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  logger.info(`REST API   → http://localhost:${PORT}/api`);
  logger.info(`WebSocket  → ws://localhost:${WS_PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  logger.info(`Paper trading: ${process.env.PAPER_TRADING !== 'false' ? 'ON' : 'OFF'}`);
});

process.on('SIGTERM', () => { logger.info('SIGTERM received, shutting down'); marketFeed.stop(); process.exit(0); });
process.on('SIGINT',  () => { logger.info('SIGINT received, shutting down');  marketFeed.stop(); process.exit(0); });
