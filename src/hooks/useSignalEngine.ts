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
    const candles = state.candles;
    if (candles.length < 55) return;
    const signals = computeSignals(candles);
    if (signals.length === 0) return;
    const regime = detectRegime(candles);
    const prevRegime = useSignalStore.getState().regime;
    setRegimeShiftDetected(regime.trend !== prevRegime.trend || regime.volatility !== prevRegime.volatility);
    setRegime(regime);
    setSignals(signals);
    const ensemble = computeEnsemble(signals, regime);
    setEnsembleProbability(ensemble);
    updateComputedFields({ ensembleProbability: ensemble, accountBalance, atrRatio: getATRRatio(candles) });
  }, [accountBalance, setSignals, setEnsembleProbability, setRegime, setRegimeShiftDetected, updateComputedFields]);

  // Recompute on every price tick using live currentCandle
  useEffect(() => {
    const unsub = usePriceStore.subscribe(
      (state) => state.spotPrice,
      () => {
        const state = usePriceStore.getState();
        if (!state.currentCandle || state.candles.length < 55) return;
        const merged = [...state.candles.slice(0, -1), state.currentCandle];
        if (merged.length < 55) return;
        const signals = computeSignals(merged);
        if (signals.length === 0) return;
        const regime = detectRegime(merged);
        setRegime(regime);
        setSignals(signals);
        const ensemble = computeEnsemble(signals, regime);
        setEnsembleProbability(ensemble);
        updateComputedFields({ ensembleProbability: ensemble, accountBalance, atrRatio: getATRRatio(merged) });
      }
    );
    return unsub;
  }, [accountBalance, setSignals, setEnsembleProbability, setRegime, updateComputedFields]);

  return { recompute };
}
