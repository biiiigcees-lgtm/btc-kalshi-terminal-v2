// /src/components/AIAdvisor.tsx
'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
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

function getTradeColorClass(text: string): string {
  if (/BET UP/.test(text)) return 'text-[#00ff88]';
  if (/BET DOWN/.test(text)) return 'text-[#ff4466]';
  return 'text-[#666680]';
}

function getDirectiveColor(label: string): string {
  if (label === 'BET UP') return 'text-[#00ff88]';
  if (label === 'BET DOWN') return 'text-[#ff4466]';
  return 'text-[#666680]';
}

function renderLine(line: string, lineIndex: number, messageTs: number) {
  const uniqueKey = `${messageTs}-${lineIndex}`;
  
  if (line.startsWith('═══')) {
    return <div key={uniqueKey} className="text-xs font-mono mt-3 mb-1 text-[#4488ff]">{line}</div>;
  }
  if (/BET UP|BET DOWN|NO TRADE/.test(line)) {
    const colorClass = getTradeColorClass(line);
    return <div key={uniqueKey} className={`text-sm font-mono font-bold ${colorClass}`}>{line}</div>;
  }
  if (/POSITIVE EV/.test(line)) {
    return <div key={uniqueKey} className="text-xs font-mono text-[#00ff88]">{line}</div>;
  }
  if (/NEGATIVE EV|REJECT/.test(line)) {
    return <div key={uniqueKey} className="text-xs font-mono text-[#ff4466]">{line}</div>;
  }
  if (/⚠|WARNING|ALERT/.test(line)) {
    return <div key={uniqueKey} className="text-xs font-mono text-[#ffaa00]">{line}</div>;
  }
  return <div key={uniqueKey} className="text-xs font-mono text-[#8888aa]">{line}</div>;
}

// Simple in-memory cache for AI responses
interface CacheEntry {
  result: string;
  timestamp: number;
}
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  backoffMs = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      
      // Don't retry on 4xx errors (client errors)
      if (res.status >= 400 && res.status < 500) {
        return res;
      }
      
      // Success or non-retryable error
      if (res.ok || attempt === maxRetries - 1) {
        return res;
      }
      
      // Retry on 5xx or network errors
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < maxRetries - 1) {
        const delay = backoffMs * Math.pow(2, attempt);
        console.log(`AI request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

export default function AIAdvisor() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'KALSHI BTC INTELLIGENCE TERMINAL — READY\nAI will automatically analyze market conditions and provide trading decisions.', ts: Date.now() }
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const analysisInProgress = useRef(false);
  const { secondsRemaining } = useKalshiWindow();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Prevent race conditions - only one analysis at a time
  const safeAnalyze = useCallback(async () => {
    if (analysisInProgress.current || loading) return;
    analysisInProgress.current = true;
    await handleAnalyze();
    analysisInProgress.current = false;
  }, [loading]);

  // Auto-analysis on mount (after initial data load)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (messages.length <= 1) {
        safeAnalyze();
      }
    }, 5000); // 5 second delay for data to populate
    return () => clearTimeout(timer);
  }, []);

  // Periodic auto-analysis every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      safeAnalyze();
    }, 120000); // 2 minutes
    return () => clearInterval(interval);
  }, [safeAnalyze]);

  // Listen for auto-analyze events from CountdownTimer (immediate trigger when inputs change)
  useEffect(() => {
    const handleAutoAnalyze = (e: CustomEvent) => {
      if (!analysisInProgress.current && !loading) {
        sendToAI(e.detail);
      }
    };
    
    if (typeof globalThis !== 'undefined') {
      globalThis.addEventListener('auto-analyze', handleAutoAnalyze as EventListener);
      return () => globalThis.removeEventListener('auto-analyze', handleAutoAnalyze as EventListener);
    }
  }, [loading]);

  async function sendToAI(text: string) {
    // Check cache first
    const cacheKey = text.slice(0, 200); // Use first 200 chars as cache key
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Using cached AI response');
      setMessages(m => [...m, { role: 'assistant', content: cached.result, ts: Date.now() }]);
      return;
    }
    
    setLoading(true);
    const userMsg: Message = { role: 'user', content: text.slice(0, 500), ts: Date.now() };
    setMessages(m => [...m, userMsg]);

    try {
      const res = await fetchWithRetry('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketContext: text }),
      }, 3, 1000);
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Cache successful response
      responseCache.set(cacheKey, { result: data.result, timestamp: Date.now() });
      
      // Clean up old cache entries periodically
      if (responseCache.size > 50) {
        const now = Date.now();
        for (const [key, entry] of Array.from(responseCache)) {
          if (now - entry.timestamp > CACHE_TTL) {
            responseCache.delete(key);
          }
        }
      }
      
      setMessages(m => [...m, { role: 'assistant', content: data.result, ts: Date.now() }]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      let userMessage = `ERROR: Analysis failed after 3 attempts. ${errorMessage}\n\nPlease try again or check your connection.`;
      
      // Check if it's a Groq quota/error
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
        userMessage = `⚠️ GROQ API RATE LIMIT\n\nThe rate limit has been reached. To continue using AI analysis:\n\n1. Get a free Groq API key at https://console.groq.com/keys\n2. Add GROQ_API_KEY to your .env.local file\n3. The free tier has generous limits for trading applications\n\nError: ${errorMessage}`;
      }
      
      setMessages(m => [...m, { 
        role: 'assistant', 
        content: userMessage,
        ts: Date.now() 
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    const priceState = usePriceStore.getState();
    const signalState = useSignalStore.getState();
    const kalshiState = useKalshiStore.getState();
    const tradeState = useTradeStore.getState();

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

    sendToAI(ctx);
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d14] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e2e]">
        <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest">AI Trade Advisor</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#00ff88] font-mono">● AUTO</span>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className={`px-3 py-1 text-xs font-mono font-bold rounded transition-all border ${loading ? 'bg-[#1e1e2e] text-[#666680] border-[#333350] cursor-not-allowed' : 'bg-[#4488ff] text-white border-[#4488ff] cursor-pointer'}`}
          >
            {loading ? (
              <span className="flex items-center gap-1">
                <span className="pulse-green">◈</span> ANALYZING...
              </span>
            ) : '⚡ ANALYZE NOW'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.map((msg) => {
          const directive = msg.role === 'assistant' ? parseDirective(msg.content) : null;
          return (
            <div key={msg.ts}>
              {msg.role !== 'system' && (
                <div className="text-[9px] text-[#333350] mb-0.5">
                  {msg.role === 'user' ? '› YOU' : '› ADVISOR'} {new Date(msg.ts).toLocaleTimeString()}
                </div>
              )}
              {directive && (
                <div className={`text-2xl font-display font-bold mb-2 ${getDirectiveColor(directive.label)}`}>
                  {directive.label}
                </div>
              )}
              <div className="space-y-0.5">
                {msg.content.split('\n').map((line, j) => renderLine(line, j, msg.ts))}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="text-xs font-mono text-[#4488ff] flex items-center gap-1">
            <span className="pulse-green">▋</span> Processing analysis...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Disclaimer */}
      <div className="px-3 py-2 border-t border-[#1e1e2e]">
        <div className="text-[9px] font-mono text-[#666680] text-center">
          AI-generated analysis only. Not financial advice.
        </div>
      </div>
    </div>
  );
}
