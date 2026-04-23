// /src/components/BTCChart.tsx
'use client';
import { useEffect, useRef } from 'react';
import { usePriceStore } from '../stores/priceStore';
import { useKalshiStore } from '../stores/kalshiStore';

export default function BTCChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);
  const candleSeriesRef = useRef<ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addCandlestickSeries']> | null>(null);
  const bb20UpperRef = useRef<ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']> | null>(null);
  const bb20LowerRef = useRef<ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']> | null>(null);
  const ema9Ref = useRef<ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']> | null>(null);
  const ema21Ref = useRef<ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']> | null>(null);
  const ema50Ref = useRef<ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']> | null>(null);
  const vwapRef = useRef<ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']> | null>(null);
  const priceLineRef = useRef<any>(null);
  const initializedRef = useRef(false);

  const { candles, currentCandle, spotPrice } = usePriceStore();
  const { targetPrice } = useKalshiStore();

  // Helper function to compute Bollinger Bands
  const computeBollingerBands = (sorted: any[], period: number) => {
    const upperData: { time: number; value: number }[] = [];
    const lowerData: { time: number; value: number }[] = [];
    for (let i = period; i <= sorted.length; i++) {
      const slice = sorted.slice(i - period, i).map((c: any) => c.close);
      const mean = slice.reduce((a: number, b: number) => a + b, 0) / period;
      const sd = Math.sqrt(slice.reduce((s: number, v: number) => s + Math.pow(v - mean, 2), 0) / period);
      upperData.push({ time: sorted[i - 1].time, value: mean + 2 * sd });
      lowerData.push({ time: sorted[i - 1].time, value: mean - 2 * sd });
    }
    return { upperData, lowerData };
  };

  // Helper function to compute EMA
  const computeEMA = (sorted: any[], period: number) => {
    const emaData: { time: number; value: number }[] = [];
    const k = 2 / (period + 1);
    let ema = sorted.slice(0, period).reduce((a: number, c: any) => a + c.close, 0) / period;
    emaData.push({ time: sorted[period - 1].time, value: ema });
    for (let i = period; i < sorted.length; i++) {
      ema = sorted[i].close * k + ema * (1 - k);
      emaData.push({ time: sorted[i].time, value: ema });
    }
    return emaData;
  };

  // Helper function to compute VWAP
  const computeVWAP = (sorted: any[]) => {
    const vwapData: { time: number; value: number }[] = [];
    let cumTP = 0, cumVol = 0;
    for (const c of sorted) {
      const tp = (c.high + c.low + c.close) / 3;
      cumTP += tp * c.volume;
      cumVol += c.volume;
      vwapData.push({ time: c.time, value: cumVol > 0 ? cumTP / cumVol : c.close });
    }
    return vwapData;
  };

  // Init chart
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    import('lightweight-charts').then(({ createChart, CrosshairMode, LineStyle }) => {
      const chart = createChart(containerRef.current!, {
        layout: { background: { color: '#0d0d14' }, textColor: '#8888aa' },
        grid: { vertLines: { color: '#1a1a2e' }, horzLines: { color: '#1a1a2e' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#1e1e2e' },
        timeScale: { borderColor: '#1e1e2e', timeVisible: true, secondsVisible: false },
        handleScroll: true,
        handleScale: true,
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#00ff88',
        downColor: '#ff4466',
        borderUpColor: '#00ff88',
        borderDownColor: '#ff4466',
        wickUpColor: '#00ff88',
        wickDownColor: '#ff4466',
      });

      const bb20Upper = chart.addLineSeries({
        color: 'rgba(68, 136, 255, 0.4)',
        lineWidth: 1,
        lineStyle: 2,
        title: 'BB Upper',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      const bb20Lower = chart.addLineSeries({
        color: 'rgba(68, 136, 255, 0.4)',
        lineWidth: 1,
        lineStyle: 2,
        title: 'BB Lower',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      const ema9 = chart.addLineSeries({
        color: '#00ffcc',
        lineWidth: 1,
        title: 'EMA 9',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      const ema21 = chart.addLineSeries({
        color: '#ff66cc',
        lineWidth: 1,
        title: 'EMA 21',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      const ema50 = chart.addLineSeries({
        color: '#ffaa00',
        lineWidth: 1,
        title: 'EMA 50',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      const vwap = chart.addLineSeries({
        color: '#aa44ff',
        lineWidth: 1,
        title: 'VWAP',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      bb20UpperRef.current = bb20Upper;
      bb20LowerRef.current = bb20Lower;
      ema9Ref.current = ema9;
      ema21Ref.current = ema21;
      ema50Ref.current = ema50;
      vwapRef.current = vwap;

      const ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      ro.observe(containerRef.current!);
    });
  }, []);

  // Load historical candles + compute overlays
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length < 2) return;

    const sorted = [...candles].sort((a, b) => a.time - b.time);
    // @ts-ignore - lightweight-charts type compatibility
    candleSeriesRef.current.setData(sorted);

    // BB(20)
    if (candles.length >= 20) {
      const { upperData, lowerData } = computeBollingerBands(sorted, 20);
      // @ts-ignore - lightweight-charts type compatibility
      bb20UpperRef.current?.setData(upperData);
      // @ts-ignore - lightweight-charts type compatibility
      bb20LowerRef.current?.setData(lowerData);
    }

    // EMA(9) - fast
    if (candles.length >= 9) {
      const emaData = computeEMA(sorted, 9);
      // @ts-ignore - lightweight-charts type compatibility
      ema9Ref.current?.setData(emaData);
    }

    // EMA(21) - medium
    if (candles.length >= 21) {
      const emaData = computeEMA(sorted, 21);
      // @ts-ignore - lightweight-charts type compatibility
      ema21Ref.current?.setData(emaData);
    }

    // EMA(50) - slow
    if (candles.length >= 50) {
      const emaData = computeEMA(sorted, 50);
      // @ts-ignore - lightweight-charts type compatibility
      ema50Ref.current?.setData(emaData);
    }

    // VWAP (rolling session)
    const vwapData = computeVWAP(sorted);
    // @ts-ignore - lightweight-charts type compatibility
    vwapRef.current?.setData(vwapData);
  }, [candles]);

  // Update chart on every price tick — sub-second refresh
  useEffect(() => {
    if (!candleSeriesRef.current || !currentCandle || spotPrice === 0) return;
    // Merge live price into current candle for real-time bar update
    const liveCandle = {
      ...currentCandle,
      close: spotPrice,
      high: Math.max(currentCandle.high, spotPrice),
      low: Math.min(currentCandle.low, spotPrice),
    };
    // @ts-expect-error - lightweight-charts type compatibility
    candleSeriesRef.current.update(liveCandle);
  }, [spotPrice, currentCandle]);

  // Kalshi target price line
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    import('lightweight-charts').then(({ LineStyle }) => {
      if (priceLineRef.current) {
        try { candleSeriesRef.current?.removePriceLine(priceLineRef.current); } catch {}
      }
      if (targetPrice) {
        priceLineRef.current = candleSeriesRef.current?.createPriceLine({
          price: targetPrice,
          color: '#ffaa00',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: 'KALSHI TARGET',
          axisLabelVisible: true,
        });
      }
    });
  }, [targetPrice]);

  return (
    <div className="w-full h-full bg-[#0d0d14]" ref={containerRef} />
  );
}
