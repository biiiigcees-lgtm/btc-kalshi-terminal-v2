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
interface Message { role: MessageRole; content: string; ts: number; }

function parseDirective(text: string): { label: string; color: string } | null {
  if (/BET UP/i.test(text)) return { label: 'BET UP', color: '#00ff88' };
  if (/BET DOWN/i.test(text)) return { label: 'BET DOWN', color: '#ff4466' };
  if (/NO TRADE/i.test(text)) return { label: 'NO TRADE', color: '#666680' };
  return null;
}

function getDirectiveColor(label: string): string {
  if (label === 'BET UP') return 'text-[#00ff88]';
  if (label === 'BET DOWN') return 'text-[#ff4466]';
  return 'text-[#666680]';
}

function renderLine(line: string, lineIndex: number, messageTs: number) {
  const key = `${messageTs}-${lineIndex}`;
  if (line.startsWith('═══')) return <div key={key} className="text-[11px] font-mono mt-2 mb-0.5 text-[#4488ff] border-b border-[#1e1e2e] pb-0.5">{line}</div>;
  if (/BET UP|BET DOWN|NO TRADE/.test(line)) {
    const color = /BET UP/.test(line) ? 'text-[#00ff88]' : /BET DOWN/.test(line) ? 'text-[#ff4466]' : 'text-[#666680]';
    return <div key={key} className={`text-sm font-mono font-bold ${color}`}>{line}</div>;
  }
  if (/POSITIVE EV/.test(line)) return <div key={key} className="text-[11px] font-mono text-[#00ff88]">{line}</div>;
  if (/NEGATIVE EV|REJECT/.test(line)) return <div key={key} className="text-[11px] font-mono text-[#ff4466]">{line}</div>;
  if (/⚠|WARNING|ALERT/.test(line)) return <div key={key} className="text-[11px] font-mono text-[#ffaa00]">{line}</div>;
  if (line.trim() === '') return <div key={key} className="h-1" />;
  return <div key={key} className="text-[11px] font-mono text-[#8888aa] leading-relaxed">{line}</div>;
}

// FIXED: Single global lock prevents any concurrent or rapid-fire requests
let globalAnalysisInProgress = false;
let globalLastAnalysisTime = 0;
const ANALYSIS_COOLDOWN = 20_000; // 20 seconds minimum between analyses

export default function AIAdvisor() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'system',
    content: 'KALSHI BTC INTELLIGENCE TERMINAL — READY\nAI will automatically analyze when signals are live.',
    ts: Date.now()
  }]);
  const [loading, setLoading] = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { secondsRemaining } = useKalshiWindow();

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cooldown countdown display
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - globalLastAnalysisTime;
      const left = Math.max(0, Math.ceil((ANALYSIS_COOLDOWN - elapsed) / 1000));
      setCooldownLeft(left);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const runAnalysis = useCallback(async () => {
    // FIXED: Hard global lock — no concurrent or duplicate requests
    if (globalAnalysisInProgress) return;
    const now = Date.now();
    if (now - globalLastAnalysisTime < ANALYSIS_COOLDOWN) return;

    const priceState = usePriceStore.getState();
    const signalState = useSignalStore.getState();
    const kalshiState = useKalshiStore.getState();
    const tradeState = useTradeStore.getState();

    // Don't analyze if we have no live data
    if (priceState.spotPrice === 0) return;
    if (signalState.signals.length === 0) return;

    globalAnalysisInProgress = true;
    globalLastAnalysisTime = now;
    setLoading(true);

    try {
      const ctx = buildContext({
        spotPrice: priceState.spotPrice,
        coingeckoPrice: priceState.coingeckoPrice,
        divergencePct: priceState.divergencePct,
        currentCandle: priceState.currentCandle,
        secondsRemaining,
        targetPrice: kalshiState.targetPrice,
        impliedProbability: kalshiState.impliedProbability,
        regime: signalState.regime,
        signals: signalState.signals,
        ensembleProbability: signalState.ensembleProbability,
        edge: kalshiState.edge,
        expectedValue: kalshiState.expectedValue,
        kellyFraction: kalshiState.kellyFraction,
        recommendedBet: kalshiState.recommendedBet,
        cappedFraction: kalshiState.cappedFraction,
        volatilityAdjusted: kalshiState.volatilityAdjusted,
        accountBalance: tradeState.accountBalance,
        intendedBet: tradeState.intendedBet,
        rollingWinRate20: tradeState.rollingWinRate20,
        profitFactor: tradeState.profitFactor,
        sharpeRatio: tradeState.sharpeRatio,
        consecutiveLosses: tradeState.consecutiveLosses,
        totalPnL: tradeState.totalPnL,
      });

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketContext: ctx }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setMessages(m => [...m, {
        role: 'assistant',
        content: data.result,
        ts: Date.now()
      }]);
      setLastAnalyzed(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(m => [...m, {
        role: 'assistant',
        content: `⚠ Analysis error: ${msg}`,
        ts: Date.now()
      }]);
    } finally {
      setLoading(false);
      globalAnalysisInProgress = false;
    }
  }, [secondsRemaining]);

  // Auto-analyze once on mount after 8s (gives signals time to compute)
  useEffect(() => {
    const timer = setTimeout(() => { runAnalysis(); }, 8000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-analyze every 3 minutes
  useEffect(() => {
    const id = setInterval(() => { runAnalysis(); }, 180_000);
    return () => clearInterval(id);
  }, [runAnalysis]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e2e] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest">AI Trade Advisor</span>
          {loading && (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="text-[9px] text-[#4488ff]"
            >● THINKING</motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastAnalyzed && !loading && (
            <span className="text-[9px] text-[#333350]">
              {lastAnalyzed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={runAnalysis}
            disabled={loading || cooldownLeft > 0}
            className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-all ${
              loading || cooldownLeft > 0
                ? 'border-[#1e1e2e] text-[#333350] cursor-not-allowed'
                : 'border-[#4488ff] text-[#4488ff] hover:bg-[#4488ff11]'
            }`}
          >
            {loading ? '⟳ ANALYZING' : cooldownLeft > 0 ? `⏱ ${cooldownLeft}s` : '⚡ ANALYZE'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.map((msg) => {
          const directive = msg.role === 'assistant' ? parseDirective(msg.content) : null;
          return (
            <AnimatePresence key={msg.ts}>
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {msg.role !== 'system' && (
                  <div className="text-[9px] text-[#333350] mb-0.5">
                    {msg.role === 'user' ? '› YOU' : '› ADVISOR'} {new Date(msg.ts).toLocaleTimeString()}
                  </div>
                )}
                {directive && (
                  <div className={`text-xl font-display font-bold mb-1 ${getDirectiveColor(directive.label)}`}>
                    {directive.label}
                  </div>
                )}
                <div className="space-y-0">
                  {msg.content.split('\n').map((line, j) => renderLine(line, j, msg.ts))}
                </div>
              </motion.div>
            </AnimatePresence>
          );
        })}
        {loading && (
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="text-[11px] font-mono text-[#4488ff] flex items-center gap-1"
          >
            <span>▋</span> Processing market intelligence...
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[#1e1e2e] flex-shrink-0">
        <div className="text-[9px] font-mono text-[#333350] text-center">
          AI analysis only · Not financial advice · Auto-refreshes every 3 min
        </div>
      </div>
    </div>
  );
}
