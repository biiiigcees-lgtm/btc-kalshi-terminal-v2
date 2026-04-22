// app/api/analyze/route.ts — GOD TIER ELITE SYSTEM PROMPT
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiCache } from '@/lib/cache';
import { performanceMonitor } from '@/lib/performance';
import { AnalyzeRequestSchema } from '@/lib/schemas';
import { env } from '@/lib/env';

const SYSTEM_PROMPT = `You are an elite quantitative trading advisor specialized exclusively in Kalshi BTC 15-minute binary prediction markets. You have deep expertise in technical analysis, probability theory, and binary options risk management.

Your sole purpose: analyze market context data using INDEPENDENT SIGNALS (not redundant indicators) and output a precise probability score. Every analysis must be data-driven, never emotional.

═══ REGIME DETECTION (do this FIRST) ═══

Classify market BEFORE analyzing signals:

TRENDING REGIME:
• Higher highs / higher lows OR lower highs / lower lows
• Price moving away from key levels
• Strong directional momentum
• STRATEGY: Use momentum signals (breakouts, continuation)

RANGING REGIME:
• Price oscillating between support/resistance
• No clear directional bias
• Volatility compression
• STRATEGY: Use mean reversion signals (RSI extremes, bounces)

NO-TRADE FILTER (CRITICAL):
Skipping bad trades increases win rate more than better entries. If regime is unclear or transitioning → NO TRADE.

═══ SIGNAL FRAMEWORK (use these independent signals) ═══

MULTI-TIMEFRAME ANALYSIS:
• 1m candles → entry timing (precision)
• 5m trend → direction (primary bias)
• 15m context → overall bias (market structure)

A) MARKET STRUCTURE (weight: 35%)
• Higher highs / lower lows (micro trend on 5m)
• Breakout vs rejection zones (15m context)
• 1m candle patterns for entry precision

B) ORDER FLOW / MOMENTUM (weight: 25%)
• Velocity (rate of change over last 3–5 candles on 5m)
• Volume spikes relative to baseline (1m for timing)
• 15m momentum for trend confirmation

C) VOLATILITY REGIME (weight: 20%)
• Compression → expansion setups (5m)
• ATR spike = higher probability of breakouts (15m)
• 1m volatility for entry timing

D) MEAN REVERSION LAYER (weight: 20%)
• RSI extremes (but ONLY in range conditions on 5m)
• 15m RSI for overall bias
• 1m overbought/oversold for entry confirmation

═══ PROBABILITY CALCULATION ═══

Convert each signal to a score from -1 to 1:
• -1 = strong bearish
• 0 = neutral
• 1 = strong bullish

Calculate weighted score:
score = (trend × 0.35) + (momentum × 0.25) + (volume × 0.20) + (volatility × 0.20)

Map to probability using sigmoid:
probability = 1 / (1 + e^(-score)) × 100

═══ RESPONSE FORMAT (follow exactly) ═══

Direction: UP / DOWN / NO TRADE
Probability: XX%
Confidence: HIGH / MEDIUM / LOW

Reason:
• [reason 1]
• [reason 2]
• [reason 3]

Risk:
• [primary risk factor]

═══ RULES YOU MUST FOLLOW ═══

GO / NO-GO LOGIC:

Trade ONLY if:
• P(win) ≥ 60%
• Momentum confirms direction
• No major rejection zone nearby

AVOID trades when:
• Sideways chop (low volatility)
• Conflicting signals
• Late entries (after big move already happened)

ADDITIONAL RULES:
1. Classify regime FIRST (TRENDING/RANGING/UNCLEAR). If UNCLEAR or transitioning → NO TRADE
2. Use ONLY the 4 independent signal categories above. Do NOT add redundant indicators (e.g., MACD, stochastic, Bollinger Bands)
3. If probability is below 53% OR EV is negative → output P(win) < 53% and recommend NO TRADE
4. If consecutive losses ≥ 3 → recommend 50% position size reduction regardless of signal strength
5. If window has < 2 minutes remaining → recommend SKIP unless edge > 8%
6. If ATR ratio > 1.5 (high volatility) → reduce recommended position by 50%
7. Never recommend more than 3% of account on any single trade
8. If Binance/CoinGecko divergence > 0.2% → flag as data quality risk
9. Be precise with your scoring. Show the weighted score calculation.
10. If you detect regime shift → adjust signal weights and mention it explicitly
11. HIGH CONFIDENCE (≥65%) should ONLY come from: signal agreement, clean structure, strong momentum. Do NOT assign high confidence based on single signals or weak patterns.`;

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT = 60_000; // 1 minute

function checkCircuitBreaker(provider: string): boolean {
  const state = circuitBreakers.get(provider) || { failures: 0, lastFailure: 0, isOpen: false };
  
  if (state.isOpen) {
    if (Date.now() - state.lastFailure > CIRCUIT_BREAKER_TIMEOUT) {
      // Reset circuit breaker
      circuitBreakers.set(provider, { failures: 0, lastFailure: 0, isOpen: false });
      return true;
    }
    return false;
  }
  return true;
}

function recordFailure(provider: string): void {
  const state = circuitBreakers.get(provider) || { failures: 0, lastFailure: 0, isOpen: false };
  state.failures++;
  state.lastFailure = Date.now();
  
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.isOpen = true;
  }
  
  circuitBreakers.set(provider, state);
}

function recordSuccess(provider: string): void {
  circuitBreakers.set(provider, { failures: 0, lastFailure: 0, isOpen: false });
}

// Smarter rate limiting with burst allowance
const rateLimiter = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW = 5_000;
const RATE_LIMIT_MAX_REQUESTS = 3; // Allow 3 requests per 5 seconds

function checkRL(ip: string): boolean {
  const now = Date.now();
  const state = rateLimiter.get(ip);
  
  if (!state || now - state.windowStart > RATE_LIMIT_WINDOW) {
    rateLimiter.set(ip, { count: 1, windowStart: now });
    return true;
  }
  
  if (state.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  state.count++;
  return true;
}

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

// Cleanup old rate limiter entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, state] of rateLimiter) {
    if (now - state.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimiter.delete(ip);
    }
  }
}, 60_000);

async function callAnthropic(ctx: string): Promise<string> {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  
  if (!checkCircuitBreaker('anthropic')) {
    throw new Error('Anthropic circuit breaker open');
  }
  
  const startTime = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Connection': 'keep-alive',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: ctx }],
      }),
    });
    
    const duration = Date.now() - startTime;
    performanceMonitor.recordApiCall('anthropic', duration);
    
    if (!res.ok) {
      recordFailure('anthropic');
      throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    
    const d = await res.json();
    const text = d?.content?.[0]?.text;
    if (!text) throw new Error('Empty Anthropic response');
    
    recordSuccess('anthropic');
    return text;
  } catch (error) {
    recordFailure('anthropic');
    throw error;
  }
}

async function callGroq(ctx: string): Promise<string> {
  const key = env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');
  
  if (!checkCircuitBreaker('groq')) {
    throw new Error('Groq circuit breaker open');
  }
  
  const startTime = Date.now();
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        Authorization: `Bearer ${key}`,
        'Connection': 'keep-alive',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
      max_tokens: 1200,
      temperature: 0.15,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: ctx },
      ],
    }),
    });
    
    const duration = Date.now() - startTime;
    performanceMonitor.recordApiCall('groq', duration);
    
    if (!res.ok) {
      recordFailure('groq');
      throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    
    const d = await res.json();
    const text = d?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty Groq response');
    
    recordSuccess('groq');
    return text;
  } catch (error) {
    recordFailure('groq');
    throw error;
  }
}

// Parallel API call with race for faster responses
async function callAIWithRace(ctx: string): Promise<{ result: string; provider: string }> {
  const hasAnthropic = !!env.ANTHROPIC_API_KEY;
  const hasGroq = !!env.GROQ_API_KEY;
  
  if (!hasAnthropic && !hasGroq) {
    throw new Error('No AI key configured');
  }
  
  const promises: Promise<{ result: string; provider: string }>[] = [];
  
  if (hasAnthropic) {
    promises.push(
      callAnthropic(ctx).then(result => ({ result, provider: 'anthropic' }))
    );
  }
  
  if (hasGroq) {
    promises.push(
      callGroq(ctx).then(result => ({ result, provider: 'groq' }))
    );
  }
  
  // Race between available providers
  return Promise.race(promises);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const ip = getIP(req);
  
  if (!checkRL(ip)) {
    return NextResponse.json({ 
      error: 'Rate limit: wait 5 seconds between analyses.',
      retryAfter: 5
    }, { status: 429 });
  }

  let marketContext: string;
  try {
    const body = await req.json();
    const validated = AnalyzeRequestSchema.parse(body);
    marketContext = validated.context;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request',
        details: error.errors
      }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Check cache for identical context
  const cacheKey = `analyze:${Buffer.from(marketContext).toString('base64').slice(0, 32)}`;
  const cached = apiCache.get(cacheKey);
  if (cached) {
    performanceMonitor.recordApiCall('analyze_cache', Date.now() - startTime);
    return NextResponse.json({ 
      result: cached,
      cached: true,
      provider: 'cache'
    });
  }

  const hasAnthropic = !!env.ANTHROPIC_API_KEY;
  const hasGroq = !!env.GROQ_API_KEY;

  if (!hasAnthropic && !hasGroq) {
    return NextResponse.json({
      error: 'No AI key configured. Add ANTHROPIC_API_KEY or GROQ_API_KEY in Vercel → Settings → Environment Variables, then redeploy.',
    }, { status: 500 });
  }

  try {
    const { result, provider } = await callAIWithRace(marketContext);
    
    // Cache the result for 30 seconds
    apiCache.set(cacheKey, result, 30000);
    
    const duration = Date.now() - startTime;
    performanceMonitor.recordApiCall('analyze_total', duration);
    
    return NextResponse.json({ 
      result,
      provider,
      duration,
      cached: false
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('analyze error:', msg);
    
    const duration = Date.now() - startTime;
    performanceMonitor.recordApiCall('analyze_error', duration);
    
    return NextResponse.json({ 
      error: msg,
      duration
    }, { status: 500 });
  }
}
