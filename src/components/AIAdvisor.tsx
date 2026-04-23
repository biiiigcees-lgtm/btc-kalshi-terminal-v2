'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePriceStore } from '../stores/priceStore';
import { useSignalStore } from '../stores/signalStore';
import { useKalshiStore } from '../stores/kalshiStore';
import { useTradeStore } from '../stores/tradeStore';
import { useKalshiWindow } from '../hooks/useKalshiWindow';
import { buildContext } from '../utils/contextBuilder';

interface Thought {
  id: number;
  text: string;
  type: 'thinking' | 'decision' | 'risk' | 'signal' | 'timing' | 'system';
  ts: number;
  streaming: boolean;
}

// Global state to prevent concurrent calls
let globalLock = false;
let globalLastRun = 0;
const MIN_INTERVAL = 90_000; // 90 seconds minimum

export let lastAIDirective: 'BET UP' | 'BET DOWN' | 'NO TRADE' | null = null;
export let lastAIAnalysisTime = 0;
export let lastAIBetSize = 0;
export let lastAIConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO EDGE' = 'NO EDGE';

function classifyLine(line: string): Thought['type'] {
  if (/BET UP|BET DOWN|NO TRADE/.test(line)) return 'decision';
  if (/⚠|RISK|WARNING|DANGER|STOP|PAUSE/.test(line)) return 'risk';
  if (/RSI|MACD|EMA|VWAP|BB|ATR|STOCH|ROC|Z-SCORE|KELTNER|SIGNAL/.test(line)) return 'signal';
  if (/WINDOW|TIME|MINUTE|SECOND|TIMING|ENTRY/.test(line)) return 'timing';
  return 'thinking';
}

function typeColor(type: Thought['type']): string {
  switch (type) {
    case 'decision': return '#e8e8f0';
    case 'risk': return '#ffaa00';
    case 'signal': return '#4488ff';
    case 'timing': return '#00ccff';
    default: return '#555570';
  }
}

function DirectivePill({ directive }: { directive: string }) {
  const cfg = {
    'BET UP':   { bg: '#00ff8812', border: '#00ff8840', text: '#00ff88', icon: '▲' },
    'BET DOWN': { bg: '#ff446612', border: '#ff446640', text: '#ff4466', icon: '▼' },
    'NO TRADE': { bg: '#1a1a2a',   border: '#2a2a3a',   text: '#555570', icon: '—' },
  }[directive] || { bg: '#1a1a2a', border: '#2a2a3a', text: '#555570', icon: '—' };

  return (
    <motion.div
      key={directive}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold font-mono tracking-wider"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      <motion.span
        animate={directive !== 'NO TRADE' ? { opacity: [1, 0.4, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.8 }}
      >{cfg.icon}</motion.span>
      {directive}
    </motion.div>
  );
}

function ThoughtLine({ thought, isNew }: { thought: Thought; isNew: boolean }) {
  const [shown, setShown] = useState(isNew ? '' : thought.text);
  const [done, setDone] = useState(!isNew);
  const idx = useRef(0);

  useEffect(() => {
    if (!isNew) return;
    idx.current = 0;
    setShown('');
    setDone(false);
    const id = setInterval(() => {
      if (idx.current < thought.text.length) {
        idx.current++;
        setShown(thought.text.slice(0, idx.current));
      } else {
        setDone(true);
        clearInterval(id);
      }
    }, 6);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thought.id]);

  if (thought.text.trim() === '' || thought.text.startsWith('═══')) {
    return thought.text.startsWith('═══')
      ? <div className="text-[9px] font-mono text-[#1e1e2e] mt-1.5 mb-0.5 border-t border-[#0d0d18] pt-1">{thought.text}</div>
      : <div className="h-0.5" />;
  }

  const color = typeColor(thought.type);

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-start gap-1.5 py-0.5"
    >
      <span className="text-[8px] mt-0.5 flex-shrink-0" style={{ color: `${color}60` }}>
        {thought.type === 'decision' ? '◈' : thought.type === 'risk' ? '⚠' : thought.type === 'signal' ? '◦' : thought.type === 'timing' ? '⏱' : '·'}
      </span>
      <span className="text-[10px] font-mono leading-relaxed flex-1" style={{ color }}>
        {shown}
        {!done && isNew && (
          <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.5 }} style={{ color: '#4488ff' }}>▋</motion.span>
        )}
      </span>
    </motion.div>
  );
}

export default function AIAdvisor() {
  const [thoughts, setThoughts] = useState<Thought[]>([{
    id: 0,
    text: 'Initializing intelligence engine... waiting for live signals.',
    type: 'system',
    ts: Date.now(),
    streaming: false,
  }]);
  const [directive, setDirective] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nextRunIn, setNextRunIn] = useState(0);
  const [lastUpdated, setLastUpdated] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const newThoughtIds = useRef<Set<number>>(new Set());
  const { secondsRemaining } = useKalshiWindow();
  const prevSecs = useRef(secondsRemaining);
  const thoughtCounter = useRef(1);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [thoughts, isAnalyzing]);

  // Countdown to next analysis
  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((MIN_INTERVAL - (Date.now() - globalLastRun)) / 1000));
      setNextRunIn(left);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const addThoughts = useCallback((lines: string[]) => {
    const newOnes: Thought[] = lines
      .filter(l => l !== undefined)
      .map(text => {
        const id = thoughtCounter.current++;
        newThoughtIds.current.add(id);
        return { id, text, type: classifyLine(text), ts: Date.now(), streaming: true };
      });
    setThoughts(prev => [...prev.slice(-60), ...newOnes]); // keep last 60 thoughts
    // Clear streaming flags after animation
    setTimeout(() => {
      newThoughtIds.current.clear();
    }, newOnes.length * 200 + 3000);
  }, []);

  const runAnalysis = useCallback(async () => {
    if (globalLock) return;
    if (Date.now() - globalLastRun < MIN_INTERVAL) return;

    const priceS = usePriceStore.getState();
    const signalS = useSignalStore.getState();
    const kalshiS = useKalshiStore.getState();
    const tradeS = useTradeStore.getState();

    if (priceS.spotPrice === 0 || signalS.signals.length === 0) return;

    globalLock = true;
    globalLastRun = Date.now();
    setIsAnalyzing(true);

    // Add "thinking" indicator
    const thinkId = thoughtCounter.current++;
    newThoughtIds.current.add(thinkId);
    setThoughts(prev => [...prev, { id: thinkId, text: `Scanning market at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}...`, type: 'system', ts: Date.now(), streaming: true }]);

    try {
      const ctx = buildContext({
        spotPrice: priceS.spotPrice,
        coingeckoPrice: priceS.coingeckoPrice,
        divergencePct: priceS.divergencePct,
        currentCandle: priceS.currentCandle,
        secondsRemaining,
        targetPrice: kalshiS.targetPrice,
        impliedProbability: kalshiS.impliedProbability,
        regime: signalS.regime,
        signals: signalS.signals,
        ensembleProbability: signalS.ensembleProbability,
        edge: kalshiS.edge,
        expectedValue: kalshiS.expectedValue,
        kellyFraction: kalshiS.kellyFraction,
        recommendedBet: kalshiS.recommendedBet,
        cappedFraction: kalshiS.cappedFraction,
        volatilityAdjusted: kalshiS.volatilityAdjusted,
        accountBalance: tradeS.accountBalance,
        intendedBet: tradeS.intendedBet,
        rollingWinRate20: tradeS.rollingWinRate20,
        profitFactor: tradeS.profitFactor,
        sharpeRatio: tradeS.sharpeRatio,
        consecutiveLosses: tradeS.consecutiveLosses,
        totalPnL: tradeS.totalPnL,
      });

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketContext: ctx }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

      // Parse directive
      const d = /BET UP/i.test(data.result) ? 'BET UP' : /BET DOWN/i.test(data.result) ? 'BET DOWN' : 'NO TRADE';
      const conf = /HIGH/i.test(data.result) ? 'HIGH' : /MEDIUM/i.test(data.result) ? 'MEDIUM' : /LOW/i.test(data.result) ? 'LOW' : 'NO EDGE';

      lastAIDirective = d as typeof lastAIDirective;
      lastAIAnalysisTime = Date.now();
      lastAIConfidence = conf as typeof lastAIConfidence;
      setDirective(d);
      setConfidence(conf);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      // Stream thoughts line by line with delays for natural feel
      const lines = data.result.split('\n').filter((l: string) => l.trim());
      for (let i = 0; i < lines.length; i++) {
        const delay = i * 180;
        setTimeout(() => {
          const id = thoughtCounter.current++;
          newThoughtIds.current.add(id);
          setThoughts(prev => [...prev.slice(-60), {
            id, text: lines[i], type: classifyLine(lines[i]), ts: Date.now(), streaming: true
          }]);
        }, delay);
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addThoughts([`⚠ Analysis error: ${msg}`]);
    } finally {
      setIsAnalyzing(false);
      globalLock = false;
    }
  }, [secondsRemaining, addThoughts]);

  // Auto-analyze on startup
  useEffect(() => {
    const t = setTimeout(() => runAnalysis(), 10_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-analyze every 90 seconds
  useEffect(() => {
    const id = setInterval(() => runAnalysis(), MIN_INTERVAL);
    return () => clearInterval(id);
  }, [runAnalysis]);

  // Auto-analyze when window enters last 3 minutes
  useEffect(() => {
    if (prevSecs.current > 180 && secondsRemaining <= 180) {
      runAnalysis();
    }
    prevSecs.current = secondsRemaining;
  }, [secondsRemaining, runAnalysis]);

  const directiveColor = directive === 'BET UP' ? '#00ff88' : directive === 'BET DOWN' ? '#ff4466' : '#555570';

  return (
    <div className="flex flex-col h-full bg-[#05050a]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#0d0d18] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-[#2a2a3a] uppercase tracking-[0.25em]">INTELLIGENCE</span>
          <AnimatePresence>
            {isAnalyzing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-2 h-2 border border-[#4488ff] border-t-transparent rounded-full" />
                <span className="text-[8px] text-[#4488ff] font-mono">SCANNING</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          {!isAnalyzing && nextRunIn > 0 && (
            <span className="text-[8px] font-mono text-[#1e1e2e]">{nextRunIn}s</span>
          )}
          {lastUpdated && (
            <span className="text-[8px] font-mono text-[#2a2a3a]">{lastUpdated}</span>
          )}
          {directive && <DirectivePill directive={directive} />}
        </div>
      </div>

      {/* Confidence strip */}
      <AnimatePresence>
        {confidence && confidence !== 'NO EDGE' && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-[#0d0d18]">
            <div className="px-3 py-1 flex items-center gap-2">
              <span className="text-[8px] font-mono text-[#2a2a3a]">CONFIDENCE</span>
              <span className={`text-[9px] font-bold font-mono ${confidence === 'HIGH' ? 'text-[#00ff88]' : confidence === 'MEDIUM' ? 'text-[#ffaa00]' : 'text-[#ff4466]'}`}>
                {confidence}
              </span>
              <span className="text-[8px] font-mono" style={{ color: `${directiveColor}80` }}>
                {directive === 'BET UP' ? '▲ BULLISH BIAS' : directive === 'BET DOWN' ? '▼ BEARISH BIAS' : '— NEUTRAL'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thought stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-0">
        {thoughts.map((t) => (
          <ThoughtLine
            key={t.id}
            thought={t}
            isNew={newThoughtIds.current.has(t.id)}
          />
        ))}
        {isAnalyzing && (
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex items-center gap-1.5 py-0.5">
            <span className="text-[8px] text-[#1e1e2e]">·</span>
            <span className="text-[9px] font-mono text-[#2a2a3a]">processing...</span>
          </motion.div>
        )}
        <div className="h-1" />
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-[#0d0d18] flex-shrink-0 flex justify-between items-center">
        <span className="text-[7px] font-mono text-[#141420]">AUTO · 90S · WINDOW −3MIN</span>
        <span className="text-[7px] font-mono text-[#141420]">NOT FINANCIAL ADVICE</span>
      </div>
    </div>
  );
}
