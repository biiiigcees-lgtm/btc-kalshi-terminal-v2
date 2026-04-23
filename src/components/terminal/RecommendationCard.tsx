// /src/components/terminal/RecommendationCard.tsx — Main decision display
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { TerminalSignal, TerminalDecision } from '@/types';

const DECISION_CONFIG: Record<TerminalDecision, { label: string; color: string; bg: string; icon: string }> = {
  BUY_YES: { label: 'BUY YES', color: '#00ff88', bg: '#00ff8812', icon: '▲' },
  BUY_NO: { label: 'BUY NO', color: '#ff4466', bg: '#ff446612', icon: '▼' },
  WAIT: { label: 'WAIT', color: '#ffaa00', bg: '#ffaa0012', icon: '◆' },
  REDUCE_EXPOSURE: { label: 'REDUCE EXPOSURE', color: '#ff66cc', bg: '#ff66cc12', icon: '⚡' },
};

const QUALITY_COLORS: Record<string, string> = {
  High: '#00ff88',
  Medium: '#ffaa00',
  Low: '#555570',
};

export default function RecommendationCard({ signal }: { signal: TerminalSignal | null }) {
  const [explainabilityOpen, setExplainabilityOpen] = useState(false);

  if (!signal) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 p-4">
        <div className="text-[10px] font-mono text-[#2a2a3a] uppercase tracking-[0.3em]">Awaiting Signal</div>
        <div className="w-2 h-2 rounded-full bg-[#1a1a2a] animate-pulse" />
      </div>
    );
  }

  const config = DECISION_CONFIG[signal.decision];

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Decision badge */}
      <AnimatePresence mode="wait">
        <motion.div
          key={signal.decision}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center gap-2 py-3 rounded-lg border"
          style={{ borderColor: `${config.color}44`, background: config.bg }}
        >
          <span className="text-lg" style={{ color: config.color }}>{config.icon}</span>
          <span className="text-2xl font-mono font-bold tracking-wider" style={{ color: config.color }}>
            {config.label}
          </span>
          {signal.decisionFlipped && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#ffaa0020] text-[#ffaa00] border border-[#ffaa0030]"
            >
              FLIPPED
            </motion.span>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Confidence + Quality row */}
      <div className="flex items-center gap-3">
        {/* Confidence meter */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-mono text-[#3a3a50] uppercase tracking-wider">Confidence</span>
            <span className="text-sm font-mono font-bold" style={{ color: config.color }}>
              {signal.confidence}
            </span>
          </div>
          <div className="h-2 bg-[#0d0d18] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${signal.confidence}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{ background: config.color }}
            />
          </div>
        </div>

        {/* Trade quality badge */}
        <div
          className="text-[9px] font-mono font-bold px-2 py-1 rounded border"
          style={{
            color: QUALITY_COLORS[signal.tradeQuality],
            borderColor: `${QUALITY_COLORS[signal.tradeQuality]}33`,
            background: `${QUALITY_COLORS[signal.tradeQuality]}0d`,
          }}
        >
          {signal.tradeQuality}
        </div>
      </div>

      {/* Score breakdown */}
      <div className="flex gap-1">
        {[
          { label: 'BULL', value: signal.scoredDecision.bullishScore, color: '#00ff88' },
          { label: 'BEAR', value: signal.scoredDecision.bearishScore, color: '#ff4466' },
          { label: 'NEUT', value: signal.scoredDecision.neutralScore, color: '#555570' },
        ].map((s) => (
          <div key={s.label} className="flex-1 bg-[#0a0a12] rounded p-1.5 text-center">
            <div className="text-[7px] font-mono text-[#3a3a50] uppercase">{s.label}</div>
            <div className="text-xs font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Collapsible explainability */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <button
          onClick={() => setExplainabilityOpen(!explainabilityOpen)}
          className="flex items-center justify-between text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1 hover:text-[#4488ff] transition-colors"
        >
          <span>Explainability</span>
          <span>{explainabilityOpen ? '▼' : '▶'}</span>
        </button>
        <AnimatePresence>
          {explainabilityOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-y-auto space-y-2 flex-1"
            >
              <div>
                <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">Reasoning</div>
                <div className="text-[10px] font-mono text-[#8888aa] leading-relaxed">
                  {signal.explanation}
                </div>
              </div>

              <div>
                <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">Risk</div>
                <div className="text-[10px] font-mono text-[#ffaa00] leading-relaxed">
                  {signal.riskNotes}
                </div>
              </div>

              <div>
                <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">Invalidation</div>
                <div className="text-[10px] font-mono text-[#ff66cc] leading-relaxed">
                  {signal.invalidationConditions}
                </div>
              </div>

              <div>
                <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">What Would Change</div>
                <div className="text-[10px] font-mono text-[#4488ff] leading-relaxed">
                  {signal.whatWouldChangeDecision}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Regime badge */}
      <div className="flex items-center justify-between pt-2 border-t border-[#141420]">
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-mono text-[#2a2a3a] uppercase">Regime</span>
          <span className="text-[9px] font-mono font-bold text-[#8888aa] uppercase">
            {signal.regime.replace(/([A-Z])/g, ' $1').trim()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-mono text-[#2a2a3a] uppercase">Edge</span>
          <span className="text-[9px] font-mono font-bold" style={{ color: signal.edge > 0.1 ? '#00ff88' : '#555570' }}>
            {(signal.edge * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
