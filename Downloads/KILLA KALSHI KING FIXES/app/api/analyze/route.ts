// /app/api/analyze/route.ts — FIXED
// FIXES:
// 1. Replaced generateObject (Groq structured output is unreliable) with direct text generation
// 2. Uses Anthropic Claude API directly as primary (reliable, no structured output issues)
// 3. Falls back to Groq text generation (not generateObject) if Claude key missing
// 4. Rate limiter kept, improved IP handling
// 5. Response formatted correctly for AIAdvisor component
import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '../../../src/constants/systemPrompt';

const rateLimiter = new Map<string, number>();
const RATE_LIMIT_MS = 15000; // 15 seconds between requests per IP

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimiter.get(ip);
  if (lastRequest && now - lastRequest < RATE_LIMIT_MS) return false;
  rateLimiter.set(ip, now);
  // Clean old entries periodically
  if (rateLimiter.size > 1000) {
    for (const [key, ts] of Array.from(rateLimiter)) {
      if (now - ts > 60000) rateLimiter.delete(key);
    }
  }
  return true;
}

async function callClaude(marketContext: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', // fast + cheap for trading advisor
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: marketContext }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude');
  return text;
}

async function callGroq(marketContext: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: marketContext },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq');
  return text;
}

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    return NextResponse.json(
      { error: 'Rate limit: please wait 15 seconds between analyses.' },
      { status: 429 }
    );
  }

  try {
    const { marketContext } = await req.json();
    if (!marketContext || typeof marketContext !== 'string') {
      return NextResponse.json({ error: 'marketContext is required' }, { status: 400 });
    }

    let result: string;

    // Try Claude first (most reliable), fall back to Groq
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        result = await callClaude(marketContext);
      } catch (claudeErr) {
        console.warn('Claude failed, trying Groq:', claudeErr);
        if (!process.env.GROQ_API_KEY) {
          return NextResponse.json({ error: 'No AI API key configured. Set ANTHROPIC_API_KEY or GROQ_API_KEY in Vercel environment variables.' }, { status: 500 });
        }
        result = await callGroq(marketContext);
      }
    } else if (process.env.GROQ_API_KEY) {
      result = await callGroq(marketContext);
    } else {
      return NextResponse.json({
        error: 'No AI API key configured. Add ANTHROPIC_API_KEY or GROQ_API_KEY to Vercel → Settings → Environment Variables.'
      }, { status: 500 });
    }

    return NextResponse.json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('analyze route error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
