// /src/utils/indicators.ts
import {
  RSI,
  MACD,
  Stochastic,
  ROC,
  BollingerBands,
  EMA,
  ATR,
} from 'technicalindicators';
import type { Candle, SignalResult } from '../types';

function clamp(val: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, val));
}

function computeVWAP(candles: Candle[]): number {
  let cumVol = 0, cumTP = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTP += tp * c.volume;
    cumVol += c.volume;
  }
  return cumVol > 0 ? cumTP / cumVol : candles[candles.length - 1]?.close ?? 0;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
}

// Helper functions to reduce cognitive complexity
function getRSIDirection(rsi: number): 'bullish' | 'bearish' | 'neutral' {
  if (rsi > 55) return 'bullish';
  if (rsi < 45) return 'bearish';
  return 'neutral';
}

function getMACDDirection(histogram: number): 'bullish' | 'bearish' | 'neutral' {
  if (histogram > 0) return 'bullish';
  if (histogram < 0) return 'bearish';
  return 'neutral';
}

function getStochasticDirection(k: number): 'bullish' | 'bearish' | 'neutral' {
  if (k > 60) return 'bullish';
  if (k < 40) return 'bearish';
  return 'neutral';
}

function getROCDirection(roc: number): 'bullish' | 'bearish' | 'neutral' {
  if (roc > 0) return 'bullish';
  if (roc < 0) return 'bearish';
  return 'neutral';
}

function getBBDirection(pos: number): 'bullish' | 'bearish' | 'neutral' {
  if (pos > 0.3) return 'bullish';
  if (pos < -0.3) return 'bearish';
  return 'neutral';
}

function getZScoreDirection(zScore: number): 'bullish' | 'bearish' | 'neutral' {
  if (zScore > 0.5) return 'bullish';
  if (zScore < -0.5) return 'bearish';
  return 'neutral';
}

function getKeltnerDirection(pos: number): 'bullish' | 'bearish' | 'neutral' {
  if (pos > 0.3) return 'bullish';
  if (pos < -0.3) return 'bearish';
  return 'neutral';
}

function getEMADirection(e20: number, e50: number, e200: number): 'bullish' | 'bearish' | 'neutral' {
  const bullishAlign = e20 > e50 && e50 > e200;
  const bearishAlign = e20 < e50 && e50 < e200;
  if (bullishAlign) return 'bullish';
  if (bearishAlign) return 'bearish';
  return 'neutral';
}

function getATRDirection(ratio: number): 'bullish' | 'bearish' | 'neutral' {
  if (ratio > 1.25) return 'bearish';
  if (ratio < 0.85) return 'bullish';
  return 'neutral';
}

function getVWAPDirection(deviation: number): 'bullish' | 'bearish' | 'neutral' {
  if (deviation > 0.1) return 'bullish';
  if (deviation < -0.1) return 'bearish';
  return 'neutral';
}

export function computeSignals(candles: Candle[]): SignalResult[] {
  if (candles.length < 210) return [];

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);
  const last = closes[closes.length - 1];

  const results: SignalResult[] = [];

  // 1. RSI(14)
  try {
    const rsiVals = RSI.calculate({ period: 14, values: closes });
    const rsi = rsiVals[rsiVals.length - 1];
    results.push({
      name: 'RSI (14)',
      value: parseFloat(rsi.toFixed(2)),
      confidence: clamp(Math.abs(rsi - 50) / 50),
      direction: getRSIDirection(rsi),
      category: 'momentum',
    });
  } catch {
    // Indicator calculation failed - skip this signal
  }

  // 2. MACD(12/26/9)
  try {
    const macdVals = MACD.calculate({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, values: closes, SimpleMAOscillator: false, SimpleMASignal: false });
    const macd = macdVals[macdVals.length - 1];
    const histograms = macdVals.slice(-20).map(m => Math.abs(m.histogram ?? 0));
    const maxHist = Math.max(...histograms, 0.0001);
    results.push({
      name: 'MACD (12/26/9)',
      value: parseFloat((macd.histogram ?? 0).toFixed(4)),
      confidence: clamp(Math.abs(macd.histogram ?? 0) / maxHist),
      direction: getMACDDirection(macd.histogram ?? 0),
      category: 'momentum',
    });
  } catch {
    // Indicator calculation failed - skip this signal
  }

  // 3. Stochastic(14)
  try {
    const stochVals = Stochastic.calculate({ period: 14, signalPeriod: 3, high: highs, low: lows, close: closes });
    const stoch = stochVals[stochVals.length - 1];
    results.push({
      name: 'Stochastic (14)',
      value: parseFloat(stoch.k.toFixed(2)),
      confidence: clamp(Math.abs(stoch.k - 50) / 50),
      direction: getStochasticDirection(stoch.k),
      category: 'momentum',
    });
  } catch {
    // Indicator calculation failed - skip this signal
  }

  // 4. ROC(10)
  try {
    const rocVals = ROC.calculate({ period: 10, values: closes });
    const roc = rocVals[rocVals.length - 1];
    const maxRoc = Math.max(...rocVals.slice(-20).map(Math.abs), 0.0001);
    results.push({
      name: 'Rate of Change (10)',
      value: parseFloat(roc.toFixed(4)),
      confidence: clamp(Math.abs(roc) / maxRoc),
      direction: getROCDirection(roc),
      category: 'momentum',
    });
  } catch {
    // Indicator calculation failed - skip this signal
  }

  // 5. Bollinger Band Position
  try {
    const bbVals = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
    const bb = bbVals[bbVals.length - 1];
    const bandwidth = bb.upper - bb.middle;
    const pos = bandwidth > 0 ? (last - bb.middle) / bandwidth : 0;
    results.push({
      name: 'Bollinger Band',
      value: parseFloat(pos.toFixed(4)),
      confidence: clamp(Math.abs(pos)),
      direction: getBBDirection(pos),
      category: 'meanReversion',
    });
  } catch {
    // Indicator calculation failed - skip this signal
  }

  // 6. Z-Score(20)
  try {
    const slice20 = closes.slice(-20);
    const m = mean(slice20);
    const sd = stdDev(slice20);
    const zScore = sd > 0 ? (last - m) / sd : 0;
    results.push({
      name: 'Z-Score (20)',
      value: parseFloat(zScore.toFixed(3)),
      confidence: clamp(Math.abs(zScore) / 3),
      direction: getZScoreDirection(zScore),
      category: 'meanReversion',
    });
  } catch {
    // Indicator calculation failed - skip this signal
  }

  // 7. Keltner Channel
  try {
    const ema20Vals = EMA.calculate({ period: 20, values: closes });
    const atrVals = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
    const ema20 = ema20Vals[ema20Vals.length - 1];
    const atr14 = atrVals[atrVals.length - 1];
    const upper = ema20 + 2 * atr14;
    const bandwidth = upper - ema20;
    const pos = bandwidth > 0 ? (last - ema20) / bandwidth : 0;
    results.push({
      name: 'Keltner Channel',
      value: parseFloat(pos.toFixed(4)),
      confidence: clamp(Math.abs(pos)),
      direction: getBBDirection(pos),
      category: 'meanReversion',
    });
  } catch {
    // Indicator calculation failed - skip this signal
  }

  // 8. EMA Alignment (20/50/200)
  try {
    const ema20 = EMA.calculate({ period: 20, values: closes });
    const ema50 = EMA.calculate({ period: 50, values: closes });
    const ema200 = EMA.calculate({ period: 200, values: closes });
    const e20 = ema20[ema20.length - 1];
    const e50 = ema50[ema50.length - 1];
    const e200 = ema200[ema200.length - 1];
    const bullishAlign = e20 > e50 && e50 > e200;
    const bearishAlign = e20 < e50 && e50 < e200;
    const twoAligned = (e20 > e50) === (e50 > e200);
    results.push({
      name: 'EMA Alignment',
      value: parseFloat(((e20 - e50) / e50 * 100).toFixed(4)),
      confidence: bullishAlign || bearishAlign ? 1.0 : twoAligned ? 0.5 : 0.0,
      direction: getEMADirection(e20, e50, e200),
      category: 'trend',
    });
  } catch {
    // Indicator calculation failed - skip this signal
  }

  // 9. ATR Ratio
  try {
    const atrVals = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
    const currentATR = atrVals[atrVals.length - 1];
    const meanATR20 = mean(atrVals.slice(-20));
    const ratio = meanATR20 > 0 ? currentATR / meanATR20 : 1;
    results.push({
      name: 'ATR Ratio',
      value: parseFloat(ratio.toFixed(3)),
      confidence: ratio > 1 ? clamp(ratio - 1) : 0,
      direction: getATRDirection(ratio),
      category: 'trend',
    });
  } catch {
    // Indicator calculation failed - skip this signal
  }

  // 10. VWAP Deviation
  try {
    const vwap = computeVWAP(candles.slice(-96));
    const deviation = vwap > 0 ? (last - vwap) / vwap * 100 : 0;
    results.push({
      name: 'VWAP Deviation',
      value: parseFloat(deviation.toFixed(4)),
      confidence: clamp(Math.abs(deviation) / 0.5),
      direction: getVWAPDirection(deviation),
      category: 'trend',
    });
  } catch {
    // Indicator calculation failed - skip this signal
  }

  return results;
}

export function getATRRatio(candles: Candle[]): number {
  if (candles.length < 35) return 1;
  try {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);
    const atrVals = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
    const current = atrVals[atrVals.length - 1];
    const m = atrVals.slice(-20).reduce((a, b) => a + b, 0) / 20;
    return m > 0 ? current / m : 1;
  } catch {
    return 1;
  }
}
