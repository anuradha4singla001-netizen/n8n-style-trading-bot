/**
 * Technical Indicators Library
 * ─────────────────────────────
 * Pure functions – no side effects, fully testable.
 * All accept a `prices` array (close prices, oldest first).
 */

/**
 * Exponential Moving Average
 */
function computeEMA(prices, period) {
  if (!prices || prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * Simple Moving Average
 */
function computeSMA(prices, period) {
  if (!prices || prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Relative Strength Index (Wilder's smoothing)
 */
function computeRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return null;

  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Initial averages
  let avgGain = changes.slice(0, period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = changes.slice(0, period).filter(c => c < 0).reduce((a, b) => a + Math.abs(b), 0) / period;

  // Wilder smoothing
  for (let i = period; i < changes.length; i++) {
    const gain = Math.max(0, changes[i]);
    const loss = Math.max(0, -changes[i]);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * MACD (Moving Average Convergence Divergence)
 * Returns { line, signal, histogram }
 */
function computeMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!prices || prices.length < slowPeriod + signalPeriod) return null;

  // Build EMA series for MACD line
  const macdSeries = [];
  for (let i = slowPeriod - 1; i < prices.length; i++) {
    const slice = prices.slice(0, i + 1);
    const fast = computeEMA(slice, fastPeriod);
    const slow = computeEMA(slice, slowPeriod);
    if (fast !== null && slow !== null) {
      macdSeries.push(fast - slow);
    }
  }

  if (macdSeries.length < signalPeriod) return null;

  const line = macdSeries[macdSeries.length - 1];
  const signal = computeEMA(macdSeries, signalPeriod);
  const histogram = signal !== null ? line - signal : null;

  return { line, signal, histogram };
}

/**
 * Bollinger Bands
 * Returns { upper, middle, lower, bandwidth, percentB }
 */
function computeBollingerBands(prices, period = 20, stdDevMultiplier = 2) {
  if (!prices || prices.length < period) return null;

  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;

  const variance = slice.reduce((acc, p) => acc + Math.pow(p - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + stdDevMultiplier * stdDev;
  const lower = middle - stdDevMultiplier * stdDev;
  const bandwidth = (upper - lower) / middle;
  const lastPrice = prices[prices.length - 1];
  const percentB = (lastPrice - lower) / (upper - lower);

  return { upper, middle, lower, stdDev, bandwidth, percentB };
}

/**
 * Average True Range
 */
function computeATR(highs, lows, closes, period = 14) {
  if (!highs || highs.length < period + 1) return null;

  const trueRanges = [];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(hl, hc, lc));
  }

  if (trueRanges.length < period) return null;

  // Initial ATR = simple average
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return atr;
}

/**
 * Volume-Weighted Average Price (VWAP)
 */
function computeVWAP(prices, volumes) {
  if (!prices || !volumes || prices.length !== volumes.length) return null;
  const totalVolume = volumes.reduce((a, b) => a + b, 0);
  if (totalVolume === 0) return null;
  const pv = prices.reduce((acc, p, i) => acc + p * volumes[i], 0);
  return pv / totalVolume;
}

/**
 * Stochastic Oscillator %K
 */
function computeStochastic(highs, lows, closes, period = 14) {
  if (!closes || closes.length < period) return null;
  const sliceH = highs.slice(-period);
  const sliceL = lows.slice(-period);
  const highestHigh = Math.max(...sliceH);
  const lowestLow   = Math.min(...sliceL);
  const close = closes[closes.length - 1];
  if (highestHigh === lowestLow) return 50;
  return ((close - lowestLow) / (highestHigh - lowestLow)) * 100;
}

module.exports = {
  computeEMA,
  computeSMA,
  computeRSI,
  computeMACD,
  computeBollingerBands,
  computeATR,
  computeVWAP,
  computeStochastic,
};
