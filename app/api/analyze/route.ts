// /app/api/analyze/route.ts — SERVER ONLY
// Using Vercel AI SDK with Groq API and Cerebras fallback
import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { groq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { SYSTEM_PROMPT } from '../../../src/constants/systemPrompt';

// Simple in-memory rate limiter: 1 request per 10 seconds per IP
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_MS = 10000; // 10 seconds

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

// Zod schema for structured output
const SignalSchema = z.object({
  marketContext: z.string(),
  signalAnalysis: z.string(),
  ensemblePrediction: z.string(),
  edgeQuantification: z.string(),
  betRecommendation: z.string(),
  positionSizing: z.string(),
  riskParameters: z.string(),
  trajectoryPrediction: z.string(),
  executionTiming: z.string(),
  confidence: z.string(),
  performanceAlerts: z.string(),
  // Numeric fields for validation
  kellyFraction: z.number().min(0).max(0.25), // Kelly fraction capped at 25%
  recommendedBet: z.number().min(0),
  ensembleProbability: z.number().min(0).max(100),
  edge: z.number().min(-100).max(100),
});

// Cerebras as fallback
const cerebras = createOpenAI({
  baseURL: 'https://api.cerebras.ai/v1',
  apiKey: process.env.GROQ_API_KEY, // Use same key for now
});

export async function POST(req: NextRequest) {
  // Rate limiting check
  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait 10 seconds between analyses.' },
      { status: 429 }
    );
  }

  try {
    const { marketContext } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    let result;
    let usedFallback = false;

    try {
      // Try Groq first
      const object = await generateObject({
        model: groq('llama-3.3-70b-versatile'),
        schema: SignalSchema,
        prompt: `${SYSTEM_PROMPT}\n\nMarket Context:\n${marketContext}`,
        temperature: 0.2,
      });
      result = object.object;
    } catch (groqError: any) {
      // Fallback to Cerebras on 429 or 503 errors
      if (groqError?.status === 429 || groqError?.status === 503) {
        console.log('Groq rate limited, falling back to Cerebras');
        usedFallback = true;
        try {
          const object = await generateObject({
            model: cerebras('llama-3.3-70b'),
            schema: SignalSchema,
            prompt: `${SYSTEM_PROMPT}\n\nMarket Context:\n${marketContext}`,
            temperature: 0.2,
          });
          result = object.object;
        } catch (cerebrasError: any) {
          console.error('Cerebras fallback also failed:', cerebrasError);
          return NextResponse.json({ error: `Both Groq and Cerebras failed: ${cerebrasError.message}` }, { status: 500 });
        }
      } else {
        throw groqError;
      }
    }

    // Format the structured output into a readable response
    const formattedResponse = [
      `═══ MARKET CONTEXT ═══`,
      result.marketContext,
      '',
      `═══ SIGNAL ANALYSIS ═══`,
      result.signalAnalysis,
      '',
      `═══ ENSEMBLE PREDICTION ═══`,
      result.ensemblePrediction,
      '',
      `═══ EDGE QUANTIFICATION ═══`,
      result.edgeQuantification,
      '',
      `═══ BET RECOMMENDATION ═══`,
      result.betRecommendation,
      '',
      `═══ POSITION SIZING ═══`,
      result.positionSizing,
      '',
      `═══ RISK PARAMETERS ═══`,
      result.riskParameters,
      '',
      `═══ TRAJECTORY PREDICTION ═══`,
      result.trajectoryPrediction,
      '',
      `═══ EXECUTION TIMING ═══`,
      result.executionTiming,
      '',
      `═══ CONFIDENCE AND UNCERTAINTY ═══`,
      result.confidence,
      '',
      `═══ PERFORMANCE ALERTS ═══`,
      result.performanceAlerts,
    ].join('\n');

    return NextResponse.json({ 
      result: formattedResponse,
      usedFallback 
    });
  } catch (err) {
    console.error('analyze route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
