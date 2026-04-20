// /src/utils/regimeDetector.ts — FIXED
// Candle requirement lowered from 210 → 55
// Using pure EMA math instead of technicalindicators library
import type { Candle, MarketRegime } from '@/types';

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

export function detectRegime(candles: Candle[]): MarketRegime {
  // FIXED: was 210, now 55 (uses EMA9/21/50 instead of EMA20/50/200)
  if (candles.length < 55) return { trend: 'ranging', volatility: 'normal' };

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  try {
    const ema9 = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);
    const ema50 = calcEMA(closes, 50);
    const e9 = ema9[ema9.length - 1];
    const e21 = ema21[ema21.length - 1];
    const e50 = ema50[ema50.length - 1];

    let trend: MarketRegime['trend'];
    if (e9 > e21 && e21 > e50) trend = 'up';
    else if (e9 < e21 && e21 < e50) trend = 'down';
    else trend = 'ranging';

    const atrVals = calcATR(highs, lows, closes, 14);
    const currentATR = atrVals[atrVals.length - 1];
    const slice = atrVals.slice(-20);
    const meanATR = slice.reduce((a, b) => a + b, 0) / slice.length;
    const ratio = meanATR > 0 ? currentATR / meanATR : 1;

    let volatility: MarketRegime['volatility'];
    if (ratio > 1.50) volatility = 'high';
    else if (ratio < 0.75) volatility = 'low';
    else volatility = 'normal';

    return { trend, volatility };
  } catch {
    return { trend: 'ranging', volatility: 'normal' };
  }
}
