// src/utils/indicators.ts — S-TIER SIGNAL ENGINE
// 20 signals across 5 categories:
// MOMENTUM: RSI, MACD, Stochastic, ROC, MFI
// MEAN REVERSION: Bollinger %B, Z-Score, Keltner, CCI, Williams %R
// TREND: EMA Alignment, ADX, DEMA Cross, Price vs VWAP, Supertrend proxy
// VOLUME: OBV Trend, Volume Ratio, VWAP Deviation, CMF
// VOLATILITY: ATR Ratio, Bollinger Bandwidth, Historical Volatility Ratio
import type { Candle, SignalResult } from '../types';

// ─── MATH PRIMITIVES ─────────────────────────────────────────────────────────
function clamp(v: number, lo = 0, hi = 1): number { return Math.max(lo, Math.min(hi, v)); }
function last<T>(arr: T[]): T { return arr[arr.length - 1]; }
function mean(arr: number[]): number { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function std(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let e = mean(values.slice(0, period));
  const result = [e];
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
    result.push(e);
  }
  return result;
}
function rma(values: number[], period: number): number[] {
  if (values.length < period) return [];
  let e = mean(values.slice(0, period));
  const result = [e];
  for (let i = period; i < values.length; i++) {
    e = (e * (period - 1) + values[i]) / period;
    result.push(e);
  }
  return result;
}
function trueRange(highs: number[], lows: number[], closes: number[]): number[] {
  const tr: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  }
  return tr;
}
function atrArr(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const tr = trueRange(highs, lows, closes);
  return rma(tr, period);
}

// ─── MOMENTUM SIGNALS ────────────────────────────────────────────────────────

// 1. RSI with divergence detection
function calcRSI(closes: number[], period = 14): { rsi: number; divergence: boolean } {
  if (closes.length < period + 1) return { rsi: 50, divergence: false };
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i-1];
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  const rs = losses === 0 ? 100 : gains / losses;
  const rsi = 100 - 100 / (1 + rs);
  // Bullish divergence: price making lower lows but RSI making higher lows
  const priceDown = closes[closes.length-1] < closes[closes.length-5];
  const rsiPrevLow = closes.length > 20 ? (() => {
    let g2 = 0, l2 = 0;
    for (let i = closes.length - 5 - period; i < closes.length - 5; i++) {
      const d = closes[i] - closes[i-1]; if (d > 0) g2 += d; else l2 += Math.abs(d);
    }
    const rs2 = l2 === 0 ? 100 : g2 / l2;
    return 100 - 100 / (1 + rs2);
  })() : rsi;
  const divergence = priceDown && rsi > rsiPrevLow + 3;
  return { rsi, divergence };
}

// 2. MACD with signal strength
function calcMACD(closes: number[]): { hist: number; strength: number; crossover: boolean } {
  const e12 = ema(closes, 12); const e26 = ema(closes, 26);
  if (!e12.length || !e26.length) return { hist: 0, strength: 0, crossover: false };
  const off = e12.length - e26.length;
  const macdLine = e26.map((v, i) => e12[i + off] - v);
  const sigLine = ema(macdLine, 9);
  if (!sigLine.length) return { hist: 0, strength: 0, crossover: false };
  const hist = last(macdLine) - last(sigLine);
  const prevHist = macdLine[macdLine.length - 2] - sigLine[sigLine.length - 2];
  const maxHist = Math.max(...macdLine.slice(-20).map(Math.abs), 0.0001);
  const strength = clamp(Math.abs(hist) / maxHist);
  const crossover = (hist > 0 && prevHist <= 0) || (hist < 0 && prevHist >= 0);
  return { hist, strength, crossover };
}

// 3. Stochastic with overbought/oversold zones
function calcStochastic(highs: number[], lows: number[], closes: number[], period = 14): { k: number; d: number; zone: 'ob' | 'os' | 'neutral' } {
  if (closes.length < period) return { k: 50, d: 50, zone: 'neutral' };
  const recentK: number[] = [];
  for (let i = Math.max(0, closes.length - period - 2); i < closes.length; i++) {
    const slice = closes.slice(Math.max(0, i - period + 1), i + 1);
    const h = Math.max(...highs.slice(Math.max(0, i - period + 1), i + 1));
    const l = Math.min(...lows.slice(Math.max(0, i - period + 1), i + 1));
    recentK.push(h === l ? 50 : ((closes[i] - l) / (h - l)) * 100);
  }
  const k = last(recentK);
  const d = mean(recentK.slice(-3));
  const zone = k > 80 ? 'ob' : k < 20 ? 'os' : 'neutral';
  return { k, d, zone };
}

// 4. Rate of Change (momentum)
function calcROC(closes: number[], period = 10): number {
  if (closes.length < period + 1) return 0;
  const old = closes[closes.length - 1 - period];
  return old ? ((last(closes) - old) / old) * 100 : 0;
}

// 5. Money Flow Index
function calcMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let posFlow = 0, negFlow = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    const prevTp = (highs[i-1] + lows[i-1] + closes[i-1]) / 3;
    const mf = tp * volumes[i];
    if (tp > prevTp) posFlow += mf; else negFlow += mf;
  }
  if (negFlow === 0) return 100;
  const mfr = posFlow / negFlow;
  return 100 - 100 / (1 + mfr);
}

// ─── MEAN REVERSION SIGNALS ──────────────────────────────────────────────────

// 6. Bollinger Band %B with squeeze detection
function calcBB(closes: number[], period = 20): { pctB: number; squeeze: boolean; bandwidth: number } {
  if (closes.length < period) return { pctB: 0.5, squeeze: false, bandwidth: 0 };
  const slice = closes.slice(-period);
  const m = mean(slice); const sd = std(slice);
  const upper = m + 2 * sd; const lower = m - 2 * sd;
  const pctB = sd > 0 ? (last(closes) - lower) / (upper - lower) : 0.5;
  const bandwidth = sd > 0 ? (upper - lower) / m * 100 : 0;
  // Squeeze: bandwidth in lowest 20% of last 50 bars
  const recentBW: number[] = [];
  for (let i = Math.max(period, closes.length - 50); i < closes.length; i++) {
    const sl = closes.slice(i - period, i);
    const s = std(sl);
    const me = mean(sl);
    recentBW.push(me > 0 ? (s * 4 / me) * 100 : 0);
  }
  const squeeze = bandwidth < (mean(recentBW) * 0.7);
  return { pctB, squeeze, bandwidth };
}

// 7. Z-Score
function calcZScore(closes: number[], period = 20): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const m = mean(slice); const s = std(slice);
  return s > 0 ? (last(closes) - m) / s : 0;
}

// 8. Keltner Channel position
function calcKeltner(closes: number[], highs: number[], lows: number[], period = 20): { pos: number; outside: boolean } {
  const emas = ema(closes, period); const atrs = atrArr(highs, lows, closes, 14);
  if (!emas.length || !atrs.length) return { pos: 0, outside: false };
  const midEma = last(emas); const atr = last(atrs);
  const upper = midEma + 2 * atr; const lower = midEma - 2 * atr;
  const pos = atr > 0 ? (last(closes) - midEma) / (2 * atr) : 0;
  const outside = Math.abs(pos) > 1;
  return { pos, outside };
}

// 9. CCI (Commodity Channel Index)
function calcCCI(highs: number[], lows: number[], closes: number[], period = 20): number {
  if (closes.length < period) return 0;
  const tps = highs.map((h, i) => (h + lows[i] + closes[i]) / 3);
  const slice = tps.slice(-period);
  const m = mean(slice);
  const meanDev = mean(slice.map(v => Math.abs(v - m)));
  return meanDev > 0 ? (last(tps) - m) / (0.015 * meanDev) : 0;
}

// 10. Williams %R
function calcWilliamsR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period) return -50;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  return h === l ? -50 : ((h - last(closes)) / (h - l)) * -100;
}

// ─── TREND SIGNALS ────────────────────────────────────────────────────────────

// 11. EMA Alignment (9/21/50) with bull/bear strength
function calcEMAAlignment(closes: number[]): { score: number; trend: 'bull' | 'bear' | 'mixed' } {
  const e9 = ema(closes, 9); const e21 = ema(closes, 21); const e50 = ema(closes, 50);
  if (!e9.length || !e21.length || !e50.length) return { score: 0, trend: 'mixed' };
  const v9 = last(e9); const v21 = last(e21); const v50 = last(e50); const price = last(closes);
  const bull = price > v9 && v9 > v21 && v21 > v50;
  const bear = price < v9 && v9 < v21 && v21 < v50;
  let score = 0;
  if (price > v9) score++; if (price > v21) score++; if (price > v50) score++;
  if (v9 > v21) score++; if (v21 > v50) score++;
  return { score: (score / 5) * 2 - 1, trend: bull ? 'bull' : bear ? 'bear' : 'mixed' };
}

// 12. ADX (trend strength)
function calcADX(highs: number[], lows: number[], closes: number[], period = 14): { adx: number; trending: boolean } {
  if (closes.length < period * 2) return { adx: 20, trending: false };
  const tr = trueRange(highs, lows, closes);
  const dmPlus: number[] = []; const dmMinus: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const up = highs[i] - highs[i-1]; const down = lows[i-1] - lows[i];
    dmPlus.push(up > down && up > 0 ? up : 0);
    dmMinus.push(down > up && down > 0 ? down : 0);
  }
  const atrSmooth = rma(tr, period);
  const dpSmooth = rma(dmPlus, period);
  const dnSmooth = rma(dmMinus, period);
  const diPlus = dpSmooth.map((v, i) => atrSmooth[i] > 0 ? (v / atrSmooth[i]) * 100 : 0);
  const diMinus = dnSmooth.map((v, i) => atrSmooth[i] > 0 ? (v / atrSmooth[i]) * 100 : 0);
  const dx = diPlus.map((v, i) => {
    const sum = v + diMinus[i]; return sum > 0 ? (Math.abs(v - diMinus[i]) / sum) * 100 : 0;
  });
  const adxVals = rma(dx, period);
  const adx = adxVals.length ? last(adxVals) : 20;
  return { adx, trending: adx > 25 };
}

// 13. DEMA Cross (fast trend)
function calcDEMACross(closes: number[]): { bullish: boolean; strength: number } {
  const e8 = ema(closes, 8); const e13 = ema(closes, 13);
  if (!e8.length || !e13.length) return { bullish: true, strength: 0 };
  const d8 = e8.map((v, i) => 2 * v - (ema(e8.slice(0, i + 1), Math.min(8, i + 1))[0] || v));
  const d13 = e13.map((v, i) => 2 * v - (ema(e13.slice(0, i + 1), Math.min(13, i + 1))[0] || v));
  const diff = last(d8) - last(d13);
  const maxDiff = Math.max(...d8.slice(-20).map((v, i) => Math.abs(v - (d13[d13.length - 20 + i] || v))), 0.0001);
  return { bullish: diff > 0, strength: clamp(Math.abs(diff) / maxDiff) };
}

// 14. Price vs VWAP with standard deviation bands
function calcVWAP(candles: Candle[]): { vwap: number; deviation: number; band: 1 | 2 | 3 | 0 } {
  if (candles.length < 2) return { vwap: last(candles)?.close || 0, deviation: 0, band: 0 };
  const sl = candles.slice(-96); // session-length approximation
  let cumTP = 0, cumVol = 0, cumTPSq = 0;
  for (const c of sl) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTP += tp * c.volume; cumTPSq += tp * tp * c.volume; cumVol += c.volume;
  }
  const vwap = cumVol > 0 ? cumTP / cumVol : last(sl).close;
  const variance = cumVol > 0 ? Math.max(0, cumTPSq / cumVol - vwap * vwap) : 0;
  const vwapStd = Math.sqrt(variance);
  const price = last(sl).close;
  const deviation = vwapStd > 0 ? (price - vwap) / vwapStd : 0;
  const band = Math.abs(deviation) >= 3 ? 3 : Math.abs(deviation) >= 2 ? 2 : Math.abs(deviation) >= 1 ? 1 : 0;
  return { vwap, deviation, band };
}

// 15. Supertrend proxy (ATR-based trend direction)
function calcSupertrend(highs: number[], lows: number[], closes: number[], period = 10, mult = 3): { bull: boolean; flip: boolean } {
  if (closes.length < period * 2) return { bull: true, flip: false };
  const atrs = atrArr(highs, lows, closes, period);
  const hl2 = highs.map((h, i) => (h + lows[i]) / 2);
  let direction = true;
  let upper = hl2[period] + mult * atrs[0];
  let lower = hl2[period] - mult * atrs[0];
  let prevDir = true;
  for (let i = 1; i < atrs.length; i++) {
    const ci = i + period;
    if (ci >= closes.length) break;
    const newUpper = hl2[ci] + mult * atrs[i];
    const newLower = hl2[ci] - mult * atrs[i];
    upper = newUpper < upper || closes[ci-1] > upper ? newUpper : upper;
    lower = newLower > lower || closes[ci-1] < lower ? newLower : lower;
    prevDir = direction;
    direction = closes[ci] > upper ? false : closes[ci] < lower ? true : direction;
    // true = bearish (price below), false = bullish (price above)
  }
  return { bull: !direction, flip: direction !== prevDir };
}

// ─── VOLUME SIGNALS ───────────────────────────────────────────────────────────

// 16. OBV Trend
function calcOBV(closes: number[], volumes: number[]): { trend: number; strength: number } {
  if (closes.length < 20) return { trend: 0, strength: 0 };
  let obv = 0;
  const obvArr: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i-1]) obv += volumes[i];
    else if (closes[i] < closes[i-1]) obv -= volumes[i];
    obvArr.push(obv);
  }
  const recent = obvArr.slice(-20);
  const obvEma5 = ema(recent, 5); const obvEma20 = ema(recent, 20);
  const trend = last(obvEma5) > last(obvEma20) ? 1 : -1;
  const maxOBV = Math.max(...recent.map(Math.abs), 1);
  const strength = clamp(Math.abs(last(recent)) / maxOBV);
  return { trend, strength };
}

// 17. Volume Ratio (current vs average)
function calcVolumeRatio(volumes: number[], period = 20): { ratio: number; surge: boolean } {
  if (volumes.length < period) return { ratio: 1, surge: false };
  const avg = mean(volumes.slice(-period));
  const current = last(volumes);
  const ratio = avg > 0 ? current / avg : 1;
  return { ratio, surge: ratio > 1.5 };
}

// 18. Chaikin Money Flow
function calcCMF(highs: number[], lows: number[], closes: number[], volumes: number[], period = 20): number {
  if (closes.length < period) return 0;
  let mfvSum = 0, volSum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const mfm = hl > 0 ? ((closes[i] - lows[i]) - (highs[i] - closes[i])) / hl : 0;
    mfvSum += mfm * volumes[i];
    volSum += volumes[i];
  }
  return volSum > 0 ? mfvSum / volSum : 0;
}

// ─── VOLATILITY SIGNALS ───────────────────────────────────────────────────────

// 19. ATR Ratio with regime classification
function calcATRRatio(highs: number[], lows: number[], closes: number[]): { ratio: number; regime: 'low' | 'normal' | 'high' | 'extreme' } {
  const atrs = atrArr(highs, lows, closes, 14);
  if (atrs.length < 20) return { ratio: 1, regime: 'normal' };
  const current = last(atrs); const avg = mean(atrs.slice(-20));
  const ratio = avg > 0 ? current / avg : 1;
  const regime = ratio > 2 ? 'extreme' : ratio > 1.5 ? 'high' : ratio < 0.6 ? 'low' : 'normal';
  return { ratio, regime };
}

// 20. Historical Volatility Ratio
function calcHVRatio(closes: number[]): { hvRatio: number; expanding: boolean } {
  if (closes.length < 30) return { hvRatio: 1, expanding: false };
  const returns = closes.slice(-30).map((c, i, a) => i > 0 ? Math.log(c / a[i-1]) : 0).slice(1);
  const hv5 = std(returns.slice(-5)) * Math.sqrt(288); // annualized (288 15m bars/day)
  const hv20 = std(returns.slice(-20)) * Math.sqrt(288);
  const hvRatio = hv20 > 0 ? hv5 / hv20 : 1;
  return { hvRatio, expanding: hvRatio > 1.2 };
}

// ─── SIGNAL CONFLUENCE ────────────────────────────────────────────────────────
// Counts how many signals agree on direction for higher confidence
function confluenceScore(signals: SignalResult[]): number {
  const bullish = signals.filter(s => s.direction === 'bullish').length;
  const bearish = signals.filter(s => s.direction === 'bearish').length;
  const total = signals.length;
  const dominant = Math.max(bullish, bearish);
  return total > 0 ? dominant / total : 0.5;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export function computeSignals(candles: Candle[]): SignalResult[] {
  if (candles.length < 55) return [];

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const results: SignalResult[] = [];

  // ── MOMENTUM ──────────────────────────────────────────────────────────────
  try {
    const { rsi, divergence } = calcRSI(closes);
    const ob = rsi > 75, os = rsi < 25;
    const conf = clamp(Math.abs(rsi - 50) / 50 + (divergence ? 0.2 : 0));
    results.push({
      name: 'RSI (14)',
      value: parseFloat(rsi.toFixed(2)),
      confidence: clamp(conf),
      direction: divergence ? 'bullish' : rsi > 55 ? 'bullish' : rsi < 45 ? 'bearish' : 'neutral',
      category: 'momentum',
    });
  } catch { /* skip */ }

  try {
    const { hist, strength, crossover } = calcMACD(closes);
    results.push({
      name: 'MACD (12/26/9)',
      value: parseFloat(hist.toFixed(4)),
      confidence: clamp(strength + (crossover ? 0.3 : 0)),
      direction: hist > 0 ? 'bullish' : hist < 0 ? 'bearish' : 'neutral',
      category: 'momentum',
    });
  } catch { /* skip */ }

  try {
    const { k, d, zone } = calcStochastic(highs, lows, closes);
    const cross = (k > d && k < 80) ? 0.2 : (k < d && k > 20) ? 0.2 : 0;
    results.push({
      name: 'Stochastic (14)',
      value: parseFloat(k.toFixed(2)),
      confidence: clamp(Math.abs(k - 50) / 50 + cross),
      direction: zone === 'os' || k > d ? 'bullish' : zone === 'ob' || k < d ? 'bearish' : 'neutral',
      category: 'momentum',
    });
  } catch { /* skip */ }

  try {
    const roc = calcROC(closes);
    results.push({
      name: 'Rate of Change',
      value: parseFloat(roc.toFixed(4)),
      confidence: clamp(Math.abs(roc) / 3),
      direction: roc > 0.2 ? 'bullish' : roc < -0.2 ? 'bearish' : 'neutral',
      category: 'momentum',
    });
  } catch { /* skip */ }

  try {
    const mfi = calcMFI(highs, lows, closes, volumes);
    results.push({
      name: 'Money Flow (14)',
      value: parseFloat(mfi.toFixed(2)),
      confidence: clamp(Math.abs(mfi - 50) / 50),
      direction: mfi > 55 ? 'bullish' : mfi < 45 ? 'bearish' : 'neutral',
      category: 'momentum',
    });
  } catch { /* skip */ }

  // ── MEAN REVERSION ────────────────────────────────────────────────────────
  try {
    const { pctB, squeeze } = calcBB(closes);
    const sqBonus = squeeze ? 0.2 : 0;
    results.push({
      name: 'Bollinger %B',
      value: parseFloat(pctB.toFixed(4)),
      confidence: clamp(Math.abs(pctB - 0.5) * 2 + sqBonus),
      direction: pctB < 0.2 ? 'bullish' : pctB > 0.8 ? 'bearish' : pctB > 0.5 ? 'bullish' : 'bearish',
      category: 'meanReversion',
    });
  } catch { /* skip */ }

  try {
    const z = calcZScore(closes);
    results.push({
      name: 'Z-Score (20)',
      value: parseFloat(z.toFixed(3)),
      confidence: clamp(Math.abs(z) / 3),
      direction: z < -1.5 ? 'bullish' : z > 1.5 ? 'bearish' : z < 0 ? 'bullish' : 'bearish',
      category: 'meanReversion',
    });
  } catch { /* skip */ }

  try {
    const { pos, outside } = calcKeltner(closes, highs, lows);
    results.push({
      name: 'Keltner Channel',
      value: parseFloat(pos.toFixed(4)),
      confidence: clamp(Math.abs(pos) + (outside ? 0.2 : 0)),
      direction: pos < -0.5 ? 'bullish' : pos > 0.5 ? 'bearish' : pos > 0 ? 'bullish' : 'bearish',
      category: 'meanReversion',
    });
  } catch { /* skip */ }

  try {
    const cci = calcCCI(highs, lows, closes);
    results.push({
      name: 'CCI (20)',
      value: parseFloat(cci.toFixed(2)),
      confidence: clamp(Math.abs(cci) / 200),
      direction: cci < -100 ? 'bullish' : cci > 100 ? 'bearish' : cci > 0 ? 'bullish' : 'bearish',
      category: 'meanReversion',
    });
  } catch { /* skip */ }

  try {
    const wr = calcWilliamsR(highs, lows, closes);
    results.push({
      name: 'Williams %R',
      value: parseFloat(wr.toFixed(2)),
      confidence: clamp(Math.abs(wr + 50) / 50),
      direction: wr < -80 ? 'bullish' : wr > -20 ? 'bearish' : wr < -50 ? 'bullish' : 'bearish',
      category: 'meanReversion',
    });
  } catch { /* skip */ }

  // ── TREND ────────────────────────────────────────────────────────────────
  try {
    const { score, trend } = calcEMAAlignment(closes);
    results.push({
      name: 'EMA Alignment',
      value: parseFloat(score.toFixed(4)),
      confidence: clamp(Math.abs(score)),
      direction: trend === 'bull' ? 'bullish' : trend === 'bear' ? 'bearish' : 'neutral',
      category: 'trend',
    });
  } catch { /* skip */ }

  try {
    const { adx, trending } = calcADX(highs, lows, closes);
    const emaA = calcEMAAlignment(closes);
    results.push({
      name: 'ADX (14)',
      value: parseFloat(adx.toFixed(2)),
      confidence: clamp(adx / 60),
      direction: !trending ? 'neutral' : emaA.trend === 'bull' ? 'bullish' : 'bearish',
      category: 'trend',
    });
  } catch { /* skip */ }

  try {
    const { bullish, strength } = calcDEMACross(closes);
    results.push({
      name: 'DEMA Cross (8/13)',
      value: parseFloat(strength.toFixed(4)),
      confidence: strength,
      direction: bullish ? 'bullish' : 'bearish',
      category: 'trend',
    });
  } catch { /* skip */ }

  try {
    const { vwap, deviation, band } = calcVWAP(candles);
    results.push({
      name: 'VWAP Deviation',
      value: parseFloat(deviation.toFixed(4)),
      confidence: clamp(Math.abs(deviation) / 3 + (band >= 2 ? 0.2 : 0)),
      direction: deviation > 0.3 ? 'bullish' : deviation < -0.3 ? 'bearish' : 'neutral',
      category: 'trend',
    });
  } catch { /* skip */ }

  try {
    const { bull, flip } = calcSupertrend(highs, lows, closes);
    results.push({
      name: 'Supertrend',
      value: flip ? 1 : 0,
      confidence: flip ? 0.9 : 0.6,
      direction: bull ? 'bullish' : 'bearish',
      category: 'trend',
    });
  } catch { /* skip */ }

  // ── VOLUME ───────────────────────────────────────────────────────────────
  try {
    const { trend, strength } = calcOBV(closes, volumes);
    results.push({
      name: 'OBV Trend',
      value: parseFloat(strength.toFixed(4)),
      confidence: strength,
      direction: trend > 0 ? 'bullish' : 'bearish',
      category: 'trend',
    });
  } catch { /* skip */ }

  try {
    const { ratio, surge } = calcVolumeRatio(volumes);
    const emaA = calcEMAAlignment(closes);
    results.push({
      name: 'Volume Ratio',
      value: parseFloat(ratio.toFixed(3)),
      confidence: clamp((ratio - 1) / 2 + (surge ? 0.2 : 0)),
      direction: surge ? (emaA.trend === 'bull' ? 'bullish' : 'bearish') : 'neutral',
      category: 'trend',
    });
  } catch { /* skip */ }

  try {
    const cmf = calcCMF(highs, lows, closes, volumes);
    results.push({
      name: 'Chaikin MF (20)',
      value: parseFloat(cmf.toFixed(4)),
      confidence: clamp(Math.abs(cmf) * 2),
      direction: cmf > 0.05 ? 'bullish' : cmf < -0.05 ? 'bearish' : 'neutral',
      category: 'meanReversion',
    });
  } catch { /* skip */ }

  // ── VOLATILITY ───────────────────────────────────────────────────────────
  try {
    const { ratio, regime } = calcATRRatio(highs, lows, closes);
    results.push({
      name: 'ATR Regime',
      value: parseFloat(ratio.toFixed(3)),
      confidence: clamp(Math.abs(ratio - 1) / 1.5),
      direction: regime === 'low' ? 'bullish' : regime === 'extreme' ? 'bearish' : 'neutral',
      category: 'trend',
    });
  } catch { /* skip */ }

  try {
    const { hvRatio, expanding } = calcHVRatio(closes);
    results.push({
      name: 'HV Ratio (5/20)',
      value: parseFloat(hvRatio.toFixed(3)),
      confidence: clamp(Math.abs(hvRatio - 1)),
      direction: expanding ? 'bearish' : 'bullish',
      category: 'trend',
    });
  } catch { /* skip */ }

  return results;
}

export function getATRRatio(candles: Candle[]): number {
  if (candles.length < 20) return 1;
  try {
    const atrs = atrArr(candles.map(c => c.high), candles.map(c => c.low), candles.map(c => c.close), 14);
    if (atrs.length < 2) return 1;
    const avg = mean(atrs.slice(-20));
    return avg > 0 ? last(atrs) / avg : 1;
  } catch { return 1; }
}
