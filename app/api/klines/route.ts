// /app/api/klines/route.ts — Server-side proxy for Binance (bypasses geo-restrictions)
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimiter';

export const runtime = 'edge';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

export async function GET(request: Request) {
  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, 'prices');
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '120',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTCUSDT';
  const interval = searchParams.get('interval') || '15m';
  const limit = searchParams.get('limit') || '200';

  try {
    const res = await fetch(
      `${BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Binance API error: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'X-RateLimit-Limit': '120',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
      }
    });
  } catch (err) {
    console.error('Klines proxy error:', err);
    return NextResponse.json({ error: 'Failed to fetch klines' }, { status: 500 });
  }
}
