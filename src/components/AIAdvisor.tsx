'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePriceStore } from '../stores/priceStore';
import { useSignalStore } from '../stores/signalStore';
import { useKalshiStore } from '../stores/kalshiStore';
import { useTradeStore } from '../stores/tradeStore';
import { useKalshiWindow } from '../hooks/useKalshiWindow';
import { buildContext } from '../utils/contextBuilder';

type MessageRole = 'user' | 'assistant' | 'system';
interface Message { role: MessageRole; content: string; ts: number; stream?: boolean; }

// Global lock — no concurrent requests ever
let globalLock = false;
let globalLastRun = 0;
const COOLDOWN = 25_000;

export let lastAIDirective: 'BET UP' | 'BET DOWN' | 'NO TRADE' | null = null;
export let lastAIAnalysisTime = 0;

function extractDirective(text: string): 'BET UP' | 'BET DOWN' | 'NO TRADE' | null {
  if (/BET UP/i.test(text)) return 'BET UP';
  if (/BET DOWN/i.test(text)) return 'BET DOWN';
  if (/NO TRADE/i.test(text)) return 'NO TRADE';
  return null;
}

function StreamingText({ text, onDone }: { text: string; onDone: () => void }) {
  const [shown, setShown] = useState('');
  const iRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    iRef.current = 0;
    setShown('');
    doneRef.current = false;
    const id = setInterval(() => {
      if (iRef.current < text.length) {
        iRef.current++;
        setShown(text.slice(0, iRef.current));
      } else if (!doneRef.current) {
        doneRef.current = true;
        clearInterval(id);
        onDone();
      }
    }, 7);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const lines = shown.split('\n');
  const isDone = iRef.current >= text.length;

  return (
    <div className="space-y-0">
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1;
        if (line.startsWith('═══')) return <div key={i} className="text-[10px] font-mono mt-2 mb-0.5 text-[#4488ff] border-b border-[#1a1a2e] pb-0.5">{line}</div>;
        if (/^(BET UP|BET DOWN|NO TRADE)$/.test(line.trim())) return null;
        if (/POSITIVE EV|✓/.test(line)) return <div key={i} className="text-[11px] font-mono text-[#00ff88]">{line}</div>;
        if (/NEGATIVE EV|✗|REJECT/.test(line)) return <div key={i} className="text-[11px] font-mono text-[#ff4466]">{line}</div>;
        if (/⚠|WARNING|ALERT|RISK/.test(line)) return <div key={i} className="text-[11px] font-mono text-[#ffaa00]">{line}</div>;
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return (
          <div key={i} className="text-[11px] font-mono text-[#8888aa] leading-relaxed">
            {line}
            {!isDone && isLast && (
              <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="text-[#4488ff]">▋</motion.span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderStatic(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('═══')) return <div key={i} className="text-[10px] font-mono mt-2 mb-0.5 text-[#4488ff] border-b border-[#1a1a2e] pb-0.5">{line}</div>;
    if (/^(BET UP|BET DOWN|NO TRADE)$/.test(line.trim())) return null;
    if (/POSITIVE EV|✓/.test(line)) return <div key={i} className="text-[11px] font-mono text-[#00ff88]">{line}</div>;
    if (/NEGATIVE EV|✗|REJECT/.test(line)) return <div key={i} className="text-[11px] font-mono text-[#ff4466]">{line}</div>;
    if (/⚠|WARNING|ALERT|RISK/.test(line)) return <div key={i} className="text-[11px] font-mono text-[#ffaa00]">{line}</div>;
    if (line.trim() === '') return <div key={i} className="h-1" />;
    return <div key={i} className="text-[11px] font-mono text-[#8888aa] leading-relaxed">{line}</div>;
  });
}

export default function AIAdvisor() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'system',
    content: 'KALSHI BTC INTELLIGENCE TERMINAL — READY\nAuto-analysis begins in ~10s once signals are live.',
    ts: Date.now()
  }]);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [lastTime, setLastTime] = useState('');
  const [streamingIdx, setStreamingIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { secondsRemaining } = useKalshiWindow();
  const prevSecs = useRef(secondsRemaining);

  // Auto-scroll on every change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Cooldown ticker
  useEffect(() => {
    const id = setInterval(() => {
      setCooldown(Math.max(0, Math.ceil((COOLDOWN - (Date.now() - globalLastRun)) / 1000)));
    }, 500);
    return () => clearInterval(id);
  }, []);

  const runAnalysis = useCallback(async (trigger = 'manual') => {
    if (globalLock) return;
    if (Date.now() - globalLastRun < COOLDOWN) return;
    const priceS = usePriceStore.getState();
    const signalS = useSignalStore.getState();
    const kalshiS = useKalshiStore.getState();
    const tradeS = useTradeStore.getState();
    if (priceS.spotPrice === 0 || signalS.signals.length === 0) return;

    globalLock = true;
    globalLastRun = Date.now();
    setLoading(true);

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

      const d = extractDirective(data.result);
      lastAIDirective = d;
      lastAIAnalysisTime = Date.now();
      setLastTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      setMessages(prev => {
        const next = [...prev, { role: 'assistant' as MessageRole, content: data.result, ts: Date.now(), stream: true }];
        setStreamingIdx(next.length - 1);
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(m => [...m, { role: 'assistant', content: `⚠ ${msg}`, ts: Date.now() }]);
    } finally {
      setLoading(false);
      globalLock = false;
    }
  }, [secondsRemaining]);

  // Startup auto-analyze
  useEffect(() => {
    const t = setTimeout(() => runAnalysis('startup'), 10_000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every 2 minutes
  useEffect(() => {
    const id = setInterval(() => runAnalysis('2min'), 120_000);
    return () => clearInterval(id);
  }, [runAnalysis]);

  // When window enters last 3 minutes
  useEffect(() => {
    if (prevSecs.current > 180 && secondsRemaining <= 180) {
      runAnalysis('window-3min');
    }
    prevSecs.current = secondsRemaining;
  }, [secondsRemaining, runAnalysis]);

  return (
    <div className="flex flex-col h-full bg-[#07070f]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a2a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-[#444460] uppercase tracking-[0.2em]">AI INTELLIGENCE</span>
          <AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-2.5 h-2.5 border border-[#4488ff] border-t-transparent rounded-full" />
                <span className="text-[9px] text-[#4488ff] font-mono">SCANNING</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          {lastTime && <span className="text-[9px] text-[#333350] font-mono">{lastTime}</span>}
          <button
            onClick={() => runAnalysis('manual')}
            disabled={loading || cooldown > 0}
            className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-all active:scale-95 ${
              loading || cooldown > 0 ? 'border-[#1a1a2a] text-[#333350] cursor-not-allowed' : 'border-[#4488ff] text-[#4488ff] hover:bg-[#4488ff15]'
            }`}
          >
            {loading ? '⟳' : cooldown > 0 ? `${cooldown}s` : '⚡'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-2">
        {messages.map((msg, idx) => {
          const isStreaming = msg.stream && idx === streamingIdx;
          return (
            <motion.div key={msg.ts}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {msg.role === 'user' && (
                <div className="text-[9px] text-[#1e1e2e] font-mono italic">{msg.content}</div>
              )}
              {msg.role === 'system' && (
                <div className="text-[10px] text-[#333350] font-mono space-y-0.5">
                  {msg.content.split('\n').map((l, i) => <div key={i}>{l}</div>)}
                </div>
              )}
              {msg.role === 'assistant' && (
                <div>
                  {isStreaming
                    ? <StreamingText text={msg.content} onDone={() => setStreamingIdx(null)} />
                    : renderStatic(msg.content)
                  }
                </div>
              )}
            </motion.div>
          );
        })}
        {loading && (
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
            className="text-[11px] font-mono text-[#4488ff] flex items-center gap-2">
            <span>◈</span> Processing market intelligence...
          </motion.div>
        )}
        <div className="h-2" />
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-[#1a1a2a] flex-shrink-0 flex justify-between">
        <span className="text-[8px] font-mono text-[#1e1e2e]">NOT FINANCIAL ADVICE</span>
        <span className="text-[8px] font-mono text-[#1e1e2e]">AUTO · 2MIN · WINDOW −3MIN</span>
      </div>
    </div>
  );
}
