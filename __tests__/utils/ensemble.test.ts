import { computeEnsemble } from '@/utils/ensemble';
import type { SignalResult, MarketRegime } from '@/types';

describe('computeEnsemble', () => {
  const createSignal = (
    name: string,
    direction: 'bullish' | 'bearish' | 'neutral',
    confidence: number,
    category: 'momentum' | 'meanReversion' | 'trend'
  ): SignalResult => ({
    name,
    value: 0,
    confidence,
    direction,
    category,
  });

  const createRegime = (trend: 'up' | 'down' | 'ranging', volatility: 'low' | 'high'): MarketRegime => ({
    trend,
    volatility,
  });

  it('returns 50 when signals array is empty', () => {
    const regime = createRegime('up', 'low');
    expect(computeEnsemble([], regime)).toBe(50);
  });

  it('returns 50 for neutral signals', () => {
    const signals = [
      createSignal('Test1', 'neutral', 0.5, 'momentum'),
      createSignal('Test2', 'neutral', 0.5, 'trend'),
    ];
    const regime = createRegime('up', 'low');
    expect(computeEnsemble(signals, regime)).toBe(50);
  });

  it('computes bullish probability correctly', () => {
    const signals = [
      createSignal('Test1', 'bullish', 1.0, 'trend'),
    ];
    const regime = createRegime('up', 'low');
    expect(computeEnsemble(signals, regime)).toBe(100);
  });

  it('computes bearish probability correctly', () => {
    const signals = [
      createSignal('Test1', 'bearish', 1.0, 'trend'),
    ];
    const regime = createRegime('up', 'low');
    expect(computeEnsemble(signals, regime)).toBe(0);
  });

  it('weights momentum signals higher in trending regime', () => {
    const signals = [
      createSignal('Momentum', 'bullish', 0.8, 'momentum'),
      createSignal('MeanRev', 'bullish', 0.8, 'meanReversion'),
    ];
    const regime = createRegime('up', 'low');
    const prob = computeEnsemble(signals, regime);
    expect(prob).toBeGreaterThan(50);
  });

  it('weights mean reversion signals higher in ranging regime', () => {
    const signals = [
      createSignal('Momentum', 'bullish', 0.8, 'momentum'),
      createSignal('MeanRev', 'bullish', 0.8, 'meanReversion'),
    ];
    const regime = createRegime('ranging', 'low');
    const prob = computeEnsemble(signals, regime);
    expect(prob).toBeGreaterThan(50);
  });

  it('reduces weight in high volatility regime', () => {
    const signals = [
      createSignal('Test', 'bullish', 1.0, 'trend'),
    ];
    const regimeLow = createRegime('up', 'low');
    const regimeHigh = createRegime('up', 'high');
    const probLow = computeEnsemble(signals, regimeLow);
    const probHigh = computeEnsemble(signals, regimeHigh);
    expect(probHigh).toBeLessThan(probLow);
  });

  it('clamps result between 0 and 100', () => {
    const signals = [
      createSignal('Test1', 'bullish', 1.0, 'trend'),
      createSignal('Test2', 'bullish', 1.0, 'trend'),
      createSignal('Test3', 'bullish', 1.0, 'trend'),
    ];
    const regime = createRegime('up', 'low');
    const prob = computeEnsemble(signals, regime);
    expect(prob).toBeGreaterThanOrEqual(0);
    expect(prob).toBeLessThanOrEqual(100);
  });

  it('handles mixed bullish and bearish signals', () => {
    const signals = [
      createSignal('Bull', 'bullish', 0.8, 'trend'),
      createSignal('Bear', 'bearish', 0.8, 'trend'),
    ];
    const regime = createRegime('up', 'low');
    const prob = computeEnsemble(signals, regime);
    expect(prob).toBeCloseTo(50, 0);
  });

  it('computes weighted average correctly', () => {
    const signals = [
      createSignal('Strong', 'bullish', 1.0, 'trend'),
      createSignal('Weak', 'bullish', 0.5, 'trend'),
    ];
    const regime = createRegime('up', 'low');
    const prob = computeEnsemble(signals, regime);
    expect(prob).toBeGreaterThan(50);
    expect(prob).toBeLessThan(100);
  });
});
