import type { MarketRegime } from '@/types';

type ModelType = 'momentum' | 'meanReversion' | 'trendFollowing';

interface ModelPerformance {
  accuracy: number;
  recentAccuracy: number;
  sampleSize: number;
}

const modelPerformance: Record<ModelType, ModelPerformance> = {
  momentum: { accuracy: 0.55, recentAccuracy: 0.58, sampleSize: 100 },
  meanReversion: { accuracy: 0.52, recentAccuracy: 0.51, sampleSize: 100 },
  trendFollowing: { accuracy: 0.53, recentAccuracy: 0.55, sampleSize: 100 },
};

export function selectModelForRegime(regime: MarketRegime): {
  model: ModelType;
  confidence: number;
  reason: string;
} {
  const { trend, volatility } = regime;
  
  // Momentum models perform best in trending markets
  if (trend === 'up' || trend === 'down') {
    if (volatility === 'normal' || volatility === 'low') {
      return {
        model: 'momentum',
        confidence: modelPerformance.momentum.recentAccuracy,
        reason: `Trending ${trend} market with ${volatility} volatility favors momentum strategy`,
      };
    }
  }
  
  // Mean reversion models perform best in ranging markets
  if (trend === 'ranging') {
    if (volatility === 'normal' || volatility === 'high') {
      return {
        model: 'meanReversion',
        confidence: modelPerformance.meanReversion.recentAccuracy,
        reason: `Ranging market with ${volatility} volatility favors mean reversion strategy`,
      };
    }
  }
  
  // Trend following as fallback for strong trends
  if (trend === 'up' || trend === 'down') {
    return {
      model: 'trendFollowing',
      confidence: modelPerformance.trendFollowing.recentAccuracy,
      reason: `Strong ${trend} trend favors trend following strategy`,
    };
  }
  
  // Default to momentum
  return {
    model: 'momentum',
    confidence: modelPerformance.momentum.recentAccuracy,
    reason: 'Default momentum model selected',
  };
}

export function updateModelPerformance(
  model: ModelType,
  correct: boolean
): void {
  const perf = modelPerformance[model];
  perf.sampleSize++;
  
  // Update recent accuracy (last 20 samples weighted more heavily)
  const recentWeight = 0.3;
  perf.recentAccuracy = perf.recentAccuracy * (1 - recentWeight) + (correct ? 1 : 0) * recentWeight;
  
  // Update overall accuracy
  perf.accuracy = perf.accuracy * (perf.sampleSize - 1) / perf.sampleSize + (correct ? 1 : 0) / perf.sampleSize;
}

export function getModelPerformance(): Record<ModelType, ModelPerformance> {
  return { ...modelPerformance };
}
