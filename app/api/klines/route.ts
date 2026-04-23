// /app/api/klines/route.ts — Server-side proxy for Binance (bypasses geo-restrictions)
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

export async function GET(request: Request) {
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
    return NextResponse.json(data);
  } catch (err) {
    console.error('Klines proxy error:', err);
    return NextResponse.json({ error: 'Failed to fetch klines' }, { status: 500 });
  }
}
