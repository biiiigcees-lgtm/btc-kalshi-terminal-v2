export const runtime = "nodejs";

import { executionTimingModel } from "@/lib/executionModel";

const BINANCE_API =
  "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=50";

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

type Candle = (string | number)[];

function calculateSignals(candles: Candle[]) {
  const closes = candles.map(c => parseFloat(String(c[4])));
  const volumes = candles.map(c => parseFloat(String(c[5])));

  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 5];

  // Trend
  const trend = (last - prev) / prev;

  // Momentum
  const momentum = closes.slice(-3).reduce((a, b, i, arr) =>
    i ? a + (b - arr[i - 1]) : 0, 0);

  // Volume spike
  const avgVol = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / volumes.length;
  const volume = volumes[volumes.length - 1] / avgVol;

  // Volatility
  const range = Math.max(...closes.slice(-10)) - Math.min(...closes.slice(-10));
  const volatility = range / last;

  return { trend, momentum, volume, volatility };
}

function scoreModel(s: { trend: number; momentum: number; volume: number; volatility: number }) {
  return (
    s.trend * 0.35 +
    s.momentum * 0.25 +
    s.volume * 0.2 +
    s.volatility * 0.2
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const targetPrice = body?.targetPrice ? parseFloat(body.targetPrice) : null;
    const timeWindow = body?.timeWindow || "15M";

    const res = await fetch(BINANCE_API, { cache: "no-store" });
    const data: Candle[] = await res.json();

    const signals = calculateSignals(data);
    const score = scoreModel(signals);
    const probability = sigmoid(score);

    const closes = data.map(c => parseFloat(String(c[4])));
    const volumes = data.map(c => parseFloat(String(c[5])));
    const currentPrice = closes[closes.length - 1];

    const exec = executionTimingModel({
      probability,
      closes,
      volumes
    });

    let decision = "NO TRADE";
    let confidence = "LOW";

    if (probability > 0.6) {
      decision = "UP";
      confidence = "HIGH";
    } else if (probability < 0.4) {
      decision = "DOWN";
      confidence = "HIGH";
    }

    // No-trade filter
    if (Math.abs(score) < 0.1) {
      decision = "NO TRADE";
      confidence = "LOW";
    }

    // Target price analysis
    let targetAnalysis = null;
    if (targetPrice && currentPrice) {
      const distance = targetPrice - currentPrice;
      const distancePercent = (distance / currentPrice) * 100;
      const isAbove = targetPrice > currentPrice;
      
      // Calculate historical volatility to estimate probability of reaching target
      const returns = [];
      for (let i = 1; i < closes.length; i++) {
        returns.push((closes[i] - closes[i-1]) / closes[i-1]);
      }
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length);
      
      // Map time window to number of periods (1m candles)
      const periods = timeWindow === "5M" ? 5 : timeWindow === "15M" ? 15 : 60;
      
      // Calculate probability using geometric Brownian motion approximation
      const drift = meanReturn * periods;
      const diffusion = stdReturn * Math.sqrt(periods);
      const zScore = (distancePercent - drift) / diffusion;
      const targetProbability = 1 - sigmoid(-zScore); // Probability of reaching target
      
      targetAnalysis = {
        targetPrice,
        currentPrice,
        distance: distance.toFixed(2),
        distancePercent: distancePercent.toFixed(2),
        direction: isAbove ? "ABOVE" : "BELOW",
        probability: Math.max(0, Math.min(100, +(targetProbability * 100).toFixed(2))),
        timeWindow,
        volatility: +(stdReturn * 100).toFixed(2)
      };
    }

    return Response.json({
      probability: +(probability * 100).toFixed(2),
      decision,
      confidence,
      execution: exec,
      signals,
      targetAnalysis
    });

  } catch {
    return Response.json({ error: "Failed to compute signal" }, { status: 500 });
  }
}
