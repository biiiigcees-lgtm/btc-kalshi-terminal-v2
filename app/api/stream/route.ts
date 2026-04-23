// /app/api/stream/route.ts — Server-Sent Events for real-time data streaming
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: unknown) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial connection message
      sendEvent({ type: 'connected', timestamp: Date.now() });

      // Fetch initial price data
      try {
        const priceRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          sendEvent({ type: 'price', data: priceData, timestamp: Date.now() });
        }
      } catch (error) {
        sendEvent({ type: 'error', message: 'Failed to fetch initial price' });
      }

      // Set up polling for price updates (fallback if WebSocket not available)
      const interval = setInterval(async () => {
        try {
          const priceRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
          if (priceRes.ok) {
            const priceData = await priceRes.json();
            sendEvent({ type: 'price', data: priceData, timestamp: Date.now() });
          }
        } catch (error) {
          sendEvent({ type: 'error', message: 'Failed to fetch price update' });
        }
      }, 2000);

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        sendEvent({ type: 'heartbeat', timestamp: Date.now() });
      }, 15000);

      // Clean up on client disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
