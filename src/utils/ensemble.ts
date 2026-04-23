// src/utils/ensemble.ts — S-TIER ENSEMBLE
// 5-category adaptive weighting system
// Weights shift based on market regime (trending vs ranging)
// Confluence bonus when 70%+ of signals agree
// High-confidence signals get amplified weight
import type { SignalResult, MarketRegime } from '@/types';

// Category base weights — adjust for regime
const BASE_WEIGHTS: Record<string, number> = {
  momentum:     1.0,
  meanReversion: 1.0,
  trend:        1.0,
};

const TRENDING_WEIGHTS: Record<string, number> = {
  momentum:     1.3,  // momentum signals more reliable in trends
  meanReversion: 0.6, // mean reversion less reliable in trends
  trend:        1.5,  // trend signals most reliable in trends
};

const RANGING_WEIGHTS: Record<string, number> = {
  momentum:     0.9,
  meanReversion: 1.6, // mean reversion most reliable when ranging
  trend:        0.6,  // trend signals least reliable when ranging
};

const HIGH_VOL_MULTIPLIER = 0.75; // reduce all weights in extreme volatility

export function computeEnsemble(signals: SignalResult[], regime: MarketRegime): number {
  if (signals.length === 0) return 50;

  const isTrending = regime.trend === 'up' || regime.trend === 'down';
  const isHighVol = regime.volatility === 'high';
  const weights = isTrending ? TRENDING_WEIGHTS : (regime.trend === 'ranging' ? RANGING_WEIGHTS : BASE_WEIGHTS);

  // Calculate confluence — what % of signals agree on direction
  const bullCount = signals.filter(s => s.direction === 'bullish').length;
  const bearCount = signals.filter(s => s.direction === 'bearish').length;
  const total = signals.length;
  const dominant = Math.max(bullCount, bearCount);
  const confluencePct = total > 0 ? dominant / total : 0.5;
  
  // Confluence bonus: if 70%+ agree, boost their weight by 20%
  const confluenceBonus = confluencePct >= 0.7 ? 1.2 : confluencePct >= 0.6 ? 1.1 : 1.0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const signal of signals) {
    // Convert direction to 0-1 probability
    const raw = signal.direction === 'bullish'
      ? 0.5 + signal.confidence * 0.5
      : signal.direction === 'bearish'
      ? 0.5 - signal.confidence * 0.5
      : 0.5;

    // Category weight
    let weight = weights[signal.category] ?? 1.0;

    // High volatility dampening
    if (isHighVol) weight *= HIGH_VOL_MULTIPLIER;

    // Confluence bonus for signals matching dominant direction
    const matchesDominant = (bullCount >= bearCount && signal.direction === 'bullish')
      || (bearCount > bullCount && signal.direction === 'bearish');
    if (matchesDominant) weight *= confluenceBonus;

    // High confidence signals get extra weight (top 20% by confidence)
    if (signal.confidence > 0.8) weight *= 1.25;

    // Named signal bonuses — certain signals are more predictive for 15min binary
    if (signal.name === 'Supertrend' && signal.value === 1) weight *= 1.3; // flip signal
    if (signal.name === 'MACD (12/26/9)' && signal.confidence > 0.7) weight *= 1.15;
    if (signal.name === 'EMA Alignment' && Math.abs(parseFloat(signal.value.toString())) > 0.8) weight *= 1.2;

    weightedSum += raw * weight;
    totalWeight += weight;
  }

  const rawProb = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 50;

  // Calibration: compress extreme values slightly (avoid 95%+ which overfit)
  const calibrated = 50 + (rawProb - 50) * 0.92;

  return parseFloat(Math.max(5, Math.min(95, calibrated)).toFixed(2));
}
