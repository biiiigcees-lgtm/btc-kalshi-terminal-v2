// app/api/analyze/route.ts — ELITE SYSTEM PROMPT + DIRECT FETCH
import { NextRequest, NextResponse } from 'next/server';

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

═══ REGIME CLASSIFICATION ═══
[REGIME: TRENDING / RANGING / UNCLEAR]
[Strategy: Momentum / Mean Reversion / NO TRADE]

═══ SIGNAL SCORES ═══
[Market Structure: X.XX | Momentum: X.XX | Volume: X.XX | Volatility: X.XX]
[Weighted Score: X.XX]

═══ WIN PROBABILITY ═══
[P(win) = XX% — exact probability from sigmoid function]
[One sentence: primary reason for this probability assessment.]

═══ EDGE QUANTIFICATION ═══
[State: Your probability: X.X% | Kalshi implied: X.X% | Edge: ±X.X% | EV: ±X.XX%]
[Is this POSITIVE EV or NEGATIVE EV? State clearly.]

═══ POSITION SIZING ═══
[Kelly-based recommendation. State exact dollar amount and % of account. Volatility adjustment if applicable.]

═══ RISK PARAMETERS ═══
[Primary risk factor. What price level or signal change would invalidate this trade. 2 sentences.]

═══ EXECUTION TIMING ═══
[Given window time remaining: should the user enter now, wait for confirmation, or skip this window? Be specific.]

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

const rateLimiter = new Map<string, number>();
const RATE_LIMIT_MS = 20_000;

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function checkRL(ip: string): boolean {
  const now = Date.now();
  const last = rateLimiter.get(ip);
  if (last && now - last < RATE_LIMIT_MS) return false;
  rateLimiter.set(ip, now);
  if (rateLimiter.size > 500) {
    for (const [k, v] of Array.from(rateLimiter)) {
      if (now - v > 120_000) rateLimiter.delete(k);
    }
  }
  return true;
}

async function callAnthropic(ctx: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: ctx }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const text = d?.content?.[0]?.text;
  if (!text) throw new Error('Empty Anthropic response');
  return text;
}

async function callGroq(ctx: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
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
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const text = d?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty Groq response');
  return text;
}

export async function POST(req: NextRequest) {
  const ip = getIP(req);
  if (!checkRL(ip)) {
    return NextResponse.json({ error: 'Rate limit: wait 20 seconds between analyses.' }, { status: 429 });
  }

  let marketContext: string;
  try {
    const body = await req.json();
    marketContext = body?.marketContext;
    if (!marketContext || typeof marketContext !== 'string') {
      return NextResponse.json({ error: 'marketContext required' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;

  const debugInfo = {
    hasAnthropic,
    hasGroq,
    anthropicKeyLength: process.env.ANTHROPIC_API_KEY?.length,
    groqKeyLength: process.env.GROQ_API_KEY?.length,
    nodeEnv: process.env.NODE_ENV,
  };

  console.log('Environment check:', debugInfo);

  if (!hasAnthropic && !hasGroq) {
    return NextResponse.json({
      error: 'No AI key configured. Add ANTHROPIC_API_KEY or GROQ_API_KEY in Vercel → Settings → Environment Variables, then redeploy.',
      debug: debugInfo
    }, { status: 500 });
  }

  try {
    if (hasAnthropic) {
      try {
        const result = await callAnthropic(marketContext);
        return NextResponse.json({ result });
      } catch (e) {
        console.warn('Anthropic failed, trying Groq:', e);
        if (!hasGroq) throw e;
      }
    }
    const result = await callGroq(marketContext);
    return NextResponse.json({ result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('analyze error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
