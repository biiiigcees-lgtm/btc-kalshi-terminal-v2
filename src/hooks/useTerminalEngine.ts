// /src/hooks/useTerminalEngine.ts — Hook connecting TerminalEngine to stores
'use client';
import { useEffect, useRef } from 'react';
import { usePriceStore } from '@/stores/priceStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { TerminalEngine } from '@/engine/terminalEngine';

export function useTerminalEngine() {
  const { candles, feedHealth } = usePriceStore();
  const { settings, setTerminalSignal } = useTerminalStore();
  const engineRef = useRef<TerminalEngine | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Initialize engine
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new TerminalEngine();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Run every second
  useEffect(() => {
    if (!engineRef.current) return;

    const process = () => {
      if (feedHealth === 'unhealthy') return;
      if (candles.length < 55) return;

      if (!engineRef.current) return;
      const signal = engineRef.current.process(candles, settings);
      if (signal) {
        setTerminalSignal(signal);
      }
    };

    process();
    intervalRef.current = window.setInterval(process, settings.refreshIntervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [candles, feedHealth, settings, setTerminalSignal]);
}
