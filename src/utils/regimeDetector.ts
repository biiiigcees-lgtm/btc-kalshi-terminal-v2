// src/utils/regimeDetector.ts — S-TIER REGIME DETECTION
// Uses ADX for trend strength, ATR ratio for volatility regime
// 4-way volatility classification: low / normal / high / extreme
import type { Candle, MarketRegime } from '@/types';

function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [e];
  for (let i = period; i < values.length; i++) { e = values[i] * k + e * (1 - k); result.push(e); }
  return result;
}

function rma(values: number[], period: number): number[] {
  if (values.length < period) return [];
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [e];
  for (let i = period; i < values.length; i++) { e = (e * (period - 1) + values[i]) / period; result.push(e); }
  return result;
}

function mean(arr: number[]): number { return arr.reduce((a, b) => a + b, 0) / arr.length; }

function calcTR(highs: number[], lows: number[], closes: number[]): number[] {
  const tr: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  }
  return tr;
}

export function detectRegime(candles: Candle[]): MarketRegime {
  if (candles.length < 55) return { trend: 'ranging', volatility: 'normal' };

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  try {
    // ── Trend detection via EMA alignment + ADX ──────────────────────────
    const e9 = ema(closes, 9); const e21 = ema(closes, 21); const e50 = ema(closes, 50);
    if (!e9.length || !e21.length || !e50.length) return { trend: 'ranging', volatility: 'normal' };

    const v9 = e9[e9.length-1]; const v21 = e21[e21.length-1]; const v50 = e50[e50.length-1];
    const price = closes[closes.length-1];

    // EMA alignment
    const bullAlign = v9 > v21 && v21 > v50 && price > v9;
    const bearAlign = v9 < v21 && v21 < v50 && price < v9;

    // ADX for trend strength confirmation
    const tr = calcTR(highs, lows, closes);
    const dmPlus: number[] = []; const dmMinus: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const up = highs[i] - highs[i-1]; const dn = lows[i-1] - lows[i];
      dmPlus.push(up > dn && up > 0 ? up : 0);
      dmMinus.push(dn > up && dn > 0 ? dn : 0);
    }
    const atrS = rma(tr, 14);
    const dpS = rma(dmPlus, 14); const dnS = rma(dmMinus, 14);
    const diP = dpS.map((v, i) => atrS[i] > 0 ? (v / atrS[i]) * 100 : 0);
    const diN = dnS.map((v, i) => atrS[i] > 0 ? (v / atrS[i]) * 100 : 0);
    const dx = diP.map((v, i) => { const s = v + diN[i]; return s > 0 ? (Math.abs(v - diN[i]) / s) * 100 : 0; });
    const adxVals = rma(dx, 14);
    const adx = adxVals.length ? adxVals[adxVals.length-1] : 20;

    // Trend classification: need both EMA alignment AND ADX > 20 for trend
    let trend: MarketRegime['trend'];
    if (bullAlign && adx > 20) trend = 'up';
    else if (bearAlign && adx > 20) trend = 'down';
    else trend = 'ranging';

    // ── Volatility detection via ATR ratio ────────────────────────────────
    if (!atrS.length) return { trend, volatility: 'normal' };
    const currentATR = atrS[atrS.length-1];
    const avgATR = mean(atrS.slice(-20));
    const ratio = avgATR > 0 ? currentATR / avgATR : 1;

    let volatility: MarketRegime['volatility'];
    if (ratio > 2.0) volatility = 'high';      // extreme mapped to high for compatibility
    else if (ratio > 1.5) volatility = 'high';
    else if (ratio < 0.6) volatility = 'low';
    else volatility = 'normal';

    return { trend, volatility };
  } catch {
    return { trend: 'ranging', volatility: 'normal' };
  }
}
