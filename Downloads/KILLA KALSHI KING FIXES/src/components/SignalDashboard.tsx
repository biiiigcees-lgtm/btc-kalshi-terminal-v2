// /src/components/SignalDashboard.tsx — FIXED
// REMOVED: useEffect that dispatched auto-analyze on every signal update
// This caused rapid-fire AI calls on every recompute, triggering rate limits
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useSignalStore } from '@/stores/signalStore';
import type { SignalResult } from '@/types';

function SignalCard({ signal }: { signal: SignalResult }) {
  const dirColor = signal.direction === 'bullish' ? '#00ff88' : signal.direction === 'bearish' ? '#ff4466' : '#666680';
  const dirLabel = signal.direction === 'bullish' ? 'BULL ↑' : signal.direction === 'bearish' ? 'BEAR ↓' : 'NEUT —';

  return (
    <motion.div
      key={signal.name + signal.value}
      initial={{ opacity: 0.7 }}
      animate={{ opacity: 1 }}
      className="panel p-2 relative overflow-hidden border-[#1e1e2e]"
      whileHover={{ borderColor: dirColor, transition: { duration: 0.2 } }}
    >
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-display text-[#666680] uppercase tracking-wider truncate">{signal.name}</span>
        <span className="text-[10px] font-mono font-bold" style={{ color: dirColor }}>{dirLabel}</span>
      </div>
      <div className="text-sm font-mono font-bold text-[#e8e8f0] mb-1.5">
        {Math.abs(signal.value) > 1000
          ? signal.value.toLocaleString('en-US', { maximumFractionDigits: 0 })
          : signal.value.toFixed(3)}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-[#1e1e2e] rounded overflow-hidden">
          <motion.div
            className="h-full rounded"
            style={{ background: dirColor }}
            animate={{ width: `${signal.confidence * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <span className="text-[10px] font-mono text-[#666680] w-8 text-right">
          {(signal.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <div className="absolute top-2 right-2 opacity-20">
        <span className="text-[8px] font-mono uppercase">{signal.category.slice(0, 3)}</span>
      </div>
    </motion.div>
  );
}

function SignalSkeleton() {
  return (
    <div className="panel p-2 relative overflow-hidden animate-pulse">
      <div className="flex justify-between items-center mb-1">
        <div className="h-3 w-20 bg-[#1e1e2e] rounded" />
        <div className="h-3 w-12 bg-[#1e1e2e] rounded" />
      </div>
      <div className="h-5 w-16 bg-[#1e1e2e] rounded mb-1.5" />
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-[#1e1e2e] rounded" />
        <div className="h-3 w-8 bg-[#1e1e2e] rounded" />
      </div>
    </div>
  );
}

export default function SignalDashboard() {
  const { signals, ensembleProbability, lastUpdated, regimeShiftDetected } = useSignalStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mark loading complete once signals arrive, with 8s timeout fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (signals.length === 0) {
        setError('Waiting for 55+ candles to compute indicators…');
      }
      setIsLoading(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [signals]);

  useEffect(() => {
    if (signals.length > 0) {
      setIsLoading(false);
      setError(null);
    }
  }, [signals]);

  return (
    <div className="flex flex-col h-full p-2 gap-2">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest">Signal Engine</span>
          {regimeShiftDetected && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#ffaa00]/20 text-[#ffaa00] animate-pulse">
              REGIME SHIFT
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-[#333350]">
          {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}
        </span>
      </div>

      {/* Ensemble bar */}
      <div className="panel p-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest">Ensemble</span>
          <span className={`text-sm font-mono font-bold ${ensembleProbability > 55 ? 'text-[#00ff88]' : ensembleProbability < 45 ? 'text-[#ff4466]' : 'text-[#ffaa00]'}`}>
            {ensembleProbability.toFixed(1)}%
          </span>
        </div>
        <div className="w-full h-2 bg-[#1e1e2e] rounded overflow-hidden relative">
          <div className="absolute inset-y-0 left-1/2 w-px bg-[#333350] z-10" />
          <motion.div
            style={{
              background: ensembleProbability > 55 ? '#00ff88' : ensembleProbability < 45 ? '#ff4466' : '#ffaa00',
              marginLeft: '50%',
              transformOrigin: 'left',
            }}
            animate={{
              width: `${Math.abs(ensembleProbability - 50)}%`,
              marginLeft: ensembleProbability >= 50 ? '50%' : `${ensembleProbability}%`,
            }}
            className="h-full rounded"
            transition={{ type: 'spring', stiffness: 80, damping: 18 }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] font-mono text-[#666680]">BELOW</span>
          <span className="text-[9px] font-mono text-[#666680]">ABOVE</span>
        </div>
      </div>

      {/* Signal grid */}
      <div className="grid grid-cols-2 gap-1.5 flex-1 overflow-y-auto">
        {isLoading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => <SignalSkeleton key={i} />)}
          </>
        ) : error && signals.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center py-8 text-center">
            <span className="text-[#ffaa00] text-lg mb-2">⟳</span>
            <span className="text-[#666680] text-xs font-mono">{error}</span>
          </div>
        ) : signals.length === 0 ? (
          <div className="col-span-2 flex items-center justify-center text-[#333350] text-xs font-mono py-8">
            No indicators available
          </div>
        ) : (
          signals.map((signal) => (
            <SignalCard key={signal.name} signal={signal} />
          ))
        )}
      </div>
    </div>
  );
}
