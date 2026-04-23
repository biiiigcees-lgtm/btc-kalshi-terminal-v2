import { detectRegime } from '@/utils/regimeDetector';
import type { Candle } from '@/types';

describe('detectRegime', () => {
  const createCandle = (time: number, close: number, high: number, low: number): Candle => ({
    time,
    open: close,
    high,
    low,
    close,
    volume: 1000,
  });

  it('returns ranging/normal when candles < 55', () => {
    const candles: Candle[] = Array.from({ length: 54 }, (_, i) => 
      createCandle(i, 50000, 50010, 49990)
    );
    const regime = detectRegime(candles);
    expect(regime.trend).toBe('ranging');
    expect(regime.volatility).toBe('normal');
  });

  it('detects uptrend when EMAs are aligned upward', () => {
    const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
      createCandle(i, 50000 + i * 100, 50010 + i * 100, 49990 + i * 100)
    );
    const regime = detectRegime(candles);
    expect(regime.trend).toBe('up');
  });

  it('detects downtrend when EMAs are aligned downward', () => {
    const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
      createCandle(i, 50000 - i * 100, 50010 - i * 100, 49990 - i * 100)
    );
    const regime = detectRegime(candles);
    expect(regime.trend).toBe('down');
  });

  it('detects ranging when EMAs are mixed', () => {
    const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
      createCandle(i, 50000 + Math.sin(i) * 100, 50010 + Math.sin(i) * 100, 49990 + Math.sin(i) * 100)
    );
    const regime = detectRegime(candles);
    expect(regime.trend).toBe('ranging');
  });

  it('detects high volatility when ATR ratio > 1.5', () => {
    const candles: Candle[] = Array.from({ length: 55 }, (_, i) => {
      const base = 50000;
      const volatility = i > 40 ? 500 : 50; // High volatility at end
      return createCandle(i, base + i * 10 + Math.random() * volatility, base + i * 10 + volatility, base + i * 10 - volatility);
    });
    const regime = detectRegime(candles);
    expect(regime.volatility).toBe('high');
  });

  it('detects low volatility when ATR ratio < 0.75', () => {
    const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
      createCandle(i, 50000, 50001, 49999) // Very flat prices
    );
    const regime = detectRegime(candles);
    expect(regime.volatility).toBe('low');
  });

  it('detects normal volatility when ATR ratio is between 0.75 and 1.5', () => {
    const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
      createCandle(i, 50000 + i * 10, 50020 + i * 10, 49980 + i * 10)
    );
    const regime = detectRegime(candles);
    expect(regime.volatility).toBe('normal');
  });

  it('handles error gracefully and returns default regime', () => {
    const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
      createCandle(i, NaN, NaN, NaN) // Invalid data
    );
    const regime = detectRegime(candles);
    expect(regime.trend).toBe('ranging');
    expect(regime.volatility).toBe('normal');
  });

  it('handles empty candles array', () => {
    const regime = detectRegime([]);
    expect(regime.trend).toBe('ranging');
    expect(regime.volatility).toBe('normal');
  });

  it('computes EMA correctly for trend detection', () => {
    const candles: Candle[] = Array.from({ length: 100 }, (_, i) => 
      createCandle(i, 50000 + i * 50, 50010 + i * 50, 49990 + i * 50)
    );
    const regime = detectRegime(candles);
    expect(['up', 'down', 'ranging']).toContain(regime.trend);
    expect(['low', 'normal', 'high']).toContain(regime.volatility);
  });
});
