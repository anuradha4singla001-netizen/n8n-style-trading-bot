/**
 * Technical indicator calculations.
 * Wraps the `technicalindicators` library with clean typed APIs.
 */
import TI from 'technicalindicators';
import type { IndicatorResult } from '../types';

export function calcRSI(closes: number[], period = 14): IndicatorResult {
  const values = TI.RSI.calculate({ values: closes, period });
  return { name: `RSI(${period})`, value: values.at(-1) ?? null };
}

export function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9): IndicatorResult {
  const results = TI.MACD.calculate({ values: closes, fastPeriod: fast, slowPeriod: slow, signalPeriod: signal, SimpleMAOscillator: false, SimpleMASignal: false });
  const last = results.at(-1);
  return {
    name: `MACD(${fast},${slow},${signal})`,
    value: last?.MACD ?? null,
    values: { macd: last?.MACD ?? null, signal: last?.signal ?? null, histogram: last?.histogram ?? null },
  };
}

export function calcBollingerBands(closes: number[], period = 20, stdDev = 2): IndicatorResult {
  const results = TI.BollingerBands.calculate({ values: closes, period, stdDev });
  const last = results.at(-1);
  return {
    name: `BB(${period},${stdDev})`,
    value: last?.middle ?? null,
    values: { upper: last?.upper ?? null, middle: last?.middle ?? null, lower: last?.lower ?? null },
  };
}

export function calcEMA(closes: number[], period: number): IndicatorResult {
  const values = TI.EMA.calculate({ values: closes, period });
  return { name: `EMA(${period})`, value: values.at(-1) ?? null };
}

export function calcATR(candles: Array<{ high: number; low: number; close: number }>, period = 14): IndicatorResult {
  const values = TI.ATR.calculate({ high: candles.map(c => c.high), low: candles.map(c => c.low), close: candles.map(c => c.close), period });
  return { name: `ATR(${period})`, value: values.at(-1) ?? null };
}

export function calcSMA(closes: number[], period: number): IndicatorResult {
  const values = TI.SMA.calculate({ values: closes, period });
  return { name: `SMA(${period})`, value: values.at(-1) ?? null };
}
