// /src/engine/terminalEngine.ts — Layered AI Decision Engine for Terminal
// Produces BUY_YES / BUY_NO / WAIT / REDUCE_EXPOSURE with full explainability
import type {
  Candle,
  SignalResult,
  MarketRegime,
  RegimeType,
  TerminalSignal,
  TerminalDecision,
  TradeQuality,
  ScoredDecision,
  DecisionScoreWeights,
  AggressivenessLevel,
  TrajectoryPrediction,
  TerminalSettings,
} from '@/types';
import { computeSignals } from '@/utils/indicators';
import { computeEnsemble } from '@/utils/ensemble';
import { detectRegime } from '@/utils/regimeDetector';

// ── Weight presets by aggressiveness ──────────────────────────────────────
const WEIGHT_PRESETS: Record<AggressivenessLevel, DecisionScoreWeights> = {
  conservative: {
    trendStrength: 0.25,
    momentum: 0.15,
    volatilityRegime: 0.15,
    marketDisagreement: 0.10,
    orderBookPressure: 0.05,
    liquidityQuality: 0.10,
    reversalRisk: 0.12,
    confidenceStability: 0.08,
  },
  moderate: {
    trendStrength: 0.20,
    momentum: 0.20,
    volatilityRegime: 0.12,
    marketDisagreement: 0.08,
    orderBookPressure: 0.08,
    liquidityQuality: 0.08,
    reversalRisk: 0.12,
    confidenceStability: 0.12,
  },
  aggressive: {
    trendStrength: 0.15,
    momentum: 0.25,
    volatilityRegime: 0.10,
    marketDisagreement: 0.05,
    orderBookPressure: 0.10,
    liquidityQuality: 0.05,
    reversalRisk: 0.15,
    confidenceStability: 0.15,
  },
};

// ── Confidence thresholds by aggressiveness ───────────────────────────────
const CONFIDENCE_THRESHOLDS: Record<AggressivenessLevel, { high: number; medium: number }> = {
  conservative: { high: 75, medium: 60 },
  moderate: { high: 65, medium: 50 },
  aggressive: { high: 55, medium: 40 },
};

export class TerminalEngine {
  private previousDecision: TerminalDecision | null = null;
  private previousTimestamp = 0;
  private confidenceHistory: number[] = [];
  private maxConfidenceHistory = 20;

  // ── Layer 1: Fast Signal Layer ────────────────────────────────────────
  private computeFastSignals(candles: Candle[]): SignalResult[] {
    if (candles.length < 55) return [];
    return computeSignals(candles);
  }

  // ── Layer 2: Confirmation Layer ───────────────────────────────────────
  private computeConfirmation(candles: Candle[], signals: SignalResult[]): {
    ensemble: number;
    regime: MarketRegime;
    trendStrength: number;
    momentum: number;
    volatilityRegime: number;
    marketDisagreement: number;
    orderBookPressure: number;
    liquidityQuality: number;
    reversalRisk: number;
  } {
    const regime = detectRegime(candles);
    const ensemble = computeEnsemble(signals, regime);

    // Trend strength: how aligned are trend signals
    const trendSignals = signals.filter(s => s.category === 'trend');
    const trendBullish = trendSignals.filter(s => s.direction === 'bullish').length;
    const trendStrength = trendSignals.length > 0
      ? ((trendBullish / trendSignals.length) - 0.5) * 2 // -1 to 1
      : 0;

    // Momentum: average momentum signal direction weighted by confidence
    const momentumSignals = signals.filter(s => s.category === 'momentum');
    const momentum = momentumSignals.length > 0
      ? momentumSignals.reduce((sum, s) => {
          const dir = s.direction === 'bullish' ? 1 : s.direction === 'bearish' ? -1 : 0;
          return sum + dir * s.confidence;
        }, 0) / momentumSignals.length
      : 0;

    // Volatility regime: from regime detector
    const volatilityRegime = regime.volatility === 'high' ? -0.5
      : regime.volatility === 'low' ? 0.3 : 0;

    // Market disagreement: how split are the signals
    const bullCount = signals.filter(s => s.direction === 'bullish').length;
    const bearCount = signals.filter(s => s.direction === 'bearish').length;
    const total = signals.length;
    const marketDisagreement = total > 0
      ? 1 - Math.abs(bullCount - bearCount) / total
      : 0.5;

    // Order book pressure (simplified - derived from price/volume action)
    const recentCandles = candles.slice(-10);
    const volumeUp = recentCandles.filter(c => c.close > c.open).reduce((s, c) => s + c.volume, 0);
    const volumeDown = recentCandles.filter(c => c.close < c.open).reduce((s, c) => s + c.volume, 0);
    const totalVol = volumeUp + volumeDown;
    const orderBookPressure = totalVol > 0 ? ((volumeUp - volumeDown) / totalVol) : 0;

    // Liquidity quality: volume relative to average
    const avgVol = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
    const recentVol = recentCandles.reduce((s, c) => s + c.volume, 0) / recentCandles.length;
    const liquidityQuality = avgVol > 0 ? Math.min(1, recentVol / avgVol) - 0.5 : 0;

    // Reversal risk: mean reversion signals + high volatility
    const mrSignals = signals.filter(s => s.category === 'meanReversion');
    const mrBearish = mrSignals.filter(s => s.direction === 'bearish' && s.confidence > 0.6).length;
    const mrBullish = mrSignals.filter(s => s.direction === 'bullish' && s.confidence > 0.6).length;
    const isUptrend = trendStrength > 0.3;
    const isDowntrend = trendStrength < -0.3;
    const reversalRisk = (isUptrend && mrBearish > 1) || (isDowntrend && mrBullish > 1)
      ? 0.6 + (regime.volatility === 'high' ? 0.3 : 0)
      : 0.1;

    return {
      ensemble,
      regime,
      trendStrength,
      momentum,
      volatilityRegime,
      marketDisagreement,
      orderBookPressure,
      liquidityQuality,
      reversalRisk,
    };
  }

  // ── Layer 3: Risk Layer ───────────────────────────────────────────────
  private computeRisk(
    confirmation: ReturnType<typeof this.computeConfirmation>,
    aggressiveness: AggressivenessLevel,
  ): {
    riskScore: number;
    confidenceStability: number;
    shouldReduceExposure: boolean;
  } {
    const { volatilityRegime, marketDisagreement, reversalRisk, liquidityQuality } = confirmation;

    // Confidence stability: how consistent has confidence been
    const stability = this.confidenceHistory.length >= 3
      ? 1 - (this.computeVariance(this.confidenceHistory.slice(-5)) / 2500) // normalize
      : 0.5;
    const confidenceStability = Math.max(0, Math.min(1, stability));

    // Risk score: composite
    const riskScore = (
      Math.abs(volatilityRegime) * 0.25 +
      marketDisagreement * 0.2 +
      reversalRisk * 0.3 +
      (1 - confidenceStability) * 0.15 +
      Math.abs(1 - liquidityQuality) * 0.1
    );

    // Should reduce exposure?
    const reduceThreshold = aggressiveness === 'conservative' ? 0.4
      : aggressiveness === 'moderate' ? 0.55 : 0.7;
    const shouldReduceExposure = riskScore > reduceThreshold;

    return { riskScore, confidenceStability, shouldReduceExposure };
  }

  // ── Layer 4: Final Decision Layer ─────────────────────────────────────
  private computeFinalDecision(
    confirmation: ReturnType<typeof this.computeConfirmation>,
    risk: ReturnType<typeof this.computeRisk>,
    aggressiveness: AggressivenessLevel,
  ): ScoredDecision {
    const weights = WEIGHT_PRESETS[aggressiveness];
    const {
      trendStrength, momentum, volatilityRegime,
      marketDisagreement, orderBookPressure, liquidityQuality,
      reversalRisk,
    } = confirmation;
    const { confidenceStability } = risk;

    // Weighted bullish/bearish/neutral scores
    const bullishScore = (
      Math.max(0, trendStrength) * weights.trendStrength +
      Math.max(0, momentum) * weights.momentum +
      Math.max(0, volatilityRegime) * weights.volatilityRegime +
      (1 - marketDisagreement) * weights.marketDisagreement * 0.5 +
      Math.max(0, orderBookPressure) * weights.orderBookPressure +
      Math.max(0, liquidityQuality) * weights.liquidityQuality +
      (1 - reversalRisk) * weights.reversalRisk +
      confidenceStability * weights.confidenceStability
    );

    const bearishScore = (
      Math.max(0, -trendStrength) * weights.trendStrength +
      Math.max(0, -momentum) * weights.momentum +
      Math.max(0, -volatilityRegime) * weights.volatilityRegime +
      (1 - marketDisagreement) * weights.marketDisagreement * 0.5 +
      Math.max(0, -orderBookPressure) * weights.orderBookPressure +
      Math.max(0, -liquidityQuality) * weights.liquidityQuality +
      reversalRisk * weights.reversalRisk +
      (1 - confidenceStability) * weights.confidenceStability
    );

    const neutralScore = (
      marketDisagreement * weights.marketDisagreement +
      (1 - Math.abs(trendStrength)) * weights.trendStrength * 0.3 +
      (1 - Math.abs(momentum)) * weights.momentum * 0.2
    );

    // Normalize
    const total = bullishScore + bearishScore + neutralScore;
    const normBull = total > 0 ? (bullishScore / total) * 100 : 33;
    const normBear = total > 0 ? (bearishScore / total) * 100 : 33;
    const normNeutral = total > 0 ? (neutralScore / total) * 100 : 34;

    // Determine decision
    let finalRecommendation: TerminalDecision;
    const thresholds = CONFIDENCE_THRESHOLDS[aggressiveness];
    const dominantScore = Math.max(normBull, normBear);
    const edge = dominantScore - normNeutral;

    if (risk.shouldReduceExposure) {
      finalRecommendation = 'REDUCE_EXPOSURE';
    } else if (edge < 10 || normNeutral > 40) {
      finalRecommendation = 'WAIT';
    } else if (normBull > normBear && edge > 15) {
      finalRecommendation = 'BUY_YES';
    } else if (normBear > normBull && edge > 15) {
      finalRecommendation = 'BUY_NO';
    } else {
      finalRecommendation = 'WAIT';
    }

    // Confidence score
    const confidenceScore = Math.min(100, Math.round(
      dominantScore * 0.6 + edge * 0.3 + confidenceStability * 20
    ));

    // Trade quality
    const tradeQuality: TradeQuality = confidenceScore >= thresholds.high
      ? 'High' : confidenceScore >= thresholds.medium ? 'Medium' : 'Low';

    return {
      bullishScore: Math.round(normBull),
      bearishScore: Math.round(normBear),
      neutralScore: Math.round(normNeutral),
      finalRecommendation,
      confidenceScore,
      tradeQuality,
    };
  }

  // ── Generate trajectory predictions ───────────────────────────────────
  private generateTrajectory(
    candles: Candle[],
    scored: ScoredDecision,
    confirmation: ReturnType<typeof this.computeConfirmation>,
  ): TrajectoryPrediction[] {
    const latestPrice = candles[candles.length - 1]?.close ?? 0;
    if (latestPrice === 0) return [];

    const { trendStrength, momentum, volatilityRegime } = confirmation;
    const direction = scored.finalRecommendation === 'BUY_YES' ? 'up'
      : scored.finalRecommendation === 'BUY_NO' ? 'down' : 'sideways';

    const baseVol = candles.slice(-20).reduce((s, c) => s + (c.high - c.low), 0) / 20;
    const volPct = baseVol / latestPrice;

    // Momentum/vol scaling for trajectory strength
    const momentumFactor = Math.abs(momentum) > 0.3 ? 1.5 : Math.abs(momentum) > 0.1 ? 1.2 : 1.0;
    const volFactor = volatilityRegime > 0.5 ? 1.3 : volatilityRegime > 0.2 ? 1.1 : 1.0;

    const baseProb = direction === 'up' ? scored.bullishScore / 100
      : direction === 'down' ? scored.bearishScore / 100
      : scored.neutralScore / 100;

    return [
      {
        timeframe: '1m',
        direction,
        confidence: Math.min(0.95, (scored.confidenceScore * 0.9 / 100) * momentumFactor),
        expectedMove: volPct * 25 * volFactor,
        probability: baseProb,
        probabilityBand: {
          lower: Math.max(0.1, baseProb - 0.15),
          upper: Math.min(0.9, baseProb + 0.15),
        },
        invalidationLevel: latestPrice * (1 - volPct * 50 * volFactor * (direction === 'up' ? 1 : -1)),
      },
      {
        timeframe: '5m',
        direction,
        confidence: Math.min(0.9, (scored.confidenceScore * 0.75 / 100) * momentumFactor),
        expectedMove: volPct * 60 * volFactor,
        probability: baseProb * 0.95,
        probabilityBand: {
          lower: Math.max(0.1, baseProb * 0.95 - 0.2),
          upper: Math.min(0.9, baseProb * 0.95 + 0.2),
        },
        invalidationLevel: latestPrice * (1 - volPct * 100 * volFactor * (direction === 'up' ? 1 : -1)),
      },
      {
        timeframe: '15m',
        direction,
        confidence: Math.min(0.85, (scored.confidenceScore * 0.6 / 100) * momentumFactor),
        expectedMove: volPct * 120 * volFactor,
        probability: baseProb * 0.9,
        probabilityBand: {
          lower: Math.max(0.1, baseProb * 0.9 - 0.25),
          upper: Math.min(0.9, baseProb * 0.9 + 0.25),
        },
        invalidationLevel: latestPrice * (1 - volPct * 200 * volFactor * (direction === 'up' ? 1 : -1)),
      },
    ];
  }

  // ── Generate explanation ──────────────────────────────────────────────
  private generateExplanation(
    scored: ScoredDecision,
    confirmation: ReturnType<typeof this.computeConfirmation>,
    risk: ReturnType<typeof this.computeRisk>,
  ): { explanation: string; riskNotes: string; invalidationConditions: string; whatWouldChangeDecision: string } {
    const { trendStrength, momentum, volatilityRegime, marketDisagreement, reversalRisk } = confirmation;
    const { riskScore, confidenceStability } = risk;

    // Explanation bullets
    const bullets: string[] = [];
    if (Math.abs(trendStrength) > 0.3) {
      bullets.push(trendStrength > 0 ? 'Trend aligned bullish' : 'Trend aligned bearish');
    } else {
      bullets.push('Trend unclear / ranging');
    }
    if (Math.abs(momentum) > 0.3) {
      bullets.push(momentum > 0 ? 'Momentum accelerating up' : 'Momentum accelerating down');
    }
    if (marketDisagreement > 0.5) {
      bullets.push('High signal disagreement — mixed setup');
    }
    if (reversalRisk > 0.4) {
      bullets.push('Reversal risk elevated');
    }
    if (confidenceStability < 0.4) {
      bullets.push('Confidence unstable — signals shifting');
    }

    const explanation = bullets.join('. ') + '.';

    // Risk notes
    const riskBullets: string[] = [];
    if (riskScore > 0.5) riskBullets.push('Elevated risk environment');
    if (volatilityRegime < -0.3) riskBullets.push('High volatility regime');
    if (reversalRisk > 0.5) riskBullets.push('Mean reversion signals counter-trend');
    if (marketDisagreement > 0.6) riskBullets.push('No clear consensus among indicators');
    const riskNotes = riskBullets.length > 0 ? riskBullets.join('. ') + '.' : 'Risk within normal bounds.';

    // Invalidation conditions
    const invalidationConditions = scored.finalRecommendation === 'BUY_YES'
      ? `Invalidated if price drops below key support or bearish momentum accelerates.`
      : scored.finalRecommendation === 'BUY_NO'
      ? `Invalidated if price breaks above resistance or bullish momentum accelerates.`
      : 'No active position to invalidate.';

    // What would change the decision
    const whatWouldChangeDecision = scored.finalRecommendation === 'WAIT'
      ? 'Stronger trend alignment, lower disagreement, or clearer momentum would shift to BUY_YES or BUY_NO.'
      : scored.finalRecommendation === 'BUY_YES'
      ? 'Rising reversal risk, trend breakdown, or high volatility would shift to WAIT or REDUCE_EXPOSURE.'
      : scored.finalRecommendation === 'BUY_NO'
      ? 'Rising reversal risk, trend reversal up, or improving momentum would shift to WAIT or BUY_YES.'
      : 'Lower risk environment and clearer signals would allow re-entry.';

    return { explanation, riskNotes, invalidationConditions, whatWouldChangeDecision };
  }

  // ── Main pipeline ─────────────────────────────────────────────────────
  process(candles: Candle[], settings: TerminalSettings): TerminalSignal | null {
    if (candles.length < 55) return null;

    // Layer 1: Fast signals
    const signals = this.computeFastSignals(candles);
    if (signals.length === 0) return null;

    // Layer 2: Confirmation
    const confirmation = this.computeConfirmation(candles, signals);

    // Layer 3: Risk
    const risk = this.computeRisk(confirmation, settings.aggressiveness);

    // Layer 4: Final decision
    const scored = this.computeFinalDecision(confirmation, risk, settings.aggressiveness);

    // Track confidence history
    this.confidenceHistory.push(scored.confidenceScore);
    if (this.confidenceHistory.length > this.maxConfidenceHistory) {
      this.confidenceHistory.shift();
    }

    // Trajectory
    const trajectory = this.generateTrajectory(candles, scored, confirmation);

    // Explanation
    const { explanation, riskNotes, invalidationConditions, whatWouldChangeDecision } =
      this.generateExplanation(scored, confirmation, risk);

    // Decision flip detection
    const decisionFlipped = this.previousDecision !== null && this.previousDecision !== scored.finalRecommendation;
    this.previousDecision = scored.finalRecommendation;

    // Edge and calibration
    const edge = (Math.max(scored.bullishScore, scored.bearishScore) - scored.neutralScore) / 100;
    const calibrationScore = 0.5; // Would be derived from historical performance

    // Regime classification
    const regime = this.mapRegime(confirmation.regime);
    const regimeConfidence = confirmation.ensemble > 60 || confirmation.ensemble < 40 ? 0.8 : 0.5;

    return {
      decision: scored.finalRecommendation,
      confidence: scored.confidenceScore,
      tradeQuality: scored.tradeQuality,
      explanation,
      riskNotes,
      invalidationConditions,
      whatWouldChangeDecision,
      scoredDecision: scored,
      regime,
      regimeConfidence,
      trajectory,
      edge,
      calibrationScore,
      timestamp: Date.now(),
      decisionFlipped,
      aggressiveness: settings.aggressiveness,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  private mapRegime(regime: MarketRegime): RegimeType {
    if (regime.volatility === 'high') return 'highVolatility';
    if (regime.trend === 'up' || regime.trend === 'down') return 'trend';
    return 'chop';
  }

  private computeVariance(arr: number[]): number {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  }
}
