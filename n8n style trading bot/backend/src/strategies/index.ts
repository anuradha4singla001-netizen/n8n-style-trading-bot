import type { StrategyConfig } from '../types';
import { BaseStrategy } from './baseStrategy';
import { RSIStrategy } from './rsiStrategy';
import { MACDStrategy } from './macdStrategy';
import { BollingerStrategy } from './bollingerStrategy';

export function createStrategy(config: StrategyConfig): BaseStrategy {
  switch (config.type) {
    case 'rsi':       return new RSIStrategy(config);
    case 'macd':      return new MACDStrategy(config);
    case 'bollinger': return new BollingerStrategy(config);
    default:          return new RSIStrategy(config);
  }
}

export { BaseStrategy, RSIStrategy, MACDStrategy, BollingerStrategy };
