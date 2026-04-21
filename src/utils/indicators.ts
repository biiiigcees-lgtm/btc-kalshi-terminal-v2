// /src/utils/indicators.ts — FIXED
// Pure math implementation — no technicalindicators library dependency
// Minimum candle requirement reduced from 210 → 55 (EMA200 replaced with EMA50 alignment)
import type { Candle, SignalResult } from '../types';

function clamp(val: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, val));
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
}

function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (ema12.length === 0 || ema26.length === 0) return { macd: 0, signal: 0, histogram: 0 };
  // Align lengths
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
  const signalLine = calcEMA(macdLine, 9);
  if (signalLine.length === 0) return { macd: 0, signal: 0, histogram: 0 };
  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  return { macd, signal, histogram: macd - signal };
}

function calcStochastic(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period) return 50;
  const recentH = Math.max(...highs.slice(-period));
  const recentL = Math.min(...lows.slice(-period));
  if (recentH === recentL) return 50;
  return ((closes[closes.length - 1] - recentL) / (recentH - recentL)) * 100;
}

function calcROC(closes: number[], period = 10): number {
  if (closes.length < period + 1) return 0;
  const old = closes[closes.length - 1 - period];
  if (old === 0) return 0;
  return ((closes[closes.length - 1] - old) / old) * 100;
}

function calcBollingerPosition(closes: number[], period = 20): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const m = mean(slice);
  const sd = stdDev(slice);
  if (sd === 0) return 0;
  const upper = m + 2 * sd;
  const lower = m - 2 * sd;
  const bandwidth = upper - m;
  return bandwidth > 0 ? (closes[closes.length - 1] - m) / bandwidth : 0;
}

function calcZScore(closes: number[], period = 20): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const m = mean(slice);
  const sd = stdDev(slice);
  return sd > 0 ? (closes[closes.length - 1] - m) / sd : 0;
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  if (trs.length < period) return [trs[trs.length - 1] || 0];
  const result: number[] = [];
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(atr);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push(atr);
  }
  return result;
}

function calcKeltnerPosition(closes: number[], highs: number[], lows: number[], period = 20): number {
  const emas = calcEMA(closes, period);
  if (emas.length === 0) return 0;
  const ema = emas[emas.length - 1];
  const atrs = calcATR(highs, lows, closes, 14);
  const atr = atrs[atrs.length - 1];
  const upper = ema + 1.5 * atr;
  const bandwidth = upper - ema;
  return bandwidth > 0 ? (closes[closes.length - 1] - ema) / bandwidth : 0;
}

// EMA alignment using 9/21/50 instead of 20/50/200 — requires only 50 candles
function calcEMAAlignment(closes: number[]): { alignment: number; direction: 'bullish' | 'bearish' | 'neutral' } {
  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const ema50 = calcEMA(closes, 50);
  if (!ema9.length || !ema21.length || !ema50.length) {
    return { alignment: 0, direction: 'neutral' };
  }
  const e9 = ema9[ema9.length - 1];
  const e21 = ema21[ema21.length - 1];
  const e50 = ema50[ema50.length - 1];
  const price = closes[closes.length - 1];

  const bullish = e9 > e21 && e21 > e50 && price > e9;
  const bearish = e9 < e21 && e21 < e50 && price < e9;
  const alignment = bullish ? 1 : bearish ? -1 : (e9 > e21 ? 0.5 : -0.5);
  const direction = bullish ? 'bullish' : bearish ? 'bearish' : 'neutral';
  return { alignment: (alignment + 1) / 2, direction }; // normalize to 0–1
}

function calcVWAP(candles: Candle[]): number {
  let cumVol = 0, cumTP = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTP += tp * c.volume;
    cumVol += c.volume;
  }
  return cumVol > 0 ? cumTP / cumVol : candles[candles.length - 1]?.close ?? 0;
}

export function computeSignals(candles: Candle[]): SignalResult[] {
  // FIXED: was 210, now 55 (EMA50 is the longest period needed)
  if (candles.length < 55) return [];

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const last = closes[closes.length - 1];

  const results: SignalResult[] = [];

  // 1. RSI(14)
  try {
    const rsi = calcRSI(closes, 14);
    results.push({
      name: 'RSI (14)',
      value: parseFloat(rsi.toFixed(2)),
      confidence: clamp(Math.abs(rsi - 50) / 50),
      direction: rsi > 55 ? 'bullish' : rsi < 45 ? 'bearish' : 'neutral',
      category: 'momentum',
    });
  } catch { /* skip */ }

  // 2. MACD(12/26/9)
  try {
    const macd = calcMACD(closes);
    const recentHists = closes.slice(-30).map((_, i, arr) => {
      if (i < 26) return 0;
      return Math.abs(calcMACD(arr.slice(0, i + 1)).histogram);
    });
    const maxHist = Math.max(...recentHists, 0.0001);
    results.push({
      name: 'MACD (12/26/9)',
      value: parseFloat(macd.histogram.toFixed(4)),
      confidence: clamp(Math.abs(macd.histogram) / maxHist),
      direction: macd.histogram > 0 ? 'bullish' : macd.histogram < 0 ? 'bearish' : 'neutral',
      category: 'momentum',
    });
  } catch { /* skip */ }

  // 3. Stochastic(14)
  try {
    const stoch = calcStochastic(highs, lows, closes, 14);
    results.push({
      name: 'Stochastic (14)',
      value: parseFloat(stoch.toFixed(2)),
      confidence: clamp(Math.abs(stoch - 50) / 50),
      direction: stoch > 60 ? 'bullish' : stoch < 40 ? 'bearish' : 'neutral',
      category: 'momentum',
    });
  } catch { /* skip */ }

  // 4. ROC(10)
  try {
    const roc = calcROC(closes, 10);
    results.push({
      name: 'Rate of Change (10)',
      value: parseFloat(roc.toFixed(4)),
      confidence: clamp(Math.abs(roc) / 2),
      direction: roc > 0 ? 'bullish' : roc < 0 ? 'bearish' : 'neutral',
      category: 'momentum',
    });
  } catch { /* skip */ }

  // 5. Bollinger Band Position
  try {
    const pos = calcBollingerPosition(closes, 20);
    results.push({
      name: 'Bollinger Band',
      value: parseFloat(pos.toFixed(4)),
      confidence: clamp(Math.abs(pos)),
      direction: pos > 0.3 ? 'bullish' : pos < -0.3 ? 'bearish' : 'neutral',
      category: 'meanReversion',
    });
  } catch { /* skip */ }

  // 6. Z-Score(20)
  try {
    const zScore = calcZScore(closes, 20);
    results.push({
      name: 'Z-Score (20)',
      value: parseFloat(zScore.toFixed(3)),
      confidence: clamp(Math.abs(zScore) / 3),
      direction: zScore > 0.5 ? 'bullish' : zScore < -0.5 ? 'bearish' : 'neutral',
      category: 'meanReversion',
    });
  } catch { /* skip */ }

  // 7. Keltner Channel
  try {
    const pos = calcKeltnerPosition(closes, highs, lows, 20);
    results.push({
      name: 'Keltner Channel',
      value: parseFloat(pos.toFixed(4)),
      confidence: clamp(Math.abs(pos)),
      direction: pos > 0.3 ? 'bullish' : pos < -0.3 ? 'bearish' : 'neutral',
      category: 'meanReversion',
    });
  } catch { /* skip */ }

  // 8. EMA Alignment (9/21/50) — FIXED: was 20/50/200 requiring 200+ candles
  try {
    const { alignment, direction } = calcEMAAlignment(closes);
    const e9 = calcEMA(closes, 9);
    const e21 = calcEMA(closes, 21);
    const pctDiff = e9.length && e21.length ? (e9[e9.length - 1] - e21[e21.length - 1]) / e21[e21.length - 1] * 100 : 0;
    results.push({
      name: 'EMA Alignment',
      value: parseFloat(pctDiff.toFixed(4)),
      confidence: clamp(Math.abs(pctDiff) * 10),
      direction,
      category: 'trend',
    });
  } catch { /* skip */ }

  // 9. ATR Ratio
  try {
    const atrs = calcATR(highs, lows, closes, 14);
    const currentATR = atrs[atrs.length - 1];
    const meanATR = mean(atrs.slice(-20));
    const ratio = meanATR > 0 ? currentATR / meanATR : 1;
    results.push({
      name: 'ATR Ratio',
      value: parseFloat(ratio.toFixed(3)),
      confidence: ratio > 1 ? clamp(ratio - 1) : 0,
      direction: ratio > 1.25 ? 'bearish' : ratio < 0.85 ? 'bullish' : 'neutral',
      category: 'trend',
    });
  } catch { /* skip */ }

  // 10. VWAP Deviation
  try {
    const vwap = calcVWAP(candles.slice(-96));
    const deviation = vwap > 0 ? (last - vwap) / vwap * 100 : 0;
    results.push({
      name: 'VWAP Deviation',
      value: parseFloat(deviation.toFixed(4)),
      confidence: clamp(Math.abs(deviation) / 0.5),
      direction: deviation > 0.1 ? 'bullish' : deviation < -0.1 ? 'bearish' : 'neutral',
      category: 'trend',
    });
  } catch { /* skip */ }

  return results;
}

export function getATRRatio(candles: Candle[]): number {
  if (candles.length < 20) return 1;
  try {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);
    const atrs = calcATR(highs, lows, closes, 14);
    const current = atrs[atrs.length - 1];
    const m = mean(atrs.slice(-20));
    return m > 0 ? current / m : 1;
  } catch {
    return 1;
  }
}
