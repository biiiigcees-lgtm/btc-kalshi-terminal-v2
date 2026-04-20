// /app/api/cron/btc-signal/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET for security
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Call the analyze route internally
    const analyzeUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/analyze`;
    
    // Get current market data from stores (simulated for cron)
    const marketContext = 'BTC signal analysis requested by cron job at ' + new Date().toISOString();

    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ marketContext }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Cron analyze failed:', error);
      return NextResponse.json({ error: 'Analyze failed' }, { status: 500 });
    }

    const data = await response.json();
    console.log('Cron BTC signal analysis completed');

    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      result: data.result 
    });
  } catch (err) {
    console.error('Cron route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
