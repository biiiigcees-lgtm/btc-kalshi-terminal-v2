// /src/utils/contextBuilder.ts
import type { SignalResult, MarketRegime, TradeRecord } from '@/types';

interface ContextParams {
  spotPrice: number;
  coingeckoPrice: number;
  divergencePct: number;
  currentCandle: { open: number; high: number; low: number; close: number; volume: number } | null;
  secondsRemaining: number;
  targetPrice: number | null;
  impliedProbability: number;
  regime: MarketRegime;
  signals: SignalResult[];
  ensembleProbability: number;
  edge: number;
  expectedValue: number;
  kellyFraction: number;
  recommendedBet: number;
  cappedFraction: number;
  volatilityAdjusted: boolean;
  accountBalance: number;
  intendedBet: number;
  rollingWinRate20: number;
  profitFactor: number;
  sharpeRatio: number;
  consecutiveLosses: number;
  totalPnL: number;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function buildContext(p: ContextParams): string {
  const timestamp = new Date().toISOString();
  const divergenceFlag = p.divergencePct > 0.2 ? `⚠ EXCEEDS THRESHOLD` : `OK`;
  const candle = p.currentCandle;

  const signalLines = p.signals.map(s =>
    `  - ${s.name}: ${s.value} | Confidence: ${s.confidence.toFixed(2)} | ${s.direction.toUpperCase()}`
  ).join('\n');

  return `WINDOW ANALYSIS REQUEST — ${timestamp}

MARKET DATA:
- BTC Spot (WebSocket): $${p.spotPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
- BTC Spot (CoinGecko): $${p.coingeckoPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
- Price Divergence: ${p.divergencePct.toFixed(4)}% [${divergenceFlag}]
- Current 15m Candle: O:${candle?.open ?? 'N/A'} H:${candle?.high ?? 'N/A'} L:${candle?.low ?? 'N/A'} C:${candle?.close ?? 'N/A'} V:${candle?.volume ?? 'N/A'}
- Time Remaining in Window: ${fmt(p.secondsRemaining)}

KALSHI CONTRACT:
- Target Price: ${p.targetPrice ? `$${p.targetPrice.toLocaleString()}` : 'NOT SET'}
- Implied Probability: ${p.impliedProbability}%

MARKET REGIME: ${p.regime.trend.toUpperCase()} | ${p.regime.volatility.toUpperCase()} VOLATILITY

SIGNAL READINGS:
${signalLines}

ENSEMBLE PREDICTION: ${p.ensembleProbability.toFixed(2)}% (probability of UP move)

COMPUTED METRICS:
- Edge: ${p.edge.toFixed(2)}%
- Expected Value: ${(p.expectedValue * 100).toFixed(2)}%
- Kelly Fraction: ${p.kellyFraction.toFixed(4)}
- Recommended Bet: $${p.recommendedBet.toFixed(2)} (${(p.cappedFraction * 100).toFixed(2)}% of account)
- Volatility Adjusted: ${p.volatilityAdjusted ? 'YES' : 'NO'}

ACCOUNT STATE:
- Balance: $${p.accountBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
- Intended Bet: $${p.intendedBet.toFixed(2)}

ROLLING PERFORMANCE (last 20 trades):
- Win Rate: ${p.rollingWinRate20.toFixed(1)}%
- Profit Factor: ${p.profitFactor.toFixed(2)}x
- Sharpe Ratio: ${p.sharpeRatio.toFixed(3)}
- Consecutive Losses: ${p.consecutiveLosses}
- Total P&L: $${p.totalPnL.toFixed(2)}

Provide your complete trade analysis and recommendation.`;
}
