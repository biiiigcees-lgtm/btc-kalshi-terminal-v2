// /src/stores/terminalStore.ts — Terminal state management
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TerminalSignal, TerminalSettings, AggressivenessLevel } from '@/types';

interface TerminalStore {
  terminalSignal: TerminalSignal | null;
  settings: TerminalSettings;
  signalHistory: TerminalSignal[];
  lastFlipTimestamp: number;
  setTerminalSignal: (signal: TerminalSignal | null) => void;
  updateSettings: (settings: Partial<TerminalSettings>) => void;
  addToHistory: (signal: TerminalSignal) => void;
  setLastFlipTimestamp: (ts: number) => void;
}

const DEFAULT_SETTINGS: TerminalSettings = {
  aggressiveness: 'moderate',
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
      lastFlipTimestamp: 0,

      setTerminalSignal: (signal) => {
        if (signal) {
          const history = get().signalHistory;
          set({
            terminalSignal: signal,
            signalHistory: [signal, ...history].slice(0, 100),
            lastFlipTimestamp: signal.decisionFlipped ? signal.timestamp : get().lastFlipTimestamp,
          });
        } else {
          set({ terminalSignal: signal });
        }
      },

      updateSettings: (partial) => {
        set({ settings: { ...get().settings, ...partial } });
      },

      addToHistory: (signal) => {
        const history = get().signalHistory;
        set({ signalHistory: [signal, ...history].slice(0, 100) });
      },

      setLastFlipTimestamp: (ts) => set({ lastFlipTimestamp: ts }),
    }),
    {
      name: 'btc-terminal-settings',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
