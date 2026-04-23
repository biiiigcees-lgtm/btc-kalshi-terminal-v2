// /src/stores/priceStore.ts — Single source of truth for BTC price with timestamping
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
  // Single source of truth fields
  lastPriceTimestamp: number;
  priceFreshness: number; // ms since last update
  feedLatency: number; // average latency in ms
  feedHealth: 'healthy' | 'degraded' | 'unhealthy';
  tickCount: number;
  setSpotPrice: (price: number) => void;
  setCoingeckoPrice: (price: number) => void;
  setCandles: (candles: Candle[]) => void;
  setCurrentCandle: (candle: Candle) => void;
  appendCandle: (candle: Candle) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  incrementConnectionRetry: () => void;
  resetConnectionRetries: () => void;
  setLastError: (error: string | null) => void;
  updateFeedHealth: () => void;
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
  lastPriceTimestamp: 0,
  priceFreshness: 0,
  feedLatency: 0,
  feedHealth: 'unhealthy',
  tickCount: 0,
  setSpotPrice: (price) => {
    const now = Date.now();
    const freshness = now - get().lastPriceTimestamp;
    const tickCount = get().tickCount + 1;
    
    // Calculate average latency (simplified - in production would measure actual network latency)
    const avgLatency = get().feedLatency;
    const newLatency = freshness > 0 ? (avgLatency * 0.9 + freshness * 0.1) : avgLatency;
    
    // Determine feed health
    let feedHealth: 'healthy' | 'degraded' | 'unhealthy';
    if (freshness < 2000 && get().connectionStatus === 'connected') {
      feedHealth = 'healthy';
    } else if (freshness < 5000) {
      feedHealth = 'degraded';
    } else {
      feedHealth = 'unhealthy';
    }
    
    set({ 
      spotPrice: price, 
      lastPriceTimestamp: now,
      priceFreshness: freshness,
      feedLatency: newLatency,
      feedHealth,
      tickCount,
    });
  },
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
  updateFeedHealth: () => {
    const freshness = Date.now() - get().lastPriceTimestamp;
    let feedHealth: 'healthy' | 'degraded' | 'unhealthy';
    if (freshness < 2000 && get().connectionStatus === 'connected') {
      feedHealth = 'healthy';
    } else if (freshness < 5000) {
      feedHealth = 'degraded';
    } else {
      feedHealth = 'unhealthy';
    }
    set({ priceFreshness: freshness, feedHealth });
  },
}));
