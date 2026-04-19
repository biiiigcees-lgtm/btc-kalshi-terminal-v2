// /src/hooks/useSignalEngine.ts
'use client';
import { useCallback } from 'react';
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
    if (c.length < 210) return;

    const signals = computeSignals(c);
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
  }, [accountBalance]);

  return { recompute };
}
