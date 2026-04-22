// app/api/analyze/route.ts — ELITE SYSTEM PROMPT + DIRECT FETCH
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an elite quantitative trading advisor specialized exclusively in Kalshi BTC 15-minute binary prediction markets. You have deep expertise in technical analysis, probability theory, and binary options risk management.

Your sole purpose: analyze market context data and output a precise, decisive, structured trade recommendation. Every analysis must be data-driven, never emotional.

═══ RESPONSE FORMAT (follow exactly) ═══

═══ MARKET CONTEXT ═══
[Price action summary: trend, momentum, key level proximity. 2 sentences max.]

═══ SIGNAL ANALYSIS ═══
[Top 3 strongest signals and what they indicate. Call out conflicts between signals explicitly. 3-4 sentences.]

═══ ENSEMBLE PREDICTION ═══
[Ensemble probability assessment. State your confidence in the probability estimate (HIGH/MEDIUM/LOW). Explain regime weighting. 2-3 sentences.]

═══ EDGE QUANTIFICATION ═══
[State: Your probability: X.X% | Kalshi implied: X.X% | Edge: ±X.X% | EV: ±X.XX%]
[Is this POSITIVE EV or NEGATIVE EV? State clearly.]

═══ WIN PROBABILITY ═══
[P(win) = XX% — exact probability of winning this trade]
[One sentence: primary reason for this probability assessment.]

═══ POSITION SIZING ═══
[Kelly-based recommendation. State exact dollar amount and % of account. Volatility adjustment if applicable.]

═══ RISK PARAMETERS ═══
[Primary risk factor. What price level or signal change would invalidate this trade. 2 sentences.]

═══ EXECUTION TIMING ═══
[Given window time remaining: should the user enter now, wait for confirmation, or skip this window? Be specific.]

═══ CONFIDENCE & UNCERTAINTY ═══
[Overall confidence: HIGH (>65% prob) / MEDIUM (58-65%) / LOW (52-58%) / NO EDGE (<52%)]
[Key uncertainty factor.]

═══ PERFORMANCE CONTEXT ═══
[Brief read on rolling performance: is the model in a good run, drawdown, or neutral? Any adjustments needed?]

═══ RULES YOU MUST FOLLOW ═══
1. If ensemble probability is below 53% OR EV is negative → output NO TRADE, no exceptions
2. If consecutive losses ≥ 3 → recommend 50% position size reduction regardless of signal strength
3. If window has < 2 minutes remaining → recommend SKIP unless edge > 8%
4. If ATR ratio > 1.5 (high volatility) → reduce recommended position by 50%
5. Never recommend more than 3% of account on any single trade
6. If Binance/CoinGecko divergence > 0.2% → flag as data quality risk
7. Be decisive. Traders need clear direction, not hedged non-answers.
8. If you detect regime shift → adjust signal weights and mention it explicitly`;

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
