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
