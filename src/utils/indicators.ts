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
function calcATRArr(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  }
  if (trs.length < period) return [trs[trs.length-1] || 0];
  const result: number[] = [];
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(atr);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push(atr);
  }
  return result;
}

export function computeSignals(candles: Candle[]): SignalResult[] {
  if (candles.length < 55) return [];
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const last = closes[closes.length - 1];
  const results: SignalResult[] = [];

  // 1. RSI
  try {
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const d = closes[i] - closes[i-1];
      if (d > 0) gains += d; else losses += Math.abs(d);
    }
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - 100 / (1 + rs);
    results.push({ name: 'RSI (14)', value: parseFloat(rsi.toFixed(2)), confidence: clamp(Math.abs(rsi - 50) / 50), direction: rsi > 55 ? 'bullish' : rsi < 45 ? 'bearish' : 'neutral', category: 'momentum' });
  } catch { /* skip */ }

  // 2. MACD
  try {
    const e12 = calcEMA(closes, 12); const e26 = calcEMA(closes, 26);
    if (e12.length && e26.length) {
      const off = e12.length - e26.length;
      const macdLine = e26.map((v, i) => e12[i + off] - v);
      const sig = calcEMA(macdLine, 9);
      const hist = sig.length ? macdLine[macdLine.length-1] - sig[sig.length-1] : 0;
      const maxH = Math.max(...macdLine.slice(-20).map(Math.abs), 0.0001);
      results.push({ name: 'MACD (12/26/9)', value: parseFloat(hist.toFixed(4)), confidence: clamp(Math.abs(hist) / maxH), direction: hist > 0 ? 'bullish' : hist < 0 ? 'bearish' : 'neutral', category: 'momentum' });
    }
  } catch { /* skip */ }

  // 3. Stochastic
  try {
    const h = Math.max(...highs.slice(-14)); const l = Math.min(...lows.slice(-14));
    const stoch = h === l ? 50 : ((last - l) / (h - l)) * 100;
    results.push({ name: 'Stochastic (14)', value: parseFloat(stoch.toFixed(2)), confidence: clamp(Math.abs(stoch - 50) / 50), direction: stoch > 60 ? 'bullish' : stoch < 40 ? 'bearish' : 'neutral', category: 'momentum' });
  } catch { /* skip */ }

  // 4. ROC
  try {
    const old = closes[closes.length - 11];
    const roc = old ? ((last - old) / old) * 100 : 0;
    results.push({ name: 'Rate of Change (10)', value: parseFloat(roc.toFixed(4)), confidence: clamp(Math.abs(roc) / 2), direction: roc > 0 ? 'bullish' : roc < 0 ? 'bearish' : 'neutral', category: 'momentum' });
  } catch { /* skip */ }

  // 5. Bollinger Bands
  try {
    const sl = closes.slice(-20); const m = mean(sl); const sd = stdDev(sl);
    const pos = sd > 0 ? (last - m) / (2 * sd) : 0;
    results.push({ name: 'Bollinger Band', value: parseFloat(pos.toFixed(4)), confidence: clamp(Math.abs(pos)), direction: pos > 0.3 ? 'bullish' : pos < -0.3 ? 'bearish' : 'neutral', category: 'meanReversion' });
  } catch { /* skip */ }

  // 6. Z-Score
  try {
    const sl = closes.slice(-20); const m = mean(sl); const sd = stdDev(sl);
    const z = sd > 0 ? (last - m) / sd : 0;
    results.push({ name: 'Z-Score (20)', value: parseFloat(z.toFixed(3)), confidence: clamp(Math.abs(z) / 3), direction: z > 0.5 ? 'bullish' : z < -0.5 ? 'bearish' : 'neutral', category: 'meanReversion' });
  } catch { /* skip */ }

  // 7. Keltner Channel
  try {
    const emas = calcEMA(closes, 20); const atrs = calcATRArr(highs, lows, closes, 14);
    if (emas.length && atrs.length) {
      const ema = emas[emas.length-1]; const atr = atrs[atrs.length-1];
      const pos = atr > 0 ? (last - ema) / (1.5 * atr) : 0;
      results.push({ name: 'Keltner Channel', value: parseFloat(pos.toFixed(4)), confidence: clamp(Math.abs(pos)), direction: pos > 0.3 ? 'bullish' : pos < -0.3 ? 'bearish' : 'neutral', category: 'meanReversion' });
    }
  } catch { /* skip */ }

  // 8. EMA Alignment
  try {
    const e9 = calcEMA(closes, 9); const e21 = calcEMA(closes, 21); const e50 = calcEMA(closes, 50);
    if (e9.length && e21.length && e50.length) {
      const v9 = e9[e9.length-1]; const v21 = e21[e21.length-1]; const v50 = e50[e50.length-1];
      const bull = v9 > v21 && v21 > v50 && last > v9;
      const bear = v9 < v21 && v21 < v50 && last < v9;
      const pct = ((v9 - v21) / v21) * 100;
      results.push({ name: 'EMA Alignment', value: parseFloat(pct.toFixed(4)), confidence: bull || bear ? 1.0 : 0.4, direction: bull ? 'bullish' : bear ? 'bearish' : 'neutral', category: 'trend' });
    }
  } catch { /* skip */ }

  // 9. ATR Ratio
  try {
    const atrs = calcATRArr(highs, lows, closes, 14);
    const cur = atrs[atrs.length-1]; const avg = mean(atrs.slice(-20));
    const ratio = avg > 0 ? cur / avg : 1;
    results.push({ name: 'ATR Ratio', value: parseFloat(ratio.toFixed(3)), confidence: ratio > 1 ? clamp(ratio - 1) : 0, direction: ratio > 1.25 ? 'bearish' : ratio < 0.85 ? 'bullish' : 'neutral', category: 'trend' });
  } catch { /* skip */ }

  // 10. VWAP Deviation
  try {
    const sl = candles.slice(-96);
    let cumTP = 0, cumVol = 0;
    for (const c of sl) { const tp = (c.high + c.low + c.close) / 3; cumTP += tp * c.volume; cumVol += c.volume; }
    const vwap = cumVol > 0 ? cumTP / cumVol : last;
    const dev = vwap > 0 ? (last - vwap) / vwap * 100 : 0;
    results.push({ name: 'VWAP Deviation', value: parseFloat(dev.toFixed(4)), confidence: clamp(Math.abs(dev) / 0.5), direction: dev > 0.1 ? 'bullish' : dev < -0.1 ? 'bearish' : 'neutral', category: 'trend' });
  } catch { /* skip */ }

  return results;
}

export function getATRRatio(candles: Candle[]): number {
  if (candles.length < 20) return 1;
  try {
    const atrs = calcATRArr(candles.map(c => c.high), candles.map(c => c.low), candles.map(c => c.close), 14);
    const cur = atrs[atrs.length-1]; const avg = mean(atrs.slice(-20));
    return avg > 0 ? cur / avg : 1;
  } catch { return 1; }
}
