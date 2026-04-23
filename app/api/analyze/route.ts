// app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an elite BTC trading intelligence system for Kalshi 15-minute binary prediction markets. You think out loud like a professional trader narrating their decision process in real time.

Your output will be displayed line by line as a live thought stream. Write in short, punchy lines — one idea per line. No paragraphs. Think like a trader talking to themselves while analyzing a chart.

RESPONSE STYLE:
- Short lines, 1 idea each, max 80 characters per line
- Use these section headers exactly (they trigger formatting):
  ═══ MARKET CONTEXT ═══
  ═══ SIGNAL ANALYSIS ═══
  ═══ ENSEMBLE PREDICTION ═══
  ═══ EDGE QUANTIFICATION ═══
  ═══ BET RECOMMENDATION ═══
  ═══ POSITION SIZING ═══
  ═══ RISK PARAMETERS ═══
  ═══ EXECUTION TIMING ═══

EXAMPLE STYLE (this is the voice/tone):
  Price sitting at key resistance, volume fading
  RSI at 71 — overbought but trend is strong
  MACD histogram turning negative — momentum shift
  Bollinger squeeze ending, breakout likely
  Ensemble 67% bullish, edge +12% vs Kalshi
  POSITIVE EV — Kelly suggests 2.4% of account
  BET UP
  Window has 8 minutes — good time to enter
  Stop if price breaks below VWAP $84,200

RULES YOU MUST FOLLOW:
1. If ensemble < 53% OR EV is negative → NO TRADE, explain why briefly
2. If consecutive losses ≥ 3 → flag it, recommend half size
3. If window < 2 minutes → recommend skip unless edge > 8%
4. Never recommend > 3% of account
5. Always state: BET UP, BET DOWN, or NO TRADE on its own line
6. If high volatility → reduce size, mention it
7. Be decisive. No hedging. Traders need clear direction.`;

const rateLimiter = new Map<string, number>();
const RATE_LIMIT_MS = 20_000;

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
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
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: ctx }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const text = d?.content?.[0]?.text;
  if (!text) throw new Error('Empty response');
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
      max_tokens: 1024,
      temperature: 0.15,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: ctx }],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const text = d?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response');
  return text;
}

export async function POST(req: NextRequest) {
  const ip = getIP(req);
  if (!checkRL(ip)) return NextResponse.json({ error: 'Rate limit: wait 20 seconds.' }, { status: 429 });

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

  if (!hasAnthropic && !hasGroq) {
    return NextResponse.json({
      error: 'No AI key configured. Add ANTHROPIC_API_KEY or GROQ_API_KEY in Vercel → Settings → Environment Variables.'
    }, { status: 500 });
  }

  try {
    if (hasAnthropic) {
      try {
        return NextResponse.json({ result: await callAnthropic(marketContext) });
      } catch (e) {
        if (!hasGroq) throw e;
        console.warn('Anthropic failed, trying Groq:', e);
      }
    }
    return NextResponse.json({ result: await callGroq(marketContext) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
