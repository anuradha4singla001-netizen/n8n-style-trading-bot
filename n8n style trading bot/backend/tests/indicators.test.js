/**
 * Unit Tests – Technical Indicators
 * Run with: npm test (from backend/)
 */

const {
  computeRSI,
  computeMACD,
  computeEMA,
  computeSMA,
  computeBollingerBands,
} = require("../src/engine/indicators");

// Generate realistic price series
function makePrices(n = 100, start = 50000, vol = 0.01) {
  const prices = [start];
  for (let i = 1; i < n; i++) {
    const change = (Math.random() - 0.5) * vol * prices[i - 1];
    prices.push(Math.max(1, prices[i - 1] + change));
  }
  return prices;
}

describe("EMA", () => {
  test("returns null when insufficient data", () => {
    expect(computeEMA([1, 2, 3], 14)).toBeNull();
  });
  test("returns a number for sufficient data", () => {
    const result = computeEMA(makePrices(50), 14);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });
  test("EMA(1) equals last price", () => {
    const prices = makePrices(10);
    expect(computeEMA(prices, 1)).toBeCloseTo(prices[prices.length - 1], 5);
  });
});

describe("SMA", () => {
  test("returns null for insufficient data", () => {
    expect(computeSMA([1, 2], 5)).toBeNull();
  });
  test("simple average is correct", () => {
    expect(computeSMA([2, 4, 6, 8, 10], 5)).toBeCloseTo(6, 5);
  });
});

describe("RSI", () => {
  test("returns null for insufficient data", () => {
    expect(computeRSI([1, 2, 3], 14)).toBeNull();
  });
  test("stays in [0, 100]", () => {
    const rsi = computeRSI(makePrices(100), 14);
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });
  test("all-up series approaches 100", () => {
    const ascending = Array.from({ length: 50 }, (_, i) => i + 1);
    const rsi = computeRSI(ascending, 14);
    expect(rsi).toBeGreaterThan(90);
  });
  test("all-down series approaches 0", () => {
    const descending = Array.from({ length: 50 }, (_, i) => 100 - i);
    const rsi = computeRSI(descending, 14);
    expect(rsi).toBeLessThan(10);
  });
});

describe("MACD", () => {
  test("returns null for insufficient data", () => {
    expect(computeMACD(makePrices(20))).toBeNull();
  });
  test("returns line, signal, histogram", () => {
    const macd = computeMACD(makePrices(100));
    expect(macd).not.toBeNull();
    expect(typeof macd.line).toBe("number");
    expect(typeof macd.signal).toBe("number");
    expect(typeof macd.histogram).toBe("number");
  });
  test("histogram = line - signal", () => {
    const macd = computeMACD(makePrices(100));
    expect(macd.histogram).toBeCloseTo(macd.line - macd.signal, 8);
  });
});

describe("Bollinger Bands", () => {
  test("returns null for insufficient data", () => {
    expect(computeBollingerBands(makePrices(5))).toBeNull();
  });
  test("upper > middle > lower", () => {
    const bb = computeBollingerBands(makePrices(100));
    expect(bb.upper).toBeGreaterThan(bb.middle);
    expect(bb.middle).toBeGreaterThan(bb.lower);
  });
  test("percentB is finite", () => {
    const bb = computeBollingerBands(makePrices(100));
    expect(isFinite(bb.percentB)).toBe(true);
  });
});
