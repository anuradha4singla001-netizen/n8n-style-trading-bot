/**
 * REST API routes
 *
 * POST   /api/bots           Create and start a bot
 * GET    /api/bots           List all bots
 * GET    /api/bots/:id       Get bot state
 * DELETE /api/bots/:id       Stop and remove a bot
 * POST   /api/backtest       Run a backtest
 * GET    /api/market/:pair   Get current price + recent candles
 */
import { Router, Request, Response } from 'express';
import { botRegistry } from '../engine/botRegistry';
import { runBacktest } from '../engine/backtester';
import { generateHistoricalCandles, marketFeed } from '../data/marketData';
import type { BotConfig, BacktestRequest } from '../types';
import { logger } from '../utils/logger';

export const router = Router();

// ── Bots ──────────────────────────────────────────────────────────────────────

router.post('/bots', async (req: Request, res: Response) => {
  try {
    const config = req.body as BotConfig;
    if (!config?.name || !config?.strategy) {
      res.status(400).json({ error: 'Missing required fields: name, strategy' });
      return;
    }
    // Defaults for risk if not provided
    config.strategy.risk = {
      maxPositionSizePct: 0.02,
      stopLossPct: 0.015,
      takeProfitPct: 0.03,
      maxDrawdownPct: 0.1,
      maxOpenPositions: 3,
      maxDailyLossPct: 0.05,
      ...config.strategy.risk,
    };
    const bot = await botRegistry.create(config);
    res.status(201).json({ id: bot.id, state: bot.getState() });
  } catch (err) {
    logger.error('POST /api/bots failed', { err });
    res.status(500).json({ error: String(err) });
  }
});

router.get('/bots', (_req: Request, res: Response) => {
  res.json(botRegistry.list());
});

router.get('/bots/:id', (req: Request, res: Response) => {
  const bot = botRegistry.get(req.params.id);
  if (!bot) { res.status(404).json({ error: 'Bot not found' }); return; }
  res.json(bot.getState());
});

router.delete('/bots/:id', (req: Request, res: Response) => {
  const deleted = botRegistry.delete(req.params.id);
  if (!deleted) { res.status(404).json({ error: 'Bot not found' }); return; }
  res.json({ ok: true });
});

// ── Backtest ──────────────────────────────────────────────────────────────────

router.post('/backtest', async (req: Request, res: Response) => {
  try {
    const payload = req.body as BacktestRequest;
    if (!payload?.strategy) {
      res.status(400).json({ error: 'Missing strategy in request body' });
      return;
    }
    const defaults = {
      fromDate: Date.now() - 30 * 86_400_000,
      toDate: Date.now(),
      initialBalance: 10_000,
      ...payload,
    };
    defaults.strategy.risk = {
      maxPositionSizePct: 0.02,
      stopLossPct: 0.015,
      takeProfitPct: 0.03,
      maxDrawdownPct: 0.15,
      maxOpenPositions: 5,
      maxDailyLossPct: 0.05,
      ...defaults.strategy.risk,
    };
    const result = await runBacktest(defaults);
    res.json(result);
  } catch (err) {
    logger.error('POST /api/backtest failed', { err });
    res.status(500).json({ error: String(err) });
  }
});

// ── Market data ───────────────────────────────────────────────────────────────

router.get('/market/:pair', (req: Request, res: Response) => {
  const pair = decodeURIComponent(req.params.pair);
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const interval = (req.query.interval as string) || '5m';
  const intervalMs: Record<string, number> = { '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000 };
  const ms = intervalMs[interval] ?? 300_000;
  const candles = generateHistoricalCandles(pair, ms, limit);
  res.json({
    pair,
    price: marketFeed.currentPrice(pair),
    candles,
  });
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), bots: botRegistry.list().length });
});
