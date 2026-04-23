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

export function calculateVWAP(candles: Candle[], anchorIndex?: number): { vwap: number; upperBand: number; lowerBand: number } {
  if (candles.length === 0) return { vwap: 0, upperBand: 0, lowerBand: 0 };
  
  const startIndex = anchorIndex ?? 0;
  const relevantCandles = candles.slice(startIndex);
  
  let cumTP = 0, cumVol = 0;
  for (const c of relevantCandles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTP += tp * c.volume;
    cumVol += c.volume;
  }
  
  const vwap = cumVol > 0 ? cumTP / cumVol : relevantCandles[relevantCandles.length - 1].close;
  
  // Calculate standard deviation for bands
  const deviations: number[] = [];
  for (const c of relevantCandles) {
    const tp = (c.high + c.low + c.close) / 3;
    deviations.push(Math.abs(tp - vwap));
  }
  
  const avgDev = deviations.length > 0 ? deviations.reduce((a, b) => a + b, 0) / deviations.length : 0;
  const upperBand = vwap + avgDev;
  const lowerBand = vwap - avgDev;
  
  return { vwap, upperBand, lowerBand };
}

export function calculateVolumeProfile(candles: Candle[], numBuckets: number = 50): { 
  poc: number; 
  vah: number; 
  val: number; 
  profile: { price: number; volume: number }[] 
} {
  if (candles.length === 0) return { poc: 0, vah: 0, val: 0, profile: [] };
  
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const minPrice = Math.min(...lows);
  const maxPrice = Math.max(...highs);
  const priceRange = maxPrice - minPrice;
  
  if (priceRange === 0) {
    const avgVol = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
    return { 
      poc: minPrice, 
      vah: minPrice, 
      val: minPrice, 
      profile: [{ price: minPrice, volume: avgVol }] 
    };
  }
  
  const bucketSize = priceRange / numBuckets;
  const buckets: { price: number; volume: number }[] = Array.from({ length: numBuckets }, (_, i) => ({
    price: minPrice + (i + 0.5) * bucketSize,
    volume: 0,
  }));
  
  // Distribute volume to buckets
  for (const candle of candles) {
    const candleMid = (candle.high + candle.low) / 2;
    const bucketIndex = Math.min(Math.floor((candleMid - minPrice) / bucketSize), numBuckets - 1);
    buckets[bucketIndex].volume += candle.volume;
  }
  
  // Find POC (Point of Control) - bucket with max volume
  const pocBucket = buckets.reduce((max, b) => b.volume > max.volume ? b : max, buckets[0]);
  const poc = pocBucket.price;
  
  // Calculate Value Area (70% of volume)
  const totalVolume = buckets.reduce((sum, b) => sum + b.volume, 0);
  const targetVolume = totalVolume * 0.7;
  
  let accumulatedVolume = 0;
  let vah = maxPrice;
  let val = minPrice;
  
  // Start from POC and expand outward
  let leftIndex = buckets.findIndex(b => b.price === poc);
  let rightIndex = leftIndex;
  
  while (accumulatedVolume < targetVolume && (leftIndex > 0 || rightIndex < numBuckets - 1)) {
    const leftVol = leftIndex > 0 ? buckets[leftIndex - 1].volume : 0;
    const rightVol = rightIndex < numBuckets - 1 ? buckets[rightIndex + 1].volume : 0;
    
    if (leftVol >= rightVol && leftIndex > 0) {
      accumulatedVolume += leftVol;
      leftIndex--;
      val = buckets[leftIndex].price;
    } else if (rightIndex < numBuckets - 1) {
      accumulatedVolume += rightVol;
      rightIndex++;
      vah = buckets[rightIndex].price;
    } else {
      break;
    }
  }
  
  return { poc, vah, val, profile: buckets };
}

export function calculateMultiTimeframeConfluence(
  signals1m: SignalResult[],
  signals5m: SignalResult[],
  signals15m: SignalResult[],
  signals1h: SignalResult[]
): { 
  score: number; 
  bullishCount: number; 
  bearishCount: number; 
  neutralCount: number;
  confluence: 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR';
} {
  const allSignals = [...signals1m, ...signals5m, ...signals15m, ...signals1h];
  
  if (allSignals.length === 0) {
    return { score: 0, bullishCount: 0, bearishCount: 0, neutralCount: 0, confluence: 'NEUTRAL' };
  }
  
  const bullish = allSignals.filter(s => s.direction === 'bullish').length;
  const bearish = allSignals.filter(s => s.direction === 'bearish').length;
  const neutral = allSignals.filter(s => s.direction === 'neutral').length;
  
  const total = allSignals.length;
  const bullishWeight = bullish * 1;
  const bearishWeight = bearish * -1;
  const score = (bullishWeight + bearishWeight) / total;
  
  let confluence: 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR' = 'NEUTRAL';
  
  if (score > 0.6) confluence = 'STRONG_BULL';
  else if (score > 0.3) confluence = 'BULL';
  else if (score < -0.6) confluence = 'STRONG_BEAR';
  else if (score < -0.3) confluence = 'BEAR';
  
  return { score, bullishCount: bullish, bearishCount: bearish, neutralCount: neutral, confluence };
}
