// /src/stores/terminalStore.ts — Terminal state management
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TerminalSignal, TerminalSettings, AggressivenessLevel } from '@/types';

interface TerminalStore {
  terminalSignal: TerminalSignal | null;
  settings: TerminalSettings;
  signalHistory: TerminalSignal[];
  lastDecisionFlip: number | null;
  setTerminalSignal: (signal: TerminalSignal | null) => void;
  updateSettings: (updates: Partial<TerminalSettings>) => void;
  addToHistory: (signal: TerminalSignal) => void;
  recordDecisionFlip: () => void;
  // Bankroll tracking
  bankroll: number;
  initialBankroll: number;
  totalPnL: number;
  winCount: number;
  lossCount: number;
  setBankroll: (bankroll: number) => void;
  simulatePnL: (signal: TerminalSignal, actualPrice: number, targetPrice: number) => void;
  resetBankroll: () => void;
}

const DEFAULT_SETTINGS: TerminalSettings = {
  aggressiveness: 'moderate' as AggressivenessLevel,
  refreshIntervalMs: 1000,
  alertThreshold: 70,
  showExplainability: true,
  compactMode: false,
};

export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set, get) => ({
      terminalSignal: null,
      settings: DEFAULT_SETTINGS,
      signalHistory: [],
      lastDecisionFlip: null,
      bankroll: 1000,
      initialBankroll: 1000,
      totalPnL: 0,
      winCount: 0,
      lossCount: 0,
      setTerminalSignal: (signal) => {
        const prevSignal = get().terminalSignal;
        const isFlip = prevSignal && signal && prevSignal.decision !== signal.decision;
        set({ terminalSignal: signal });
        if (isFlip) {
          get().recordDecisionFlip();
        }
        if (signal) {
          get().addToHistory(signal);
        }
      },
      updateSettings: (updates) => set((state) => ({ settings: { ...state.settings, ...updates } })),
      addToHistory: (signal) => set((state) => ({
        signalHistory: [signal, ...state.signalHistory].slice(0, 100),
      })),
      recordDecisionFlip: () => set({ lastDecisionFlip: Date.now() }),
      setBankroll: (bankroll) => set({ bankroll, initialBankroll: bankroll, totalPnL: 0, winCount: 0, lossCount: 0 }),
      simulatePnL: (signal, actualPrice, targetPrice) => {
        const { bankroll, totalPnL, winCount, lossCount } = get();
        const recommendedBet = bankroll * 0.02; // 2% position size for simulation
        let pnl = 0;
        let isWin = false;

        if (signal.decision === 'BUY_YES') {
          // Win if actual price >= target price
          isWin = actualPrice >= targetPrice;
          pnl = isWin ? recommendedBet * 0.9 : -recommendedBet; // 90% payout on win
        } else if (signal.decision === 'BUY_NO') {
          // Win if actual price < target price
          isWin = actualPrice < targetPrice;
          pnl = isWin ? recommendedBet * 0.9 : -recommendedBet;
        }

        set({
          bankroll: bankroll + pnl,
          totalPnL: totalPnL + pnl,
          winCount: winCount + (isWin ? 1 : 0),
          lossCount: lossCount + (isWin ? 0 : 1),
        });
      },
      resetBankroll: () => set({
        bankroll: get().initialBankroll,
        totalPnL: 0,
        winCount: 0,
        lossCount: 0,
      }),
    }),
    {
      name: 'btc-terminal-terminal',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
