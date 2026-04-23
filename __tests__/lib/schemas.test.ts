import {
  BinanceCandleSchema,
  BinanceKlineMessageSchema,
  BinanceTickerMessageSchema,
  SignalRequestSchema,
  SignalResponseSchema,
  AnalyzeRequestSchema,
  CandleSchema,
} from '@/lib/schemas';

describe('BinanceCandleSchema', () => {
  it('validates correct Binance candle data', () => {
    const data = {
      openTime: 1234567890,
      open: '50000',
      high: '50100',
      low: '49900',
      close: '50050',
      volume: '1000',
      closeTime: 1234567950,
      quoteVolume: '50000000',
      trades: 100,
      takerBuyVolume: '500',
      takerBuyQuoteVolume: '25000000',
      ignore: '0',
    };
    const result = BinanceCandleSchema.parse(data);
    expect(result).toEqual(data);
  });

  it('rejects missing required fields', () => {
    const data = { openTime: 1234567890 };
    expect(() => BinanceCandleSchema.parse(data)).toThrow();
  });

  it('rejects invalid data types', () => {
    const data = {
      openTime: 'not a number',
      open: '50000',
      high: '50100',
      low: '49900',
      close: '50050',
      volume: '1000',
      closeTime: 1234567950,
      quoteVolume: '50000000',
      trades: 100,
      takerBuyVolume: '500',
      takerBuyQuoteVolume: '25000000',
      ignore: '0',
    };
    expect(() => BinanceCandleSchema.parse(data)).toThrow();
  });
});

describe('BinanceKlineMessageSchema', () => {
  it('validates correct kline message', () => {
    const data = {
      stream: 'btcusdt@kline_1m',
      data: {
        t: 1234567890,
        s: 'BTCUSDT',
        o: '50000',
        h: '50100',
        l: '49900',
        c: '50050',
        v: '1000',
        x: true,
      },
    };
    const result = BinanceKlineMessageSchema.parse(data);
    expect(result).toEqual(data);
  });

  it('allows optional x field', () => {
    const data = {
      stream: 'btcusdt@kline_1m',
      data: {
        t: 1234567890,
        s: 'BTCUSDT',
        o: '50000',
        h: '50100',
        l: '49900',
        c: '50050',
        v: '1000',
      },
    };
    const result = BinanceKlineMessageSchema.parse(data);
    expect(result.data.x).toBeUndefined();
  });
});

describe('BinanceTickerMessageSchema', () => {
  it('validates correct ticker message', () => {
    const data = {
      stream: 'btcusdt@ticker',
      data: {
        s: 'BTCUSDT',
        c: '50000',
      },
    };
    const result = BinanceTickerMessageSchema.parse(data);
    expect(result).toEqual(data);
  });
});

describe('SignalRequestSchema', () => {
  it('validates with all fields', () => {
    const data = {
      targetPrice: 51000,
      timeWindow: '5M',
    };
    const result = SignalRequestSchema.parse(data);
    expect(result.timeWindow).toBe('5M');
  });

  it('uses default timeWindow when not provided', () => {
    const data = { targetPrice: 51000 };
    const result = SignalRequestSchema.parse(data);
    expect(result.timeWindow).toBe('15M');
  });

  it('validates empty object', () => {
    const data = {};
    const result = SignalRequestSchema.parse(data);
    expect(result.timeWindow).toBe('15M');
  });

  it('rejects invalid timeWindow', () => {
    const data = { timeWindow: 'invalid' };
    expect(() => SignalRequestSchema.parse(data)).toThrow();
  });
});

describe('SignalResponseSchema', () => {
  it('validates complete response', () => {
    const data = {
      probability: 0.75,
      decision: 'UP',
      confidence: 'HIGH',
      execution: { test: 'value' },
      signals: {
        trend: 0.8,
        momentum: 0.7,
        volume: 0.6,
        volatility: 0.5,
      },
      targetAnalysis: {
        targetPrice: 51000,
        currentPrice: 50000,
        distance: '1000',
        distancePercent: '2%',
        direction: 'ABOVE',
        probability: 0.8,
        timeWindow: '15M',
        volatility: 0.05,
      },
    };
    const result = SignalResponseSchema.parse(data);
    expect(result.decision).toBe('UP');
  });

  it('allows null targetAnalysis', () => {
    const data = {
      probability: 0.75,
      decision: 'UP',
      confidence: 'HIGH',
      execution: {},
      signals: {
        trend: 0.8,
        momentum: 0.7,
        volume: 0.6,
        volatility: 0.5,
      },
      targetAnalysis: null,
    };
    const result = SignalResponseSchema.parse(data);
    expect(result.targetAnalysis).toBeNull();
  });

  it('rejects invalid decision', () => {
    const data = {
      probability: 0.75,
      decision: 'INVALID',
      confidence: 'HIGH',
      execution: {},
      signals: {
        trend: 0.8,
        momentum: 0.7,
        volume: 0.6,
        volatility: 0.5,
      },
      targetAnalysis: null,
    };
    expect(() => SignalResponseSchema.parse(data)).toThrow();
  });
});

describe('AnalyzeRequestSchema', () => {
  it('validates with context only', () => {
    const data = { context: 'BTC analysis' };
    const result = AnalyzeRequestSchema.parse(data);
    expect(result.context).toBe('BTC analysis');
  });

  it('validates with optional fields', () => {
    const data = {
      context: 'BTC analysis',
      signals: { rsi: 70 },
      regime: {
        trend: 'up',
        volatility: 'high',
      },
    };
    const result = AnalyzeRequestSchema.parse(data);
    expect(result.regime).toBeDefined();
  });

  it('rejects missing context', () => {
    const data = {};
    expect(() => AnalyzeRequestSchema.parse(data)).toThrow();
  });
});

describe('CandleSchema', () => {
  it('validates correct candle data', () => {
    const data = {
      time: 1234567890,
      open: 50000,
      high: 50100,
      low: 49900,
      close: 50050,
      volume: 1000,
    };
    const result = CandleSchema.parse(data);
    expect(result).toEqual(data);
  });

  it('rejects missing required fields', () => {
    const data = { time: 1234567890 };
    expect(() => CandleSchema.parse(data)).toThrow();
  });

  it('rejects non-numeric values', () => {
    const data = {
      time: 'not a number',
      open: 50000,
      high: 50100,
      low: 49900,
      close: 50050,
      volume: 1000,
    };
    expect(() => CandleSchema.parse(data)).toThrow();
  });
});
