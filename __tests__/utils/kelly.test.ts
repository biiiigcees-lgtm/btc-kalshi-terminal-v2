import { computeKelly, computeEV } from '@/utils/kelly';

describe('computeKelly', () => {
  it('returns 0 kellyFraction when probability is 50%', () => {
    const result = computeKelly({
      ensembleProbability: 50,
      accountBalance: 10000,
      atrRatio: 1,
    });
    expect(result.kellyFraction).toBe(0);
    expect(result.fractionalKelly).toBe(0);
    expect(result.recommendedBet).toBe(0);
  });

  it('returns positive kellyFraction when probability > 50%', () => {
    const result = computeKelly({
      ensembleProbability: 60,
      accountBalance: 10000,
      atrRatio: 1,
    });
    expect(result.kellyFraction).toBeGreaterThan(0);
    expect(result.fractionalKelly).toBeGreaterThan(0);
  });

  it('returns 0 kellyFraction when probability < 50%', () => {
    const result = computeKelly({
      ensembleProbability: 40,
      accountBalance: 10000,
      atrRatio: 1,
    });
    expect(result.kellyFraction).toBe(0);
    expect(result.fractionalKelly).toBe(0);
  });

  it('applies 40% fractional Kelly by default', () => {
    const result = computeKelly({
      ensembleProbability: 75,
      accountBalance: 10000,
      atrRatio: 1,
    });
    expect(result.fractionalKelly).toBeCloseTo(result.kellyFraction * 0.4, 5);
  });

  it('reduces position by 50% when ATR ratio > 1.5', () => {
    const result = computeKelly({
      ensembleProbability: 75,
      accountBalance: 10000,
      atrRatio: 1.6,
    });
    expect(result.volatilityAdjusted).toBe(true);
    expect(result.fractionalKelly).toBeLessThan(result.kellyFraction * 0.4);
  });

  it('reduces position by 25% when ATR ratio > 1.25', () => {
    const result = computeKelly({
      ensembleProbability: 75,
      accountBalance: 10000,
      atrRatio: 1.3,
    });
    expect(result.volatilityAdjusted).toBe(true);
    expect(result.fractionalKelly).toBeCloseTo(result.kellyFraction * 0.4 * 0.75, 5);
  });

  it('does not adjust when ATR ratio is normal', () => {
    const result = computeKelly({
      ensembleProbability: 75,
      accountBalance: 10000,
      atrRatio: 1.0,
    });
    expect(result.volatilityAdjusted).toBe(false);
  });

  it('caps fraction at 3%', () => {
    const result = computeKelly({
      ensembleProbability: 100,
      accountBalance: 10000,
      atrRatio: 1,
    });
    expect(result.cappedFraction).toBeLessThanOrEqual(0.03);
  });

  it('calculates recommended bet correctly', () => {
    const balance = 10000;
    const result = computeKelly({
      ensembleProbability: 60,
      accountBalance: balance,
      atrRatio: 1,
    });
    expect(result.recommendedBet).toBeCloseTo(balance * result.cappedFraction, 2);
  });

  it('handles extreme probability of 100%', () => {
    const result = computeKelly({
      ensembleProbability: 100,
      accountBalance: 10000,
      atrRatio: 1,
    });
    expect(result.kellyFraction).toBe(1);
    expect(result.fractionalKelly).toBe(0.4);
  });

  it('handles extreme probability of 0%', () => {
    const result = computeKelly({
      ensembleProbability: 0,
      accountBalance: 10000,
      atrRatio: 1,
    });
    expect(result.kellyFraction).toBe(0);
    expect(result.fractionalKelly).toBe(0);
  });
});

describe('computeEV', () => {
  it('returns 0 when probability is 50% with default fee', () => {
    const result = computeEV({ ensembleProbability: 50 });
    expect(result).toBeCloseTo(0, 5);
  });

  it('returns positive EV when probability > 50%', () => {
    const result = computeEV({ ensembleProbability: 60 });
    expect(result).toBeGreaterThan(0);
  });

  it('returns negative EV when probability < 50%', () => {
    const result = computeEV({ ensembleProbability: 40 });
    expect(result).toBeLessThan(0);
  });

  it('subtracts fee from EV', () => {
    const result1 = computeEV({ ensembleProbability: 60, kalshiFee: 0.02 });
    const result2 = computeEV({ ensembleProbability: 60, kalshiFee: 0.05 });
    expect(result1).toBeGreaterThan(result2);
  });

  it('uses default fee of 2% when not specified', () => {
    const result = computeEV({ ensembleProbability: 60 });
    const expected = 2 * (0.6 - 0.5) - 0.02;
    expect(result).toBeCloseTo(expected, 5);
  });

  it('handles extreme probability of 100%', () => {
    const result = computeEV({ ensembleProbability: 100, kalshiFee: 0.02 });
    expect(result).toBeCloseTo(0.98, 5);
  });

  it('handles extreme probability of 0%', () => {
    const result = computeEV({ ensembleProbability: 0, kalshiFee: 0.02 });
    expect(result).toBeCloseTo(-1.02, 5);
  });

  it('calculates EV correctly with custom fee', () => {
    const result = computeEV({ ensembleProbability: 55, kalshiFee: 0.03 });
    const expected = 2 * (0.55 - 0.5) - 0.03;
    expect(result).toBeCloseTo(expected, 5);
  });
});
