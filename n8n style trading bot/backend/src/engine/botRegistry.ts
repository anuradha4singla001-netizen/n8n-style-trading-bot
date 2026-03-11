/**
 * BotRegistry — manages all running bot instances.
 * Singleton accessed throughout the app.
 */
import { BotEngine } from './botEngine';
import type { BotConfig, BotState } from '../types';
import { logger } from '../utils/logger';

class BotRegistry {
  private bots = new Map<string, BotEngine>();

  async create(config: BotConfig): Promise<BotEngine> {
    const engine = new BotEngine(config);
    this.bots.set(engine.id, engine);
    logger.info(`BotRegistry: created bot ${engine.id} (${config.name})`);
    await engine.start();
    return engine;
  }

  get(id: string): BotEngine | undefined {
    return this.bots.get(id);
  }

  list(): BotState[] {
    return Array.from(this.bots.values()).map(b => b.getState());
  }

  stop(id: string): boolean {
    const engine = this.bots.get(id);
    if (!engine) return false;
    engine.stop();
    return true;
  }

  delete(id: string): boolean {
    this.stop(id);
    return this.bots.delete(id);
  }
}

export const botRegistry = new BotRegistry();
