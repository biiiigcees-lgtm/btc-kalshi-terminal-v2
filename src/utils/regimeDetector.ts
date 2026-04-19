// /src/utils/regimeDetector.ts
import { EMA, ATR } from 'technicalindicators';
import type { Candle, MarketRegime } from '@/types';

export function detectRegime(candles: Candle[]): MarketRegime {
  if (candles.length < 210) return { trend: 'ranging', volatility: 'normal' };

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  try {
    const ema20 = EMA.calculate({ period: 20, values: closes });
    const ema50 = EMA.calculate({ period: 50, values: closes });
    const ema200 = EMA.calculate({ period: 200, values: closes });
    const e20 = ema20[ema20.length - 1];
    const e50 = ema50[ema50.length - 1];
    const e200 = ema200[ema200.length - 1];

    let trend: MarketRegime['trend'];
    if (e20 > e50 && e50 > e200) trend = 'up';
    else if (e20 < e50 && e50 < e200) trend = 'down';
    else trend = 'ranging';

    const atrVals = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
    const currentATR = atrVals[atrVals.length - 1];
    const meanATR = atrVals.slice(-20).reduce((a, b) => a + b, 0) / 20;
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
