// src/engine/decisionEngine.ts — AI Decision Engine Pipeline
// Multi-stage pipeline for high-quality signal generation with regime awareness
import type {
  MarketData,
  NormalizedInput,
  RegimeClassification,
  ModuleScore,
  DecisionSignal,
  PipelineMetrics,
  SignalPerformance,
  SignalCooldown,
  DecisionEngineConfig,
  Candle,
  RegimeType,
} from '@/types';

// Default configuration
const DEFAULT_CONFIG: DecisionEngineConfig = {
  minConfidenceThreshold: 0.65,
  maxLatencyMs: 500,
  minDataQualityScore: 0.7,
  cooldownMs: 30000, // 30 seconds between similar signals
  enableBackpressure: true,
  bufferSize: 100,
};

export class DecisionEngine {
  private config: DecisionEngineConfig;
  private cooldowns: Map<string, SignalCooldown> = new Map();
  private performanceMetrics: Map<string, SignalPerformance> = new Map();
  private dataBuffer: MarketData[] = [];
  private processing = false;
  private metrics: PipelineMetrics = {
    feedTime: 0,
    processingTime: 0,
    inferenceTime: 0,
    renderTime: 0,
    totalLatency: 0,
    dataFreshness: 0,
    backpressureActive: false,
    degradedMode: false,
  };

  constructor(config: Partial<DecisionEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Stage 1: Ingest and buffer market data
  ingestData(data: MarketData): void {
    const feedStart = performance.now();
    
    if (this.config.enableBackpressure && this.dataBuffer.length >= this.config.bufferSize) {
      this.metrics.backpressureActive = true;
      // Drop oldest data to maintain buffer size
      this.dataBuffer.shift();
    } else {
      this.metrics.backpressureActive = false;
    }

    this.dataBuffer.push(data);
    this.metrics.feedTime = performance.now() - feedStart;
    this.metrics.dataFreshness = Date.now() - data.timestamp;
  }

  // Stage 2: Normalize and validate inputs
  normalizeInputs(data: MarketData[]): NormalizedInput {
    if (data.length < 20) {
      return {
        priceZScore: 0,
        volumeZScore: 0,
        spreadNormalized: 0.5,
        momentumNormalized: 0,
        orderFlowNormalized: 0,
        volatilityNormalized: 0.5,
        qualityScore: 0,
      };
    }

    const prices = data.map(d => d.price);
    const volumes = data.map(d => d.volume);
    const spreads = data.map(d => d.spread);
    const momentums = data.map(d => d.momentum);
    const orderFlows = data.map(d => d.orderFlow);
    const volatilities = data.map(d => d.volatility);

    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = (arr: number[]) => {
      const m = mean(arr);
      return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
    };

    const priceMean = mean(prices);
    const priceStd = std(prices);
    const volumeMean = mean(volumes);
    const volumeStd = std(volumes);
    const spreadMean = mean(spreads);
    const spreadStd = std(spreads);

    const latest = data[data.length - 1];
    const priceZScore = priceStd > 0 ? (latest.price - priceMean) / priceStd : 0;
    const volumeZScore = volumeStd > 0 ? (latest.volume - volumeMean) / volumeStd : 0;
    const spreadNormalized = spreadStd > 0 ? (latest.spread - spreadMean) / spreadStd + 0.5 : 0.5;
    const momentumNormalized = Math.tanh(latest.momentum / 100);
    const orderFlowNormalized = Math.tanh(latest.orderFlow / 1000);
    const volatilityNormalized = Math.tanh(latest.volatility / 50);

    // Data quality score based on freshness, spread, and volume
    const age = Date.now() - latest.timestamp;
    const freshnessScore = Math.max(0, 1 - age / 1000); // degrade over 1 second
    const spreadScore = Math.max(0, 1 - latest.spread / spreadMean);
    const volumeScore = Math.min(1, latest.volume / volumeMean);
    const qualityScore = (freshnessScore * 0.4 + spreadScore * 0.3 + volumeScore * 0.3);

    return {
      priceZScore,
      volumeZScore,
      spreadNormalized,
      momentumNormalized,
      orderFlowNormalized,
      volatilityNormalized,
      qualityScore,
    };
  }

  // Stage 3: Detect market regime
  detectRegime(candles: Candle[]): RegimeClassification {
    if (candles.length < 55) {
      return {
        regime: 'chop',
        confidence: 0.3,
        trendDirection: 'neutral',
        volatilityLevel: 'normal',
        liquidityLevel: 'normal',
      };
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    // Calculate EMAs for trend detection
    const ema = (values: number[], period: number) => {
      if (values.length < period) return [];
      const k = 2 / (period + 1);
      let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const result = [e];
      for (let i = period; i < values.length; i++) {
        e = values[i] * k + e * (1 - k);
        result.push(e);
      }
      return result;
    };

    const ema9 = ema(closes, 9);
    const ema21 = ema(closes, 21);
    const ema50 = ema(closes, 50);

    if (!ema9.length || !ema21.length || !ema50.length) {
      return {
        regime: 'chop',
        confidence: 0.3,
        trendDirection: 'neutral',
        volatilityLevel: 'normal',
        liquidityLevel: 'normal',
      };
    }

    const v9 = ema9[ema9.length - 1];
    const v21 = ema21[ema21.length - 1];
    const v50 = ema50[ema50.length - 1];
    const price = closes[closes.length - 1];

    // Trend detection
    const bullAlign = v9 > v21 && v21 > v50 && price > v9;
    const bearAlign = v9 < v21 && v21 < v50 && price < v9;
    const trendDirection = bullAlign ? 'up' : bearAlign ? 'down' : 'neutral';

    // Volatility detection using ATR
    const trueRange = () => {
      const tr: number[] = [];
      for (let i = 1; i < highs.length; i++) {
        tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
      }
      return tr;
    };

    const rma = (values: number[], period: number) => {
      if (values.length < period) return [];
      let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const result = [e];
      for (let i = period; i < values.length; i++) {
        e = (e * (period - 1) + values[i]) / period;
        result.push(e);
      }
      return result;
    };

    const tr = trueRange();
    const atrs = rma(tr, 14);
    const currentATR = atrs[atrs.length - 1];
    const avgATR = atrs.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const atrRatio = avgATR > 0 ? currentATR / avgATR : 1;

    let volatilityLevel: 'low' | 'normal' | 'high' | 'extreme';
    if (atrRatio > 2) volatilityLevel = 'extreme';
    else if (atrRatio > 1.5) volatilityLevel = 'high';
    else if (atrRatio < 0.6) volatilityLevel = 'low';
    else volatilityLevel = 'normal';

    // Liquidity detection
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    const liquidityLevel = volumeRatio < 0.5 ? 'low' : volumeRatio > 1.5 ? 'high' : 'normal';

    // Regime classification
    let regime: RegimeType;
    let confidence = 0.5;

    if (volatilityLevel === 'extreme') {
      regime = 'highVolatility';
      confidence = 0.8;
    } else if (liquidityLevel === 'low') {
      regime = 'lowLiquidity';
      confidence = 0.7;
    } else if (bullAlign || bearAlign) {
      regime = 'trend';
      confidence = 0.75;
    } else if (atrRatio > 1.3) {
      regime = 'breakout';
      confidence = 0.6;
    } else if (atrRatio < 0.8) {
      regime = 'meanReversion';
      confidence = 0.65;
    } else {
      regime = 'chop';
      confidence = 0.5;
    }

    return {
      regime,
      confidence,
      trendDirection,
      volatilityLevel,
      liquidityLevel,
    };
  }

  // Stage 4: Generate module scores
  generateModuleScores(normalized: NormalizedInput, regime: RegimeClassification): ModuleScore[] {
    const scores: ModuleScore[] = [];

    // Trend module
    const trendScore = normalized.momentumNormalized * (regime.trendDirection === 'up' ? 1 : regime.trendDirection === 'down' ? -1 : 0);
    scores.push({
      name: 'trend',
      score: trendScore,
      confidence: regime.confidence,
      explanation: `Trend score based on momentum and ${regime.trendDirection} direction`,
    });

    // Momentum module
    scores.push({
      name: 'momentum',
      score: normalized.momentumNormalized,
      confidence: Math.abs(normalized.momentumNormalized),
      explanation: 'Momentum from price velocity',
    });

    // Volatility module
    const volScore = normalized.volatilityNormalized > 0.5 ? -0.5 : 0.3;
    scores.push({
      name: 'volatility',
      score: volScore,
      confidence: Math.abs(normalized.volatilityNormalized),
      explanation: `Volatility favors ${volScore > 0 ? 'mean reversion' : 'trend following'}`,
    });

    // Volume/participation module
    scores.push({
      name: 'volume',
      score: normalized.volumeZScore > 0 ? 0.3 : -0.2,
      confidence: Math.min(1, Math.abs(normalized.volumeZScore) / 2),
      explanation: 'Volume confirms signal strength',
    });

    // Breakout module
    const breakoutScore = Math.abs(normalized.priceZScore) > 1.5 ? Math.sign(normalized.priceZScore) * 0.7 : 0;
    scores.push({
      name: 'breakout',
      score: breakoutScore,
      confidence: Math.min(1, Math.abs(normalized.priceZScore) / 2),
      explanation: 'Price deviation from mean',
    });

    // Mean reversion module
    const mrScore = normalized.priceZScore < -1 ? 0.6 : normalized.priceZScore > 1 ? -0.6 : 0;
    scores.push({
      name: 'meanReversion',
      score: mrScore,
      confidence: Math.min(1, Math.abs(normalized.priceZScore) / 2),
      explanation: 'Price far from mean suggests reversion',
    });

    // Liquidity filter
    const liquidityScore = normalized.spreadNormalized < 0.3 ? 0.2 : normalized.spreadNormalized > 0.7 ? -0.4 : 0;
    scores.push({
      name: 'liquidity',
      score: liquidityScore,
      confidence: 1 - normalized.spreadNormalized,
      explanation: 'Spread impacts execution quality',
    });

    return scores;
  }

  // Stage 5: Weight ensemble based on regime
  weightEnsemble(scores: ModuleScore[], regime: RegimeClassification): number {
    const weights: Record<RegimeType, Record<string, number>> = {
      trend: {
        trend: 1.5,
        momentum: 1.3,
        volatility: 0.8,
        volume: 1.2,
        breakout: 1.4,
        meanReversion: 0.5,
        liquidity: 1.0,
      },
      chop: {
        trend: 0.6,
        momentum: 0.8,
        volatility: 1.2,
        volume: 1.0,
        breakout: 0.7,
        meanReversion: 1.5,
        liquidity: 1.2,
      },
      breakout: {
        trend: 1.2,
        momentum: 1.4,
        volatility: 1.0,
        volume: 1.3,
        breakout: 1.6,
        meanReversion: 0.4,
        liquidity: 0.9,
      },
      meanReversion: {
        trend: 0.5,
        momentum: 0.9,
        volatility: 1.3,
        volume: 1.1,
        breakout: 0.6,
        meanReversion: 1.6,
        liquidity: 1.1,
      },
      highVolatility: {
        trend: 0.7,
        momentum: 1.0,
        volatility: 1.5,
        volume: 1.2,
        breakout: 0.8,
        meanReversion: 1.2,
        liquidity: 1.4,
      },
      lowLiquidity: {
        trend: 0.5,
        momentum: 0.7,
        volatility: 0.8,
        volume: 0.6,
        breakout: 0.5,
        meanReversion: 0.7,
        liquidity: 2.0,
      },
    };

    const regimeWeights = weights[regime.regime] || weights.chop;
    let totalWeight = 0;
    let weightedSum = 0;

    for (const score of scores) {
      const weight = regimeWeights[score.name] || 1.0;
      weightedSum += score.score * weight * score.confidence;
      totalWeight += weight * score.confidence;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  // Stage 6: Confidence and risk layer
  computeConfidenceAndRisk(
    ensembleScore: number,
    normalized: NormalizedInput,
    regime: RegimeClassification,
    metrics: PipelineMetrics
  ): { confidence: number; riskScore: number; riskTier: 'low' | 'medium' | 'high' | 'extreme' } {
    let confidence = Math.abs(ensembleScore);
    let riskScore = 0;

    // Downgrade for poor data quality
    if (normalized.qualityScore < this.config.minDataQualityScore) {
      confidence *= 0.6;
      riskScore += 0.3;
    }

    // Downgrade for high latency
    if (metrics.totalLatency > this.config.maxLatencyMs) {
      confidence *= 0.7;
      riskScore += 0.2;
    }

    // Downgrade for stale data
    if (metrics.dataFreshness > 1000) {
      confidence *= 0.8;
      riskScore += 0.15;
    }

    // Downgrade for wide spread
    if (normalized.spreadNormalized > 0.7) {
      confidence *= 0.75;
      riskScore += 0.25;
    }

    // Downgrade for extreme volatility
    if (regime.volatilityLevel === 'extreme') {
      confidence *= 0.7;
      riskScore += 0.3;
    }

    // Downgrade for unknown regime
    if (regime.confidence < 0.5) {
      confidence *= 0.8;
      riskScore += 0.2;
    }

    // Calibrate confidence
    confidence = Math.max(0, Math.min(1, confidence));

    // Determine risk tier
    let riskTier: 'low' | 'medium' | 'high' | 'extreme';
    if (riskScore < 0.2) riskTier = 'low';
    else if (riskScore < 0.4) riskTier = 'medium';
    else if (riskScore < 0.6) riskTier = 'high';
    else riskTier = 'extreme';

    return { confidence, riskScore, riskTier };
  }

  // Stage 7: Check cooldowns
  checkCooldown(signalType: string): number {
    const cooldown = this.cooldowns.get(signalType);
    if (!cooldown) return 0;

    const elapsed = Date.now() - cooldown.lastTriggered;
    const remaining = Math.max(0, cooldown.cooldownMs - elapsed);

    if (remaining === 0) {
      this.cooldowns.delete(signalType);
    }

    return remaining;
  }

  setCooldown(signalType: string): void {
    this.cooldowns.set(signalType, {
      signalType,
      lastTriggered: Date.now(),
      cooldownMs: this.config.cooldownMs,
    });
  }

  // Main pipeline: Process data and generate decision signal
  async process(candles: Candle[]): Promise<DecisionSignal | null> {
    const pipelineStart = performance.now();

    // Check if processing
    if (this.processing) {
      return null;
    }

    this.processing = true;

    try {
      // Stage 1: Get latest data from buffer
      if (this.dataBuffer.length === 0) {
        this.processing = false;
        return null;
      }

      const latestData = this.dataBuffer.slice(-20);
      const processingStart = performance.now();

      // Stage 2: Normalize inputs
      const normalized = this.normalizeInputs(latestData);
      this.metrics.processingTime = performance.now() - processingStart;

      // Stage 3: Detect regime
      const regime = this.detectRegime(candles);

      // Stage 4: Generate module scores
      const inferenceStart = performance.now();
      const moduleScores = this.generateModuleScores(normalized, regime);

      // Stage 5: Weight ensemble
      const ensembleScore = this.weightEnsemble(moduleScores, regime);
      this.metrics.inferenceTime = performance.now() - inferenceStart;

      // Stage 6: Compute confidence and risk
      const { confidence, riskScore, riskTier } = this.computeConfidenceAndRisk(
        ensembleScore,
        normalized,
        regime,
        this.metrics
      );

      // Check minimum confidence threshold
      if (confidence < this.config.minConfidenceThreshold) {
        this.processing = false;
        return null;
      }

      // Check cooldown
      const signalType = `${regime.regime}_${ensembleScore > 0 ? 'bull' : 'bear'}`;
      const cooldownRemaining = this.checkCooldown(signalType);
      if (cooldownRemaining > 0) {
        this.processing = false;
        return null;
      }

      // Determine direction and strength
      const direction = ensembleScore > 0.3 ? 'bullish' : ensembleScore < -0.3 ? 'bearish' : 'neutral';
      let signalStrength: 'weak' | 'moderate' | 'strong' | 'extreme';
      if (confidence < 0.5) signalStrength = 'weak';
      else if (confidence < 0.65) signalStrength = 'moderate';
      else if (confidence < 0.8) signalStrength = 'strong';
      else signalStrength = 'extreme';

      // Calculate invalidation level (price level that would invalidate the signal)
      const latestPrice = latestData[latestData.length - 1].price;
      const invalidationLevel = direction === 'bullish' 
        ? latestPrice * (1 - 0.002) 
        : direction === 'bearish' 
        ? latestPrice * (1 + 0.002) 
        : latestPrice;

      // Generate explanation
      const topModules = moduleScores
        .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
        .slice(0, 3);
      const explanation = `${regime.regime.toUpperCase()} regime. Top signals: ${topModules.map(m => m.name).join(', ')}. Confidence: ${(confidence * 100).toFixed(0)}%.`;

      // Set cooldown
      this.setCooldown(signalType);

      // Final metrics
      this.metrics.totalLatency = performance.now() - pipelineStart;
      this.metrics.renderTime = 0; // Set by caller

      // Check degraded mode
      this.metrics.degradedMode = 
        this.metrics.totalLatency > this.config.maxLatencyMs * 2 ||
        normalized.qualityScore < this.config.minDataQualityScore * 0.5;

      const signal: DecisionSignal = {
        direction,
        confidence,
        signalStrength,
        timeframe: '15m',
        regime: regime.regime,
        invalidationLevel,
        riskScore,
        riskTier,
        explanation,
        timestamp: Date.now(),
        positionSizeGuidance: this.calculatePositionSize(confidence, riskTier),
        cooldownRemaining: 0,
      };

      this.processing = false;
      return signal;
    } catch (error) {
      this.processing = false;
      console.error('Decision engine error:', error);
      return null;
    }
  }

  private calculatePositionSize(confidence: number, riskTier: 'low' | 'medium' | 'high' | 'extreme'): number {
    const baseSize = confidence * 0.1; // Base 10% of capital
    const riskMultiplier = riskTier === 'low' ? 1.0 : riskTier === 'medium' ? 0.75 : riskTier === 'high' ? 0.5 : 0.25;
    return baseSize * riskMultiplier;
  }

  getMetrics(): PipelineMetrics {
    return { ...this.metrics };
  }

  updateConfig(config: Partial<DecisionEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  resetCooldowns(): void {
    this.cooldowns.clear();
  }
}
