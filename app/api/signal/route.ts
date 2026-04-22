export const runtime = "nodejs";

import { executionTimingModel } from "@/lib/executionModel";

// Constants
const BINANCE_API = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=50";
const HIGH_PROBABILITY_THRESHOLD = 0.6;
const LOW_PROBABILITY_THRESHOLD = 0.4;
const NO_TRADE_SCORE_THRESHOLD = 0.1;

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
  try {
    const body = await req.json();
    const targetPrice = body?.targetPrice ? parseFloat(body.targetPrice) : null;
    const timeWindow = (body?.timeWindow as string) || "15M";

    const res = await fetch(BINANCE_API, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Binance API failed: ${res.status}`);
    }
    const rawData = await res.json();
    const candles = parseCandles(rawData);

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

    return Response.json(response);
  } catch (error) {
    console.error("Signal computation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to compute signal";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
