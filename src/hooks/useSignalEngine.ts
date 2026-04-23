'use client';
import { useCallback, useEffect, useRef } from 'react';
import { usePriceStore } from '@/stores/priceStore';
import { useSignalStore } from '@/stores/signalStore';
import { useKalshiStore } from '@/stores/kalshiStore';
import { useTradeStore } from '@/stores/tradeStore';
import { computeSignals, getATRRatio } from '@/utils/indicators';
import { computeEnsemble } from '@/utils/ensemble';
import { detectRegime } from '@/utils/regimeDetector';
import { performanceMonitor } from '@/lib/performance';
import { signalCache } from '@/lib/cache';
import type { Candle } from '@/types';

export function useSignalEngine() {
  const { setSignals, setEnsembleProbability, setRegime, setRegimeShiftDetected } = useSignalStore();
  const { updateComputedFields } = useKalshiStore();
  const { accountBalance } = useTradeStore();
  const throttleRef = useRef<number>(0);
  const THROTTLE_MS = 1000; // Recompute exactly once per second for live states
  const lastCandleHash = useRef<string>('');
  const MIN_CANDLE_THRESHOLD = 55;

  const getCandleHash = useCallback((candles: Candle[]) => {
    return candles.slice(-5).map(c => `${c.time}-${c.close}`).join('|');
  }, []);

  const recompute = useCallback(() => {
    const startTime = Date.now();
    
    try {
      const state = usePriceStore.getState();
      const candles = state.candles;
      
      if (candles.length < MIN_CANDLE_THRESHOLD) return;
      
      const candleHash = getCandleHash(candles);
      if (candleHash === lastCandleHash.current) return;
      lastCandleHash.current = candleHash;
      
      // Check cache
      const cacheKey = `signals_${candleHash}`;
      const cached = signalCache.get(cacheKey);
      if (cached) {
        const { signals, regime, ensemble, atrRatio } = cached as any;
        setSignals(signals);
        setRegime(regime);
        setEnsembleProbability(ensemble);
        updateComputedFields({ ensembleProbability: ensemble, accountBalance, atrRatio });
        performanceMonitor.recordApiCall('signal_engine_cache', Date.now() - startTime);
        return;
      }
      
      const signals = computeSignals(candles);
      if (signals.length === 0) return;
      
      const regime = detectRegime(candles);
      const prevRegime = useSignalStore.getState().regime;
      setRegimeShiftDetected(regime.trend !== prevRegime.trend || regime.volatility !== prevRegime.volatility);
      setRegime(regime);
      setSignals(signals);
      
      const ensemble = computeEnsemble(signals, regime);
      setEnsembleProbability(ensemble);
      
      const atrRatio = getATRRatio(candles);
      updateComputedFields({ ensembleProbability: ensemble, accountBalance, atrRatio });
      
      // Cache result for 30 seconds
      signalCache.set(cacheKey, { signals, regime, ensemble, atrRatio }, 30000);
      
      performanceMonitor.recordApiCall('signal_engine_compute', Date.now() - startTime);
    } catch (error) {
      console.error('Signal engine error:', error);
      performanceMonitor.recordApiCall('signal_engine_error', Date.now() - startTime);
    }
  }, [accountBalance, getCandleHash, setSignals, setEnsembleProbability, setRegime, setRegimeShiftDetected, updateComputedFields]);

  useEffect(() => {
    const unsub = usePriceStore.subscribe((state) => {
      const now = Date.now();
      if (now - throttleRef.current < THROTTLE_MS) return;
      throttleRef.current = now;

      if (!state.currentCandle || state.candles.length < MIN_CANDLE_THRESHOLD) return;
      const merged = [...state.candles.slice(0, -1), state.currentCandle];
      if (merged.length < MIN_CANDLE_THRESHOLD) return;
      
      const candleHash = getCandleHash(merged);
      if (candleHash === lastCandleHash.current) return;
      
      const startTime = Date.now();
      
      try {
        const signals = computeSignals(merged);
        if (signals.length === 0) return;
        
        const regime = detectRegime(merged);
        setRegime(regime);
        setSignals(signals);
        
        const ensemble = computeEnsemble(signals, regime);
        setEnsembleProbability(ensemble);
        
        const atrRatio = getATRRatio(merged);
        updateComputedFields({ ensembleProbability: ensemble, accountBalance, atrRatio });
        
        lastCandleHash.current = candleHash;
        performanceMonitor.recordApiCall('signal_engine_realtime', Date.now() - startTime);
      } catch (error) {
        console.error('Signal engine realtime error:', error);
        performanceMonitor.recordApiCall('signal_engine_realtime_error', Date.now() - startTime);
      }
    });
    return unsub;
  }, [accountBalance, getCandleHash, setSignals, setEnsembleProbability, setRegime, updateComputedFields]);

  return { recompute };
}
