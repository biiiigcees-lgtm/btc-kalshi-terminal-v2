// /src/components/BTCChart.tsx — Optimized for smooth 60fps rendering with live price display
'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
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
  
  // Optimization: buffered price updates
  const bufferedPriceRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const UPDATE_THROTTLE_MS = 100; // ~10fps for visual updates

  const { candles, currentCandle, spotPrice } = usePriceStore();
  const { targetPrice, setTargetPrice } = useKalshiStore();
  
  // Local target price state for input (does not trigger chart rebuild)
  const [localTargetPrice, setLocalTargetPrice] = useState<number>(targetPrice || 0);

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

  // Optimized: requestAnimationFrame-based chart update
  const flushBufferedUpdate = useCallback(() => {
    if (!candleSeriesRef.current || !currentCandle || bufferedPriceRef.current === null) return;
    
    const liveCandle = {
      ...currentCandle,
      close: bufferedPriceRef.current,
      high: Math.max(currentCandle.high, bufferedPriceRef.current),
      low: Math.min(currentCandle.low, bufferedPriceRef.current),
    };
    
    // @ts-expect-error - lightweight-charts type compatibility
    candleSeriesRef.current.update(liveCandle);
    
    bufferedPriceRef.current = null;
    rafIdRef.current = null;
  }, [currentCandle]);

  // Throttled update scheduler
  const scheduleUpdate = useCallback((price: number) => {
    bufferedPriceRef.current = price;
    
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    
    if (timeSinceLastUpdate >= UPDATE_THROTTLE_MS) {
      lastUpdateTimeRef.current = now;
      rafIdRef.current = requestAnimationFrame(flushBufferedUpdate);
    } else {
      // Wait until throttle period
      const delay = UPDATE_THROTTLE_MS - timeSinceLastUpdate;
      rafIdRef.current = requestAnimationFrame(() => {
        lastUpdateTimeRef.current = Date.now();
        flushBufferedUpdate();
      });
    }
  }, [flushBufferedUpdate]);

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

      // Debounced resize handler for performance
      let resizeTimeout: number;
      const ro = new ResizeObserver(() => {
        clearTimeout(resizeTimeout);
        resizeTimeout = window.setTimeout(() => {
          if (containerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: containerRef.current.clientWidth,
              height: containerRef.current.clientHeight,
            });
          }
        }, 100);
      });
      ro.observe(containerRef.current!);
      
      // Cleanup on unmount
      return () => {
        clearTimeout(resizeTimeout);
        ro.disconnect();
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }
      };
    });
  }, []);

  // Load historical candles + compute overlays (only on initial load or full resync)
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length < 2) return;

    const sorted = [...candles].sort((a, b) => a.time - b.time);
    
    // Preserve visible range before setData to prevent jumps
    const visibleRange = chartRef.current?.timeScale().getVisibleRange();
    
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
    
    // Restore visible range after setData
    if (visibleRange && chartRef.current) {
      chartRef.current.timeScale().setVisibleRange(visibleRange);
    } else if (chartRef.current) {
      // Only fit content on first load
      chartRef.current.timeScale().fitContent();
    }
  }, [candles]);

  // Optimized: throttled price tick updates via requestAnimationFrame
  useEffect(() => {
    if (spotPrice === 0 || !currentCandle) return;
    scheduleUpdate(spotPrice);
  }, [spotPrice, currentCandle, scheduleUpdate]);

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
          title: 'TARGET',
          axisLabelVisible: true,
        });
      }
    });
  }, [targetPrice]);

  // Sync local target price with store when it changes externally
  useEffect(() => {
    if (targetPrice && targetPrice !== localTargetPrice) {
      setLocalTargetPrice(targetPrice);
    }
  }, [targetPrice, localTargetPrice]);

  // Calculate distance to target
  const currentPrice = spotPrice || currentCandle?.close || 0;
  const hasPrice = currentPrice > 0;
  const target = localTargetPrice || 0;
  const absDistance = target > 0 ? target - currentPrice : 0;
  const pctDistance = currentPrice > 0 ? (absDistance / currentPrice) * 100 : 0;
  const direction = absDistance > 0 ? 'above' : absDistance < 0 ? 'below' : 'at';

  // Handle target price input change
  const handleTargetChange = (value: number) => {
    setLocalTargetPrice(value);
    setTargetPrice(value);
  };

  return (
    <div className="w-full h-full bg-[#0d0d14] flex flex-col">
      {/* Header with live price and target input */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a2e] flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Current price display */}
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-[#3a3a50] uppercase tracking-wider">BTC/USD</span>
            {hasPrice ? (
              <span className="text-lg font-mono font-bold text-[#00ff88]">
                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : (
              <span className="text-sm font-mono text-[#3a3a50]">No data</span>
            )}
          </div>

          {/* Target price input */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <label className="text-[8px] font-mono text-[#3a3a50] uppercase tracking-wider">Target</label>
              <input
                type="number"
                value={localTargetPrice || ''}
                onChange={(e) => handleTargetChange(parseFloat(e.target.value) || 0)}
                placeholder="Set target"
                className="w-24 bg-[#0a0a12] border border-[#1a1a2e] rounded px-2 py-1 text-[11px] font-mono text-[#ffaa00] focus:outline-none focus:border-[#ffaa00] transition-colors"
              />
            </div>

            {/* Distance display */}
            {target > 0 && hasPrice && (
              <div className="flex flex-col ml-2">
                <span className="text-[8px] font-mono text-[#3a3a50] uppercase tracking-wider">Distance</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-mono ${direction === 'above' ? 'text-[#00ff88]' : direction === 'below' ? 'text-[#ff4466]' : 'text-[#555570]'}`}>
                    {direction === 'above' ? '▲' : direction === 'below' ? '▼' : '—'}
                  </span>
                  <span className="text-[11px] font-mono text-[#8888aa]">
                    ${Math.abs(absDistance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] font-mono text-[#555570]">
                    ({Math.abs(pctDistance).toFixed(2)}%)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div className="flex-1 min-h-0" ref={containerRef} />
    </div>
  );
}
