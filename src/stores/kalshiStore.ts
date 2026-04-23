// /src/stores/kalshiStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface KalshiStore {
  targetPrice: number | null;
  impliedProbability: number;
  edge: number;
  expectedValue: number;
  kellyFraction: number;
  fractionalKelly: number;
  cappedFraction: number;
  recommendedBet: number;
  volatilityAdjusted: boolean;
  bankroll: number;
  setTargetPrice: (price: number | null) => void;
  setImpliedProbability: (prob: number) => void;
  setBankroll: (bankroll: number) => void;
  updateComputedFields: (params: {
    ensembleProbability: number;
    atrRatio: number;
  }) => void;
}

export const useKalshiStore = create<KalshiStore>()(
  persist(
    (set, get) => ({
      targetPrice: null,
      impliedProbability: 50,
      edge: 0,
      expectedValue: 0,
      kellyFraction: 0,
      fractionalKelly: 0,
      cappedFraction: 0,
      recommendedBet: 0,
      volatilityAdjusted: false,
      bankroll: 1000,
      setTargetPrice: (price) => set({ targetPrice: price }),
      setImpliedProbability: (prob) => set({ impliedProbability: prob }),
      setBankroll: (bankroll) => set({ bankroll }),
      updateComputedFields: ({ ensembleProbability, atrRatio }) => {
        const p = ensembleProbability / 100;
        const implied = get().impliedProbability / 100;
        const edge = (p - implied) * 100;
        const expectedValue = 2 * (p - 0.5) - 0.04;
        const kellyFraction = Math.max(0, 2 * p - 1);
        // Half-Kelly max (0.5 multiplier)
        let fractionalKelly = kellyFraction * 0.50;
        let volatilityAdjusted = false;
        if (atrRatio > 1.50) { fractionalKelly *= 0.50; volatilityAdjusted = true; }
        else if (atrRatio > 1.25) { fractionalKelly *= 0.75; volatilityAdjusted = true; }
        // Cap at 5% (0.05)
        const cappedFraction = Math.min(fractionalKelly, 0.05);
        const recommendedBet = get().bankroll * cappedFraction;
        set({ edge, expectedValue, kellyFraction, fractionalKelly, cappedFraction, recommendedBet, volatilityAdjusted });
      },
    }),
    { name: 'btc-terminal-kalshi' }
  )
);
