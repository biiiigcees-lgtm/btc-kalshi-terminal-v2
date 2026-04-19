// /app/api/analyze/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '../../../src/constants/systemPrompt';

// Simple in-memory rate limiter: 1 request per 30 seconds per IP
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_MS = 30000; // 30 seconds

function getClientIP(req: NextRequest): string {
  // Get IP from various headers
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimiter.get(ip);
  
  if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
    return false; // Rate limited
  }
  
  rateLimiter.set(ip, now);
  return true; // Allowed
}

export async function POST(req: NextRequest) {
  // Rate limiting check
  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait 30 seconds between analyses.' },
      { status: 429 }
    );
  }

  try {
    const { marketContext } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            {
              parts: [{ text: marketContext }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1500,
            temperature: 0.2,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Gemini API error: ${err}` }, { status: response.status });
    }

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini';
    return NextResponse.json({ result });
  } catch (err) {
    console.error('analyze route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
