import { z } from 'zod';

// Binance API response schemas
export const BinanceCandleSchema = z.object({
  openTime: z.number(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  volume: z.string(),
  closeTime: z.number(),
  quoteVolume: z.string(),
  trades: z.number(),
  takerBuyVolume: z.string(),
  takerBuyQuoteVolume: z.string(),
  ignore: z.string(),
});

export const BinanceKlineMessageSchema = z.object({
  stream: z.string(),
  data: z.object({
    t: z.number(),
    s: z.string(),
    o: z.string(),
    h: z.string(),
    l: z.string(),
    c: z.string(),
    v: z.string(),
    x: z.boolean().optional(),
  }),
});

export const BinanceTickerMessageSchema = z.object({
  stream: z.string(),
  data: z.object({
    s: z.string(),
    c: z.string(),
  }),
});

// Signal API schemas
export const SignalRequestSchema = z.object({
  targetPrice: z.number().optional(),
  timeWindow: z.enum(['5M', '15M', '1H']).optional().default('15M'),
});

export const SignalResponseSchema = z.object({
  probability: z.number(),
  decision: z.enum(['UP', 'DOWN', 'NO TRADE']),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  execution: z.record(z.unknown()),
  signals: z.object({
    trend: z.number(),
    momentum: z.number(),
    volume: z.number(),
    volatility: z.number(),
  }),
  targetAnalysis: z.object({
    targetPrice: z.number(),
    currentPrice: z.number(),
    distance: z.string(),
    distancePercent: z.string(),
    direction: z.enum(['ABOVE', 'BELOW']),
    probability: z.number(),
    timeWindow: z.string(),
    volatility: z.number(),
  }).nullable(),
});

// Analyze API schemas
export const AnalyzeRequestSchema = z.object({
  context: z.string(),
  signals: z.record(z.unknown()).optional(),
  regime: z.object({
    trend: z.string(),
    volatility: z.string(),
  }).optional(),
});

// Candle schema
export const CandleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

// Type exports
export type BinanceCandle = z.infer<typeof BinanceCandleSchema>;
export type BinanceKlineMessage = z.infer<typeof BinanceKlineMessageSchema>;
export type BinanceTickerMessage = z.infer<typeof BinanceTickerMessageSchema>;
export type SignalRequest = z.infer<typeof SignalRequestSchema>;
export type SignalResponse = z.infer<typeof SignalResponseSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type Candle = z.infer<typeof CandleSchema>;
