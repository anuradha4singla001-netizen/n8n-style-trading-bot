/**
 * Base class for all trading strategies.
 * Each strategy receives a buffer of candles and emits a Signal.
 */
import type { Candle, StrategySignal, StrategyConfig } from '../types';

export abstract class BaseStrategy {
  protected config: StrategyConfig;
  protected candleBuffer: Candle[] = [];
  protected readonly BUFFER_SIZE = 300;

  constructor(config: StrategyConfig) {
    this.config = config;
  }

  /** Add a candle; returns a signal once we have enough data */
  addCandle(candle: Candle): StrategySignal | null {
    this.candleBuffer.push(candle);
    if (this.candleBuffer.length > this.BUFFER_SIZE) {
      this.candleBuffer.shift();
    }
    if (this.candleBuffer.length < this.minCandles()) return null;
    return this.evaluate(this.candleBuffer);
  }

  abstract evaluate(candles: Candle[]): StrategySignal;
  abstract minCandles(): number;

  protected closes(): number[] {
    return this.candleBuffer.map(c => c.close);
  }
}
