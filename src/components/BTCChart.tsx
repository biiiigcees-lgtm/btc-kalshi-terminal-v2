// /src/components/BTCChart.tsx — Simple line chart like Kalshi
'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { usePriceStore } from '../stores/priceStore';
import { useKalshiStore } from '../stores/kalshiStore';

export default function BTCChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);
  const lineSeriesRef = useRef<ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']> | null>(null);
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

  // Optimized: requestAnimationFrame-based chart update
  const flushBufferedUpdate = useCallback(() => {
    if (!lineSeriesRef.current || !currentCandle || bufferedPriceRef.current === null) return;
    
    // Update line with latest price
    // @ts-ignore - lightweight-charts type compatibility
    lineSeriesRef.current.update({
      time: currentCandle.time as any,
      value: bufferedPriceRef.current,
    });
    
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

      const lineSeries = chart.addLineSeries({
        color: '#00ff88',
        lineWidth: 2,
        title: 'BTC',
      });

      chartRef.current = chart;
      lineSeriesRef.current = lineSeries;

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

  // Load historical data (only on initial load or full resync)
  useEffect(() => {
    if (!lineSeriesRef.current || candles.length < 2) return;

    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const lineData = sorted.map(c => ({ time: c.time, value: c.close }));
    
    // Preserve visible range before setData to prevent jumps
    const visibleRange = chartRef.current?.timeScale().getVisibleRange();
    
    // @ts-expect-error - lightweight-charts type compatibility
    lineSeriesRef.current.setData(lineData);
    
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

  // Target price line
  useEffect(() => {
    if (!lineSeriesRef.current) return;
    import('lightweight-charts').then(({ LineStyle }) => {
      if (priceLineRef.current) {
        try { lineSeriesRef.current?.removePriceLine(priceLineRef.current); } catch {}
      }
      if (targetPrice) {
        priceLineRef.current = lineSeriesRef.current?.createPriceLine({
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
