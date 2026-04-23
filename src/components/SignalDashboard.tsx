'use client';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useSignalStore } from '@/stores/signalStore';
import type { SignalResult } from '@/types';

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  momentum:     { label: 'MOMENTUM',     color: '#4488ff' },
  meanReversion:{ label: 'MEAN REV',     color: '#aa44ff' },
  trend:        { label: 'TREND',        color: '#00ff88' },
};

function ConfidenceBar({ confidence, direction }: { confidence: number; direction: string }) {
  const color = direction === 'bullish' ? '#00ff88' : direction === 'bearish' ? '#ff4466' : '#555570';
  return (
    <div className="flex-1 h-1 bg-[#0d0d18] rounded overflow-hidden">
      <motion.div
        animate={{ width: `${confidence * 100}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="h-full rounded"
        style={{ background: color }}
      />
    </div>
  );
}

function SignalRow({ signal }: { signal: SignalResult }) {
  const dirColor = signal.direction === 'bullish' ? '#00ff88' : signal.direction === 'bearish' ? '#ff4466' : '#555570';
  const dirIcon = signal.direction === 'bullish' ? '▲' : signal.direction === 'bearish' ? '▼' : '—';
  const val = Math.abs(signal.value) > 999
    ? signal.value.toFixed(0)
    : Math.abs(signal.value) > 9
    ? signal.value.toFixed(1)
    : signal.value.toFixed(3);

  return (
    <motion.div
      layout
      className="flex items-center gap-1.5 py-0.5 border-b border-[#0a0a12]"
    >
      <span className="text-[8px] font-mono w-2" style={{ color: `${dirColor}80` }}>{dirIcon}</span>
      <span className="text-[9px] font-mono text-[#3a3a50] flex-1 truncate">{signal.name}</span>
      <ConfidenceBar confidence={signal.confidence} direction={signal.direction} />
      <span className="text-[8px] font-mono w-8 text-right" style={{ color: dirColor }}>{(signal.confidence * 100).toFixed(0)}%</span>
      <span className="text-[8px] font-mono w-10 text-right text-[#2a2a3a]">{val}</span>
    </motion.div>
  );
}

function CategorySection({ category, signals }: { category: string; signals: SignalResult[] }) {
  const cfg = CATEGORY_CONFIG[category] || { label: category.toUpperCase(), color: '#555570' };
  const bull = signals.filter(s => s.direction === 'bullish').length;
  const bear = signals.filter(s => s.direction === 'bearish').length;
  const total = signals.length;
  const score = total > 0 ? ((bull - bear) / total) : 0;

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1 px-0.5">
        <span className="text-[7px] font-mono uppercase tracking-[0.2em]" style={{ color: `${cfg.color}60` }}>{cfg.label}</span>
        <div className="flex items-center gap-1">
          <span className="text-[7px] font-mono text-[#00ff88]">{bull}▲</span>
          <span className="text-[7px] font-mono text-[#ff4466]">{bear}▼</span>
          <div className="w-12 h-1 bg-[#0d0d18] rounded overflow-hidden ml-1">
            <motion.div
              animate={{ width: `${Math.abs(score) * 50}%`, marginLeft: score >= 0 ? '50%' : `${50 + score * 50}%` }}
              transition={{ duration: 0.5 }}
              className="h-full rounded"
              style={{ background: score > 0 ? '#00ff88' : '#ff4466' }}
            />
          </div>
        </div>
      </div>
      {signals.map(s => <SignalRow key={s.name} signal={s} />)}
    </div>
  );
}

function ConfluenceMeter({ signals }: { signals: SignalResult[] }) {
  const bull = signals.filter(s => s.direction === 'bullish').length;
  const bear = signals.filter(s => s.direction === 'bearish').length;
  const total = signals.length;
  const bullPct = total > 0 ? (bull / total) * 100 : 50;
  const bearPct = total > 0 ? (bear / total) * 100 : 50;
  const dominant = bull >= bear ? 'BULL' : 'BEAR';
  const dominantPct = Math.max(bullPct, bearPct);
  const confluenceLevel = dominantPct >= 80 ? 'STRONG' : dominantPct >= 65 ? 'MODERATE' : dominantPct >= 55 ? 'WEAK' : 'MIXED';
  const levelColor = dominantPct >= 80 ? '#00ff88' : dominantPct >= 65 ? '#ffaa00' : '#555570';

  return (
    <div className="bg-[#07070e] border border-[#0d0d18] rounded p-2 mb-2 flex-shrink-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-[0.2em]">SIGNAL CONFLUENCE</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-mono font-bold" style={{ color: dominant === 'BULL' ? '#00ff88' : '#ff4466' }}>
            {dominant}
          </span>
          <span className="text-[8px] font-mono" style={{ color: levelColor }}>{confluenceLevel}</span>
        </div>
      </div>
      {/* Bull/Bear bar */}
      <div className="flex h-1.5 rounded overflow-hidden gap-px">
        <motion.div animate={{ width: `${bullPct}%` }} transition={{ duration: 0.6 }} className="bg-[#00ff8888] rounded-l" />
        <motion.div animate={{ width: `${bearPct}%` }} transition={{ duration: 0.6 }} className="bg-[#ff446688] rounded-r" />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[7px] font-mono text-[#00ff8860]">{bull} BULL</span>
        <span className="text-[7px] font-mono text-[#444460]">{total - bull - bear} NEUTRAL</span>
        <span className="text-[7px] font-mono text-[#ff446660]">{bear} BEAR</span>
      </div>
    </div>
  );
}

export default function SignalDashboard() {
  const { signals, ensembleProbability, lastUpdated, regimeShiftDetected } = useSignalStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (signals.length > 0) setIsLoading(false);
  }, [signals]);

  // Group signals by category
  const grouped = signals.reduce<Record<string, SignalResult[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-[#05050a]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#0d0d18] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-[#2a2a3a] uppercase tracking-[0.2em]">SIGNAL ENGINE</span>
          {regimeShiftDetected && (
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}
              className="text-[7px] font-mono text-[#ffaa00] bg-[#ffaa0015] px-1.5 py-0.5 rounded">
              REGIME SHIFT
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-mono text-[#1e1e2e]">{signals.length} signals</span>
          {lastUpdated > 0 && (
            <span className="text-[7px] font-mono text-[#1e1e2e]">
              {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Ensemble strip */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#0d0d18] flex-shrink-0">
        <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider">ENSEMBLE</span>
        <div className="flex-1 h-1.5 bg-[#0d0d18] rounded overflow-hidden relative">
          <div className="absolute inset-y-0 left-1/2 w-px bg-[#1a1a2a]" />
          <motion.div
            animate={{
              width: `${Math.abs(ensembleProbability - 50)}%`,
              left: ensembleProbability >= 50 ? '50%' : `${ensembleProbability}%`,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute h-full rounded"
            style={{ background: ensembleProbability > 55 ? '#00ff88' : ensembleProbability < 45 ? '#ff4466' : '#ffaa00' }}
          />
        </div>
        <motion.span
          key={ensembleProbability}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[9px] font-bold font-mono w-10 text-right"
          style={{ color: ensembleProbability > 55 ? '#00ff88' : ensembleProbability < 45 ? '#ff4466' : '#ffaa00' }}
        >
          {ensembleProbability.toFixed(1)}%
        </motion.span>
      </div>

      {/* Signals */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2">
        {isLoading && signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              className="w-4 h-4 border border-[#1e1e2e] border-t-[#4488ff] rounded-full" />
            <span className="text-[9px] font-mono text-[#1e1e2e]">Waiting for 55+ candles...</span>
          </div>
        ) : signals.length === 0 ? (
          <div className="text-center text-[#1e1e2e] text-[9px] font-mono py-8">No signals available</div>
        ) : (
          <>
            <ConfluenceMeter signals={signals} />
            {['momentum', 'meanReversion', 'trend'].map(cat =>
              grouped[cat]?.length ? (
                <CategorySection key={cat} category={cat} signals={grouped[cat]} />
              ) : null
            )}
          </>
        )}
      </div>
    </div>
  );
}
