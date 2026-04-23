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

export interface TrajectoryPrediction {
  timeframe: '1m' | '5m' | '15m';
  direction: 'up' | 'down' | 'sideways';
  confidence: number;
  expectedMove: number; // percent
  probability: number;
  invalidationLevel: number;
}

export interface EnhancedDecisionSignal extends DecisionSignal {
  trajectory: TrajectoryPrediction[];
  edge: number; // edge over random
  calibrationScore: number; // historical accuracy
}

// ── Terminal Decision Types ──────────────────────────────────────────────

export type TerminalDecision = 'BUY_YES' | 'BUY_NO' | 'WAIT' | 'REDUCE_EXPOSURE';
export type TradeQuality = 'High' | 'Medium' | 'Low';
export type AggressivenessLevel = 'conservative' | 'moderate' | 'aggressive';

export interface DecisionScoreWeights {
  trendStrength: number;
  momentum: number;
  volatilityRegime: number;
  marketDisagreement: number;
  orderBookPressure: number;
  liquidityQuality: number;
  reversalRisk: number;
  confidenceStability: number;
}

export interface ScoredDecision {
  bullishScore: number;
  bearishScore: number;
  neutralScore: number;
  finalRecommendation: TerminalDecision;
  confidenceScore: number; // 0-100
  tradeQuality: TradeQuality;
}

export interface TerminalSignal {
  decision: TerminalDecision;
  confidence: number; // 0-100
  tradeQuality: TradeQuality;
  explanation: string;
  riskNotes: string;
  invalidationConditions: string;
  whatWouldChangeDecision: string;
  scoredDecision: ScoredDecision;
  regime: RegimeType;
  regimeConfidence: number;
  trajectory: TrajectoryPrediction[];
  edge: number;
  calibrationScore: number;
  timestamp: number;
  decisionFlipped: boolean; // true if different from previous signal
  aggressiveness: AggressivenessLevel;
}

export interface TerminalSettings {
  aggressiveness: AggressivenessLevel;
  refreshIntervalMs: number;
  alertThreshold: number; // confidence threshold for alerts
  showExplainability: boolean;
  compactMode: boolean;
}
