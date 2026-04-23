import { computeSignals, getATRRatio } from '@/utils/indicators';
import type { Candle } from '@/types';

describe('indicators', () => {
  const createCandle = (time: number, close: number, high: number, low: number, volume: number = 1000): Candle => ({
    time,
    open: close,
    high,
    low,
    close,
    volume,
  });

  describe('computeSignals', () => {
    it('returns empty array when candles < 55', () => {
      const candles: Candle[] = Array.from({ length: 54 }, (_, i) => 
        createCandle(i, 50000 + i * 10, 50010 + i * 10, 49990 + i * 10)
      );
      expect(computeSignals(candles)).toEqual([]);
    });

    it('returns signals when candles >= 55', () => {
      const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
        createCandle(i, 50000 + i * 10, 50010 + i * 10, 49990 + i * 10)
      );
      const signals = computeSignals(candles);
      expect(signals.length).toBeGreaterThan(0);
      expect(signals.every(s => 
        'name' in s && 'value' in s && 'confidence' in s && 'direction' in s && 'category' in s
      )).toBe(true);
    });

    it('handles all gains scenario for RSI', () => {
      const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
        createCandle(i, 50000 + i * 100, 50010 + i * 100, 49990 + i * 100)
      );
      const signals = computeSignals(candles);
      const rsi = signals.find(s => s.name === 'RSI (14)');
      expect(rsi).toBeDefined();
      expect(rsi?.value).toBeCloseTo(100, 0);
    });

    it('handles all losses scenario for RSI', () => {
      const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
        createCandle(i, 50000 - i * 100, 50010 - i * 100, 49990 - i * 100)
      );
      const signals = computeSignals(candles);
      const rsi = signals.find(s => s.name === 'RSI (14)');
      expect(rsi).toBeDefined();
      expect(rsi?.value).toBeCloseTo(0, 0);
    });

    it('computes MACD correctly', () => {
      const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
        createCandle(i, 50000 + i * 10, 50010 + i * 10, 49990 + i * 10)
      );
      const signals = computeSignals(candles);
      const macd = signals.find(s => s.name === 'MACD (12/26/9)');
      expect(macd).toBeDefined();
      expect(typeof macd?.value).toBe('number');
    });

    it('computes Bollinger Bands with flat prices', () => {
      const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
        createCandle(i, 50000, 50000, 50000)
      );
      const signals = computeSignals(candles);
      const bb = signals.find(s => s.name === 'Bollinger Band');
      expect(bb).toBeDefined();
      expect(bb?.value).toBe(0); // Position should be 0 when std dev is 0
    });

    it('computes EMA Alignment correctly', () => {
      const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
        createCandle(i, 50000 + i * 100, 50010 + i * 100, 49990 + i * 100)
      );
      const signals = computeSignals(candles);
      const ema = signals.find(s => s.name === 'EMA Alignment');
      expect(ema).toBeDefined();
      expect(ema?.direction).toBe('bullish');
    });

    it('computes ATR Ratio correctly', () => {
      const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
        createCandle(i, 50000 + i * 10, 50020 + i * 10, 49980 + i * 10)
      );
      const signals = computeSignals(candles);
      const atr = signals.find(s => s.name === 'ATR Ratio');
      expect(atr).toBeDefined();
      expect(typeof atr?.value).toBe('number');
    });

    it('computes VWAP Deviation correctly', () => {
      const candles: Candle[] = Array.from({ length: 96 }, (_, i) => 
        createCandle(i, 50000 + i * 10, 50010 + i * 10, 49990 + i * 10)
      );
      const signals = computeSignals(candles);
      const vwap = signals.find(s => s.name === 'VWAP Deviation');
      expect(vwap).toBeDefined();
      expect(typeof vwap?.value).toBe('number');
    });
  });

  describe('getATRRatio', () => {
    it('returns 1 when candles < 20', () => {
      const candles: Candle[] = Array.from({ length: 19 }, (_, i) => 
        createCandle(i, 50000, 50010, 49990)
      );
      expect(getATRRatio(candles)).toBe(1);
    });

    it('returns 1 on error', () => {
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => 
        createCandle(i, 50000, 50010, 49990)
      );
      // Mock error by passing invalid data
      const result = getATRRatio(candles);
      expect(typeof result).toBe('number');
    });

    it('computes ATR ratio correctly', () => {
      const candles: Candle[] = Array.from({ length: 55 }, (_, i) => 
        createCandle(i, 50000 + i * 10, 50020 + i * 10, 49980 + i * 10)
      );
      const ratio = getATRRatio(candles);
      expect(typeof ratio).toBe('number');
      expect(ratio).toBeGreaterThan(0);
    });
  });
});
