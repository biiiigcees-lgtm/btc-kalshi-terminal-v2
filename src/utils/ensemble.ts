// /src/utils/ensemble.ts
import type { SignalResult, MarketRegime } from '@/types';

export function computeEnsemble(signals: SignalResult[], regime: MarketRegime): number {
  if (signals.length === 0) return 50;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const signal of signals) {
    const raw = signal.direction === 'bullish'
      ? 0.5 + signal.confidence * 0.5
      : signal.direction === 'bearish'
      ? 0.5 - signal.confidence * 0.5
      : 0.5;

    let weight = 1.0;

    if (signal.category === 'momentum') {
      weight = regime.trend === 'ranging' ? 0.8 : 1.2;
    } else if (signal.category === 'meanReversion') {
      weight = regime.trend === 'ranging' ? 1.3 : 0.7;
    } else {
      weight = 1.0;
    }

    if (regime.volatility === 'high') {
      weight *= 0.85;
    }

    weightedSum += raw * weight;
    totalWeight += weight;
  }

  const prob = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 50;
  return parseFloat(Math.max(0, Math.min(100, prob)).toFixed(2));
}
