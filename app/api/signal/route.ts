export const runtime = "nodejs";

import { executionTimingModel } from "@/lib/executionModel";
import { apiCache, priceCache } from "@/lib/cache";
import { performanceMonitor } from "@/lib/performance";
import { checkRateLimit, getClientIdentifier } from "@/lib/rateLimiter";
import { z } from "zod";
import { SignalRequestSchema, SignalResponseSchema } from "@/lib/schemas";

// Constants
const BINANCE_API = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=50";
const HIGH_PROBABILITY_THRESHOLD = 0.6;
const LOW_PROBABILITY_THRESHOLD = 0.4;
const NO_TRADE_SCORE_THRESHOLD = 0.1;
const CACHE_TTL = 5000; // 5 seconds for price data
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Circuit breaker for Binance API
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const binanceCircuitBreaker: CircuitBreakerState = { failures: 0, lastFailure: 0, isOpen: false };
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT = 60_000;

// Request deduplication
const pendingRequests = new Map<string, Promise<unknown>>();

// Types
interface BinanceCandle {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyVolume: string;
  takerBuyQuoteVolume: string;
  ignore: string;
}

interface SignalMetrics {
  trend: number;
  momentum: number;
  volume: number;
  volatility: number;
}

interface TargetAnalysis {
  targetPrice: number;
  currentPrice: number;
  distance: string;
  distancePercent: string;
  direction: "ABOVE" | "BELOW";
  probability: number;
  timeWindow: string;
  volatility: number;
}

interface SignalResponse {
  probability: number;
  decision: "UP" | "DOWN" | "NO TRADE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  execution: Record<string, unknown>;
  signals: SignalMetrics;
  targetAnalysis: TargetAnalysis | null;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function checkCircuitBreaker(): boolean {
  const now = Date.now();
  
  if (binanceCircuitBreaker.isOpen) {
    if (now - binanceCircuitBreaker.lastFailure > CIRCUIT_BREAKER_TIMEOUT) {
      binanceCircuitBreaker.isOpen = false;
      binanceCircuitBreaker.failures = 0;
      return true;
    }
    return false;
  }
  return true;
}

function recordFailure(): void {
  binanceCircuitBreaker.failures++;
  binanceCircuitBreaker.lastFailure = Date.now();
  
  if (binanceCircuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    binanceCircuitBreaker.isOpen = true;
  }
}

function recordSuccess(): void {
  binanceCircuitBreaker.failures = 0;
  binanceCircuitBreaker.isOpen = false;
}

async function fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        cache: "no-store",
        headers: {
          ...options.headers,
          "Connection": "keep-alive",
        },
      });
      
      if (response.ok) {
        recordSuccess();
        return response;
      }
      
      if (attempt === MAX_RETRIES - 1) {
        recordFailure();
        throw new Error(`Binance API failed: ${response.status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === MAX_RETRIES - 1) {
        recordFailure();
        throw lastError;
      }
      
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
    }
  }
  
  throw lastError || new Error("Failed to fetch");
}

function parseCandles(data: unknown[]): BinanceCandle[] {
  return data.map(c => {
    const candle = c as unknown as (string | number)[];
    return {
      openTime: Number(candle[0]),
      open: String(candle[1]),
      high: String(candle[2]),
      low: String(candle[3]),
      close: String(candle[4]),
      volume: String(candle[5]),
      closeTime: Number(candle[6]),
      quoteVolume: String(candle[7]),
      trades: Number(candle[8]),
      takerBuyVolume: String(candle[9]),
      takerBuyQuoteVolume: String(candle[10]),
      ignore: String(candle[11]),
    };
  });
}

function calculateSignals(candles: BinanceCandle[]) {
  const closes = candles.map(c => parseFloat(c.close));
  const volumes = candles.map(c => parseFloat(c.volume));

  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 5];

  // Trend
  const trend = prev > 0 ? (last - prev) / prev : 0;

  // Momentum
  const momentum = closes.slice(-3).reduce((a, b, i, arr) =>
    i ? a + (b - arr[i - 1]) : 0, 0);

  // Volume spike
  const avgVol = volumes.length > 1 ? volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1) : volumes[0] || 1;
  const volume = avgVol > 0 ? volumes[volumes.length - 1] / avgVol : 1;

  // Volatility
  const recentCloses = closes.slice(-10);
  const range = Math.max(...recentCloses) - Math.min(...recentCloses);
  const volatility = last > 0 ? range / last : 0;

  return { trend, momentum, volume, volatility };
}

function scoreModel(signals: SignalMetrics): number {
  const weights = {
    trend: 0.35,
    momentum: 0.25,
    volume: 0.20,
    volatility: 0.20,
  };

  return (
    signals.trend * weights.trend +
    signals.momentum * weights.momentum +
    signals.volume * weights.volume +
    signals.volatility * weights.volatility
  );
}

function calculateTargetAnalysis(
  targetPrice: number,
  currentPrice: number,
  closes: number[],
  timeWindow: string
): TargetAnalysis {
  const distance = targetPrice - currentPrice;
  const distancePercent = (distance / currentPrice) * 100;
  const isAbove = targetPrice > currentPrice;

  // Calculate historical volatility
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  const meanReturn = returns.length > 0
    ? returns.reduce((a, b) => a + b, 0) / returns.length
    : 0;
  const variance = returns.length > 0
    ? returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
    : 0;
  const stdReturn = Math.sqrt(variance);

  // Map time window to periods
  const periodsMap: Record<string, number> = { "5M": 5, "15M": 15, "1H": 60 };
  const periods = periodsMap[timeWindow] || 15;

  // Geometric Brownian motion approximation
  const drift = meanReturn * periods;
  const diffusion = stdReturn * Math.sqrt(periods);
  const zScore = diffusion > 0 ? (distancePercent - drift) / diffusion : 0;
  const targetProbability = 1 - sigmoid(-zScore);

  return {
    targetPrice,
    currentPrice,
    distance: distance.toFixed(2),
    distancePercent: distancePercent.toFixed(2),
    direction: isAbove ? "ABOVE" : "BELOW",
    probability: Math.max(0, Math.min(100, +(targetProbability * 100).toFixed(2))),
    timeWindow,
    volatility: +(stdReturn * 100).toFixed(2),
  };
}

function calculateConfidenceIntervals(
  closes: number[],
  probability: number,
  timeWindow: string
): { 
  pointEstimate: number; 
  lower68: number; 
  upper68: number; 
  lower95: number; 
  upper95: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
} {
  const currentPrice = closes[closes.length - 1];
  const returns: number[] = [];
  
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  
  const meanReturn = returns.length > 0 
    ? returns.reduce((a, b) => a + b, 0) / returns.length 
    : 0;
  const variance = returns.length > 0
    ? returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
    : 0;
  const stdReturn = Math.sqrt(variance);
  
  // Map time window to periods
  const periodsMap: Record<string, number> = { "5M": 5, "15M": 15, "1H": 60 };
  const periods = periodsMap[timeWindow] || 15;
  
  // Calculate expected return based on probability
  const expectedReturn = (probability - 0.5) * 2 * stdReturn * Math.sqrt(periods);
  const pointEstimate = currentPrice * (1 + expectedReturn);
  
  // Confidence bands (1σ = 68%, 2σ = 95%)
  const std68 = stdReturn * Math.sqrt(periods);
  const std95 = stdReturn * 2 * Math.sqrt(periods);
  
  const lower68 = currentPrice * (1 + expectedReturn - std68);
  const upper68 = currentPrice * (1 + expectedReturn + std68);
  const lower95 = currentPrice * (1 + expectedReturn - std95);
  const upper95 = currentPrice * (1 + expectedReturn + std95);
  
  // Determine confidence level based on band width
  const bandWidth = (upper95 - lower95) / currentPrice;
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (bandWidth < 0.02) confidence = 'HIGH';
  else if (bandWidth < 0.05) confidence = 'MEDIUM';
  
  return { pointEstimate, lower68, upper68, lower95, upper95, confidence };
}

function determineDecision(
  probability: number,
  score: number
): { decision: "UP" | "DOWN" | "NO TRADE"; confidence: "HIGH" | "MEDIUM" | "LOW" } {
  let decision: "UP" | "DOWN" | "NO TRADE" = "NO TRADE";
  let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";

  if (probability > HIGH_PROBABILITY_THRESHOLD) {
    decision = "UP";
    confidence = "HIGH";
  } else if (probability < LOW_PROBABILITY_THRESHOLD) {
    decision = "DOWN";
    confidence = "HIGH";
  }

  // No-trade filter
  if (Math.abs(score) < NO_TRADE_SCORE_THRESHOLD) {
    decision = "NO TRADE";
    confidence = "LOW";
  }

  return { decision, confidence };
}

export async function POST(req: Request): Promise<Response> {
  const startTime = Date.now();
  
  // Rate limiting
  const clientId = getClientIdentifier(req);
  const rateLimit = checkRateLimit(clientId, 'signal');
  
  if (!rateLimit.allowed) {
    return Response.json(
      { 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    );
  }
  
  try {
    const body = await req.json();
    const validated = SignalRequestSchema.parse(body);
    const targetPrice = validated.targetPrice;
    const timeWindow = validated.timeWindow || "15M";

    // Check cache for price data
    const cacheKey = "binance_btcusdt_1m";
    let candles: BinanceCandle[];
    const cachedCandles = priceCache.get(cacheKey) as BinanceCandle[] | null;
    
    if (cachedCandles) {
      candles = cachedCandles;
      performanceMonitor.recordApiCall("signal_cache", Date.now() - startTime);
    } else {
      // Check circuit breaker
      if (!checkCircuitBreaker()) {
        throw new Error("Binance API circuit breaker open");
      }
      
      // Request deduplication
      const requestKey = `binance_fetch_${Date.now()}`;
      if (pendingRequests.has(requestKey)) {
        await pendingRequests.get(requestKey);
      }
      
      const fetchPromise = fetchWithRetry(BINANCE_API);
      pendingRequests.set(requestKey, fetchPromise);
      
      try {
        const res = await fetchPromise;
        const rawData = await res.json();
        candles = parseCandles(rawData);
        
        // Cache the result
        priceCache.set(cacheKey, candles, CACHE_TTL);
        
        const duration = Date.now() - startTime;
        performanceMonitor.recordApiCall("binance_api", duration);
      } finally {
        pendingRequests.delete(requestKey);
      }
    }

    const signals = calculateSignals(candles);
    const score = scoreModel(signals);
    const probability = sigmoid(score);

    const closes = candles.map(c => parseFloat(c.close));
    const volumes = candles.map(c => parseFloat(c.volume));
    const currentPrice = closes[closes.length - 1];

    const exec = executionTimingModel({
      probability,
      closes,
      volumes,
    });

    const { decision, confidence } = determineDecision(probability, score);

    // Confidence intervals
    const confidenceIntervals = calculateConfidenceIntervals(closes, probability, timeWindow);

    // Target price analysis
    let targetAnalysis: TargetAnalysis | null = null;
    if (targetPrice && currentPrice) {
      targetAnalysis = calculateTargetAnalysis(
        targetPrice,
        currentPrice,
        closes,
        timeWindow
      );
    }

    const response: SignalResponse = {
      probability: +(probability * 100).toFixed(2),
      decision,
      confidence,
      execution: exec,
      signals,
      targetAnalysis,
    };

    // Validate response
    const validatedResponse = SignalResponseSchema.parse(response);
    
    const totalDuration = Date.now() - startTime;
    performanceMonitor.recordApiCall("signal_total", totalDuration);
    
    return Response.json({
      ...validatedResponse,
      confidenceIntervals,
      cached: !!cachedCandles,
      duration: totalDuration,
    }, {
      headers: {
        'X-RateLimit-Limit': '30',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    performanceMonitor.recordApiCall("signal_error", duration);
    
    if (error instanceof z.ZodError) {
      console.error("Signal validation error:", error.errors);
      return Response.json({ 
        error: "Invalid signal data",
        details: error.errors
      }, { status: 500 });
    }
    
    console.error("Signal computation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to compute signal";
    return Response.json({ 
      error: errorMessage,
      duration
    }, { status: 500 });
  }
}
