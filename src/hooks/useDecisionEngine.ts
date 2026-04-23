// src/hooks/useDecisionEngine.ts — Hook to integrate decision engine with existing system
import { useEffect, useRef } from 'react';
import { usePriceStore } from '@/stores/priceStore';
import { useSignalStore } from '@/stores/signalStore';
import { DecisionEngine } from '@/engine/decisionEngine';
import { PerformanceTracker } from '@/engine/performanceTracker';
import type { MarketData, DecisionSignal } from '@/types';

export function useDecisionEngine() {
  const { candles, currentCandle, spotPrice } = usePriceStore();
  const { 
    setDecisionSignal, 
    setPipelineMetrics, 
    setEngineActive,
    decisionSignal 
  } = useSignalStore();

  const engineRef = useRef<DecisionEngine | null>(null);
  const trackerRef = useRef<PerformanceTracker | null>(null);
  const lastProcessedRef = useRef<number>(0);
  const processIntervalMs = 5000; // Process every 5 seconds

  useEffect(() => {
    // Initialize engine and tracker
    engineRef.current = new DecisionEngine({
      minConfidenceThreshold: 0.65,
      maxLatencyMs: 500,
      minDataQualityScore: 0.7,
      cooldownMs: 30000,
      enableBackpressure: true,
      bufferSize: 100,
    });

    trackerRef.current = new PerformanceTracker();
    setEngineActive(true);

    return () => {
      setEngineActive(false);
      engineRef.current = null;
      trackerRef.current = null;
    };
  }, [setEngineActive]);

  useEffect(() => {
    if (!engineRef.current || !trackerRef.current) return;

    const now = Date.now();
    if (now - lastProcessedRef.current < processIntervalMs) return;
    if (!currentCandle || spotPrice === 0) return;

    lastProcessedRef.current = now;

    // Create market data from current state
    const marketData: MarketData = {
      price: spotPrice,
      volume: currentCandle.volume,
      spread: 0.0001, // Placeholder - would come from order book
      timestamp: now,
      momentum: spotPrice - currentCandle.open,
      orderFlow: 0, // Placeholder - would come from order book
      volatility: currentCandle.high - currentCandle.low,
    };

    // Ingest data
    engineRef.current.ingestData(marketData);

    // Process pipeline
    engineRef.current.process(candles).then((signal: DecisionSignal | null) => {
      if (signal) {
        setDecisionSignal(signal);
        trackerRef.current?.recordSignal(signal);
        
        // Update metrics
        const metrics = engineRef.current?.getMetrics();
        if (metrics) {
          setPipelineMetrics(metrics);
        }
      }
    });
  }, [candles, currentCandle, spotPrice, setDecisionSignal, setPipelineMetrics]);

  return {
    decisionSignal,
    isEngineActive: engineRef.current !== null,
    recordOutcome: (signalId: string, outcome: 'win' | 'loss', returnPct: number) => {
      trackerRef.current?.recordOutcome(signalId, outcome, returnPct);
    },
    getMetrics: () => engineRef.current?.getMetrics(),
    getPerformance: (signalType: string) => trackerRef.current?.getMetrics(signalType),
  };
}
