// /src/types/index.ts

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalDirection = 'bullish' | 'bearish' | 'neutral';
export type SignalCategory = 'momentum' | 'meanReversion' | 'trend';
export type TrendRegime = 'up' | 'down' | 'ranging';
export type VolatilityRegime = 'high' | 'normal' | 'low';

export interface MarketRegime {
  trend: TrendRegime;
  volatility: VolatilityRegime;
}

export interface SignalResult {
  name: string;
  value: number;
  confidence: number;
  direction: SignalDirection;
  category: SignalCategory;
}

export interface TradeRecord {
  id: string;
  windowOpen: string;
  direction: 'UP' | 'DOWN';
  predictedPct: number;
  kalshiPct: number;
  edge: number;
  bet: number;
  result: 'win' | 'loss' | 'pending';
  pnl: number;
}

export type Trade = TradeRecord;

export interface KellyResult {
  kellyFraction: number;
  fractionalKelly: number;
  cappedFraction: number;
  recommendedBet: number;
  volatilityAdjusted: boolean;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'error';
export type TradeDirection = 'UP' | 'DOWN';

export type RiskAlertType =
  | 'consecutive_losses_2'
  | 'consecutive_losses_3'
  | 'daily_loss_limit'
  | 'model_degradation'
  | 'drawdown_warning'
  | 'critical_drawdown'
  | 'regime_shift'
  | 'data_divergence';

export interface RiskAlert {
  type: RiskAlertType;
  message: string;
  color: 'amber' | 'red';
  active: boolean;
}

// AI Decision Engine Types
export type RegimeType = 'trend' | 'chop' | 'breakout' | 'meanReversion' | 'highVolatility' | 'lowLiquidity';
export type RiskTier = 'low' | 'medium' | 'high' | 'extreme';
export type SignalStrength = 'weak' | 'moderate' | 'strong' | 'extreme';

export interface MarketData {
  price: number;
  volume: number;
  spread: number;
  timestamp: number;
  momentum: number;
  orderFlow: number;
  volatility: number;
}

export interface NormalizedInput {
  priceZScore: number;
  volumeZScore: number;
  spreadNormalized: number;
  momentumNormalized: number;
  orderFlowNormalized: number;
  volatilityNormalized: number;
  qualityScore: number;
}

export interface ModuleScore {
  name: string;
  score: number; // -1 to 1
  confidence: number;
  explanation: string;
}

export interface RegimeClassification {
  regime: RegimeType;
  confidence: number;
  trendDirection: 'up' | 'down' | 'neutral';
  volatilityLevel: 'low' | 'normal' | 'high' | 'extreme';
  liquidityLevel: 'low' | 'normal' | 'high';
}

export interface DecisionSignal {
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0 to 1
  signalStrength: SignalStrength;
  timeframe: string;
  regime: RegimeType;
  invalidationLevel: number;
  riskScore: number; // 0 to 1
  riskTier: RiskTier;
  explanation: string;
  timestamp: number;
  positionSizeGuidance?: number;
  cooldownRemaining: number;
}

export interface PipelineMetrics {
  feedTime: number;
  processingTime: number;
  inferenceTime: number;
  renderTime: number;
  totalLatency: number;
  dataFreshness: number;
  backpressureActive: boolean;
  degradedMode: boolean;
}

export interface SignalPerformance {
  hitRate: number;
  precision: number;
  recall: number;
  expectancy: number;
  totalSignals: number;
  winningSignals: number;
  avgReturn: number;
}

export interface SignalCooldown {
  signalType: string;
  lastTriggered: number;
  cooldownMs: number;
}

export interface DecisionEngineConfig {
  minConfidenceThreshold: number;
  maxLatencyMs: number;
  minDataQualityScore: number;
  cooldownMs: number;
  enableBackpressure: boolean;
  bufferSize: number;
}
