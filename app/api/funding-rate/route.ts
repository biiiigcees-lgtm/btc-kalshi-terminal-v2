// /app/api/funding-rate/route.ts — Fetch Binance futures funding rate
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1/fundingRate';

export async function GET() {
  try {
    const res = await fetch(`${BINANCE_FUTURES_API}?symbol=BTCUSDT&limit=5`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch funding rate' }, { status: res.status });
    }

    const data = await res.json();
    
    // Return the most recent funding rate
    const latest = data[data.length - 1];
    
    return NextResponse.json({
      symbol: latest.symbol,
      fundingRate: parseFloat(latest.fundingRate),
      fundingTime: latest.fundingTime,
      markPrice: parseFloat(latest.markPrice),
      history: data.map((d: unknown) => ({
        fundingRate: parseFloat((d as { fundingRate: string }).fundingRate),
        fundingTime: (d as { fundingTime: number }).fundingTime,
        markPrice: parseFloat((d as { markPrice: string }).markPrice),
      })),
    });
  } catch (error) {
    console.error('Funding rate error:', error);
    return NextResponse.json({ error: 'Failed to fetch funding rate' }, { status: 500 });
  }
}
