import type { Candle, MarketRegime } from '@/types';

function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [ema];
  for (let i = period; i < values.length; i++) { ema = values[i] * k + ema * (1 - k); result.push(ema); }
  return result;
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  }
  if (trs.length < period) return [trs[trs.length-1] || 0];
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [atr];
  for (let i = period; i < trs.length; i++) { atr = (atr * (period - 1) + trs[i]) / period; result.push(atr); }
  return result;
}

export function detectRegime(candles: Candle[]): MarketRegime {
  if (candles.length < 55) return { trend: 'ranging', volatility: 'normal' };
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  try {
    const e9 = calcEMA(closes, 9); const e21 = calcEMA(closes, 21); const e50 = calcEMA(closes, 50);
    const v9 = e9[e9.length-1]; const v21 = e21[e21.length-1]; const v50 = e50[e50.length-1];
    const trend: MarketRegime['trend'] = v9 > v21 && v21 > v50 ? 'up' : v9 < v21 && v21 < v50 ? 'down' : 'ranging';
    const atrs = calcATR(highs, lows, closes, 14);
    const cur = atrs[atrs.length-1]; const avg = atrs.slice(-20).reduce((a,b) => a+b, 0) / Math.min(20, atrs.length);
    const ratio = avg > 0 ? cur / avg : 1;
    const volatility: MarketRegime['volatility'] = ratio > 1.5 ? 'high' : ratio < 0.75 ? 'low' : 'normal';
    return { trend, volatility };
  } catch { return { trend: 'ranging', volatility: 'normal' }; }
}
