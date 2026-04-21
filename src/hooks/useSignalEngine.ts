// /src/hooks/useSignalEngine.ts — FIXED
// Recompute now triggers on every price update, not just candle close
// Candle threshold aligned to 55 (matching indicators.ts fix)
'use client';
import { useCallback, useEffect } from 'react';
import { usePriceStore } from '@/stores/priceStore';
import { useSignalStore } from '@/stores/signalStore';
import { useKalshiStore } from '@/stores/kalshiStore';
import { useTradeStore } from '@/stores/tradeStore';
import { computeSignals, getATRRatio } from '@/utils/indicators';
import { computeEnsemble } from '@/utils/ensemble';
import { detectRegime } from '@/utils/regimeDetector';

export function useSignalEngine() {
  const { setSignals, setEnsembleProbability, setRegime, setRegimeShiftDetected } = useSignalStore();
  const { updateComputedFields } = useKalshiStore();
  const { accountBalance } = useTradeStore();

  const recompute = useCallback(() => {
    const state = usePriceStore.getState();
    const c = state.candles;

    // FIXED: threshold was 50 in hook but 210 in indicators — now both aligned at 55
    if (c.length < 55) return;

    const signals = computeSignals(c);
    if (signals.length === 0) return; // don't overwrite with empty array

    const newRegime = detectRegime(c);
    const prevRegime = useSignalStore.getState().regime;

    const regimeShift =
      newRegime.trend !== prevRegime.trend ||
      newRegime.volatility !== prevRegime.volatility;

    setRegime(newRegime);
    setRegimeShiftDetected(regimeShift);
    setSignals(signals);

    const ensemble = computeEnsemble(signals, newRegime);
    setEnsembleProbability(ensemble);

    const atrRatio = getATRRatio(c);
    updateComputedFields({
      ensembleProbability: ensemble,
      accountBalance,
      atrRatio,
    });
  }, [accountBalance, setSignals, setEnsembleProbability, setRegime, setRegimeShiftDetected, updateComputedFields]);

  // FIXED: Also recompute when spotPrice changes (every ticker tick), not only on candle close
  // This ensures signals update in near-real-time using the latest currentCandle
  useEffect(() => {
    const unsub = usePriceStore.subscribe((state) => {
      // Inject currentCandle into candles for real-time signal computation
      if (state.currentCandle && state.candles.length > 0) {
        // Temporarily merge currentCandle into last position for computation
        const tempCandles = [...state.candles.slice(0, -1), state.currentCandle];
        const c = tempCandles;
        if (c.length < 55) return;
        const signals = computeSignals(c);
        if (signals.length === 0) return;
        const newRegime = detectRegime(c);
        setRegime(newRegime);
        setSignals(signals);
        const ensemble = computeEnsemble(signals, newRegime);
        setEnsembleProbability(ensemble);
        const atrRatio = getATRRatio(c);
        updateComputedFields({ ensembleProbability: ensemble, accountBalance, atrRatio });
      }
    });
    return unsub;
  }, [accountBalance, setSignals, setEnsembleProbability, setRegime, updateComputedFields]);

  return { recompute };
}
