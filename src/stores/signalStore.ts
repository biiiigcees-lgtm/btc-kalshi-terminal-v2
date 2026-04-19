// /src/stores/signalStore.ts
import { create } from 'zustand';
import type { SignalResult, MarketRegime } from '../types';

interface SignalStore {
  signals: SignalResult[];
  ensembleProbability: number;
  regime: MarketRegime;
  lastUpdated: number;
  regimeShiftDetected: boolean;
  setSignals: (signals: SignalResult[]) => void;
  setEnsembleProbability: (prob: number) => void;
  setRegime: (regime: MarketRegime) => void;
  setRegimeShiftDetected: (detected: boolean) => void;
}

// Safe timestamp function to avoid hydration mismatch
const getSafeTimestamp = () => {
  if (typeof window === 'undefined') return 0;
  return Date.now();
};

export const useSignalStore = create<SignalStore>((set) => ({
  signals: [],
  ensembleProbability: 50,
  regime: { trend: 'ranging', volatility: 'normal' },
  lastUpdated: 0,
  regimeShiftDetected: false,
  setSignals: (signals) => set({ signals, lastUpdated: getSafeTimestamp() }),
  setEnsembleProbability: (prob) => set({ ensembleProbability: prob }),
  setRegime: (regime) => set({ regime }),
  setRegimeShiftDetected: (detected) => set({ regimeShiftDetected: detected }),
}));
