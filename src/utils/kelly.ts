// /src/utils/kelly.ts
import type { KellyResult } from '@/types';

export function computeKelly(params: {
  ensembleProbability: number;
  accountBalance: number;
  atrRatio: number;
}): KellyResult {
  const p = params.ensembleProbability / 100;
  const kellyFraction = Math.max(0, 2 * p - 1);
  let fractionalKelly = kellyFraction * 0.40;
  let volatilityAdjusted = false;

  if (params.atrRatio > 1.50) {
    fractionalKelly *= 0.50;
    volatilityAdjusted = true;
  } else if (params.atrRatio > 1.25) {
    fractionalKelly *= 0.75;
    volatilityAdjusted = true;
  }

  const cappedFraction = Math.min(fractionalKelly, 0.03);
  const recommendedBet = params.accountBalance * cappedFraction;

  return { kellyFraction, fractionalKelly, cappedFraction, recommendedBet, volatilityAdjusted };
}

export function computeEV(params: {
  ensembleProbability: number;
  kalshiFee?: number;
}): number {
  const p = params.ensembleProbability / 100;
  const fee = params.kalshiFee ?? 0.02;
  return 2 * (p - 0.5) - fee;
}
