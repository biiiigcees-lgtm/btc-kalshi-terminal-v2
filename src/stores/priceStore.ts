// /src/stores/priceStore.ts
import { create } from 'zustand';
import type { Candle, ConnectionStatus } from '@/types';

interface PriceStore {
  spotPrice: number;
  coingeckoPrice: number;
  divergencePct: number;
  candles: Candle[];
  currentCandle: Candle | null;
  connectionStatus: ConnectionStatus;
  connectionRetries: number;
  lastError: string | null;
  setSpotPrice: (price: number) => void;
  setCoingeckoPrice: (price: number) => void;
  setCandles: (candles: Candle[]) => void;
  setCurrentCandle: (candle: Candle) => void;
  appendCandle: (candle: Candle) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  incrementConnectionRetry: () => void;
  resetConnectionRetries: () => void;
  setLastError: (error: string | null) => void;
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  spotPrice: 0,
  coingeckoPrice: 0,
  divergencePct: 0,
  candles: [],
  currentCandle: null,
  connectionStatus: 'reconnecting',
  connectionRetries: 0,
  lastError: null,
  setSpotPrice: (price) => set({ spotPrice: price }),
  setCoingeckoPrice: (price) => {
    const spot = get().spotPrice;
    const div = spot > 0 ? Math.abs(spot - price) / spot * 100 : 0;
    set({ coingeckoPrice: price, divergencePct: parseFloat(div.toFixed(4)) });
  },
  setCandles: (candles) => set({ candles }),
  setCurrentCandle: (candle) => set({ currentCandle: candle }),
  appendCandle: (candle) => set((state) => ({
    candles: [...state.candles.slice(-199), candle],
  })),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  incrementConnectionRetry: () => set((state) => ({ connectionRetries: state.connectionRetries + 1 })),
  resetConnectionRetries: () => set({ connectionRetries: 0, lastError: null }),
  setLastError: (error) => set({ lastError: error }),
}));
