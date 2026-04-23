// src/hooks/useDecisionEngine.ts — Enhanced with trajectory prediction and decision logging
'use client';
import { useEffect, useRef, useState } from 'react';
import { usePriceStore } from '@/stores/priceStore';
import { useSignalStore } from '@/stores/signalStore';
import { DecisionEngine } from '@/engine/decisionEngine';
import { PerformanceTracker } from '@/engine/performanceTracker';
import { decisionLogger } from '@/lib/decisionLogger';
import type { EnhancedDecisionSignal } from '@/types';

const DECISION_THRESHOLDS = {
  minConfidence: 0.65,
  minEdge: 0.1,
  maxRiskTier: 3, // 1=low, 2=medium, 3=high, 4=extreme
  minEnsembleProbability: 60,
};

export function useDecisionEngine() {
  const { candles, spotPrice, feedHealth } = usePriceStore();
  const { setDecisionSignal, setPipelineMetrics, setEngineActive } = useSignalStore();
  
  const engineRef = useRef<DecisionEngine | null>(null);
  const trackerRef = useRef<PerformanceTracker | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [lastDecision, setLastDecision] = useState<EnhancedDecisionSignal | null>(null);
  const [decisionCount, setDecisionCount] = useState(0);

  // Initialize engine and tracker
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new DecisionEngine();
      trackerRef.current = new PerformanceTracker();
      setEngineActive(true);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [setEngineActive]);

  // Process decisions every second
  useEffect(() => {
    if (!engineRef.current || !trackerRef.current) return;

    const processDecision = async () => {
      // Skip if feed is unhealthy
      if (feedHealth !== 'healthy') {
        return;
      }

      // Skip if insufficient data
      if (candles.length < 55) {
        return;
      }

      try {
        if (!engineRef.current) return;
        const signal = await engineRef.current.process(candles);
        
        if (signal) {
          // Apply decision thresholds
          const riskTierValue = signal.riskTier === 'low' ? 1 : signal.riskTier === 'medium' ? 2 : signal.riskTier === 'high' ? 3 : 4;
          const meetsThresholds = 
            signal.confidence >= DECISION_THRESHOLDS.minConfidence &&
            Math.abs(signal.edge) >= DECISION_THRESHOLDS.minEdge &&
            riskTierValue <= DECISION_THRESHOLDS.maxRiskTier;

          if (meetsThresholds) {
            // Log the decision
            const logId = decisionLogger.logDecision(signal, spotPrice);
            
            // Update store
            setDecisionSignal(signal);
            setPipelineMetrics(engineRef.current.getMetrics());
            setLastDecision(signal);
            setDecisionCount(prev => prev + 1);

            // Record performance
            trackerRef.current?.recordSignal(signal);
          }
        }
      } catch (error) {
        console.error('Decision processing error:', error);
      }
    };

    // Run immediately
    processDecision();

    // Then run every second
    intervalRef.current = window.setInterval(processDecision, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [candles, spotPrice, feedHealth, setDecisionSignal, setPipelineMetrics, setEngineActive]);

  // Manual recompute trigger
  const recompute = async () => {
    if (!engineRef.current || candles.length < 55) return null;
    return await engineRef.current.process(candles);
  };

  // Record outcome for a decision
  const recordOutcome = (id: string, outcome: 'win' | 'loss' | 'breakeven', exitPrice: number, notes?: string) => {
    decisionLogger.updateOutcome(id, outcome, exitPrice, notes);
    if (trackerRef.current) {
      const returnPct = ((exitPrice - spotPrice) / spotPrice) * 100;
      trackerRef.current.recordOutcome(id, outcome, returnPct);
    }
  };

  // Get decision stats
  const getDecisionStats = () => {
    return decisionLogger.getStats();
  };

  // Get recent decisions
  const getRecentDecisions = (limit = 10) => {
    return decisionLogger.getLogs(limit);
  };

  return {
    recompute,
    recordOutcome,
    getDecisionStats,
    getRecentDecisions,
    lastDecision,
    decisionCount,
    thresholds: DECISION_THRESHOLDS,
  };
}

