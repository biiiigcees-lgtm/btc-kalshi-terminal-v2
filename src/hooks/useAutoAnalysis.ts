// /src/hooks/useAutoAnalysis.ts
'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useKalshiStore } from '../stores/kalshiStore';
import { useTradeStore } from '../stores/tradeStore';
import { usePriceStore } from '../stores/priceStore';
import { useSignalStore } from '../stores/signalStore';
import { useKalshiWindow } from './useKalshiWindow';
import { buildContext } from '../utils/contextBuilder';

interface AnalysisResult {
  triggerAnalysis: () => void;
  isReady: boolean;
}

export function useAutoAnalysis(onAnalyze: (context: string) => void): AnalysisResult {
  const { targetPrice, impliedProbability, edge, expectedValue, kellyFraction, recommendedBet, cappedFraction, volatilityAdjusted } = useKalshiStore();
  const { intendedBet, accountBalance, rollingWinRate20, profitFactor, sharpeRatio, consecutiveLosses, totalPnL } = useTradeStore();
  const { spotPrice, coingeckoPrice, divergencePct, currentCandle } = usePriceStore();
  const { signals, ensembleProbability, regime } = useSignalStore();
  const { secondsRemaining } = useKalshiWindow();
  
  const lastAnalysisRef = useRef<number>(0);
  const ANALYSIS_COOLDOWN = 30000; // Minimum 30 seconds between auto-analyses
  
  const isReady = !!(targetPrice && intendedBet && intendedBet > 0);
  
  const triggerAnalysis = useCallback(() => {
    if (!isReady) return;
    
    const now = Date.now();
    if (now - lastAnalysisRef.current < ANALYSIS_COOLDOWN) {
      console.log('Auto-analysis cooldown active, skipping...');
      return;
    }
    
    lastAnalysisRef.current = now;
    
    try {
      const ctx = buildContext({
        spotPrice,
        coingeckoPrice,
        divergencePct,
        currentCandle,
        secondsRemaining,
        targetPrice,
        impliedProbability,
        regime,
        signals,
        ensembleProbability,
        edge,
        expectedValue,
        kellyFraction,
        recommendedBet,
        cappedFraction,
        volatilityAdjusted,
        accountBalance,
        intendedBet,
        rollingWinRate20,
        profitFactor,
        sharpeRatio,
        consecutiveLosses,
        totalPnL,
      });
      
      onAnalyze(ctx);
    } catch (error) {
      console.error('Auto-analysis failed:', error);
    }
  }, [isReady, spotPrice, coingeckoPrice, divergencePct, currentCandle, secondsRemaining, targetPrice, impliedProbability, regime, signals, ensembleProbability, edge, expectedValue, kellyFraction, recommendedBet, cappedFraction, volatilityAdjusted, accountBalance, intendedBet, rollingWinRate20, profitFactor, sharpeRatio, consecutiveLosses, totalPnL, onAnalyze]);
  
  // Debounced auto-trigger when both targetPrice and intendedBet are set
  useEffect(() => {
    if (!isReady) return;
    
    // Debounce: wait 1.5 seconds after last input change before triggering
    // This prevents rapid API calls when user is typing/changing values
    const timer = setTimeout(() => {
      triggerAnalysis();
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [targetPrice, intendedBet, isReady, triggerAnalysis]);
  
  return { triggerAnalysis, isReady };
}
