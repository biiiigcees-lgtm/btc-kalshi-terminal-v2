// /src/components/TopBar.tsx
'use client';
import { useEffect, useState } from 'react';
import { usePriceStore } from '@/stores/priceStore';

function fmtPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TopBar() {
  const { spotPrice, divergencePct, connectionStatus, connectionRetries, lastError, candles } = usePriceStore();
  const [utcTime, setUtcTime] = useState('');
  const [change24h, setChange24h] = useState({ usd: 0, pct: 0 });
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtcTime(
        `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}:${String(now.getUTCSeconds()).padStart(2,'0')} UTC`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (candles.length >= 96) {
      const open24h = candles[candles.length - 96]?.open ?? spotPrice;
      if (open24h > 0) {
        const usd = spotPrice - open24h;
        const pct = (usd / open24h) * 100;
        setChange24h({ usd, pct });
      }
    }
  }, [spotPrice, candles]);

  const statusColor = connectionStatus === 'connected' ? '#00ff88' : connectionStatus === 'reconnecting' ? '#ffaa00' : '#ff4466';
  const statusLabel = connectionStatus === 'connected' ? '● LIVE' : connectionStatus === 'reconnecting' ? `◌ RETRY #${connectionRetries}` : '✕ ERROR';
  const changePositive = change24h.usd >= 0;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e1e2e] bg-[#0d0d14] relative z-10">
      {/* Title */}
      <div
        className="font-display font-bold tracking-[0.2em] text-sm uppercase text-[#4488ff]"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        KALSHI · BTC · INTELLIGENCE
      </div>

      {/* Center — price */}
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold font-mono text-[#e8e8f0]">
          ${fmtPrice(spotPrice)}
        </span>
        <span
          className={`text-sm font-mono ${changePositive ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}
        >
          {changePositive ? '+' : ''}${fmtPrice(Math.abs(change24h.usd))}
          {' '}({changePositive ? '+' : ''}{change24h.pct.toFixed(2)}%)
        </span>
      </div>

      {/* Right — badges + clock */}
      <div className="flex items-center gap-3 text-xs font-mono">
        {divergencePct > 0.2 && (
          <span className="px-2 py-1 rounded text-xs font-mono bg-[#2a1a00] text-[#ffaa00] border border-[#ffaa00]">
            ⚠ DIVERGENCE {divergencePct.toFixed(3)}%
          </span>
        )}
        <span
          className="px-2 py-1 rounded text-xs font-mono cursor-pointer relative"
          {...(statusColor && {
            style: {
              color: statusColor,
              borderColor: statusColor,
              backgroundColor: `${statusColor}11`,
              borderWidth: '1px',
              borderStyle: 'solid',
            }
          })}
          onClick={() => lastError && setShowError(!showError)}
          title={lastError || 'Connection status'}
        >
          <span className={connectionStatus === 'connected' ? 'pulse-green' : connectionStatus === 'error' ? 'pulse-red' : ''}>
            {statusLabel}
          </span>
          {showError && lastError && (
            <div className="absolute top-full right-0 mt-1 px-3 py-2 bg-[#1e1e2e] border border-[#ff4466] rounded text-[10px] text-[#ff4466] whitespace-nowrap z-50">
              {lastError}
            </div>
          )}
        </span>
        {/* View Toggle */}
        <button
          onClick={() => {
            const isMobile = !document.body.classList.contains('desktop-view');
            document.body.classList.toggle('desktop-view', isMobile);
            document.body.classList.toggle('mobile-view', !isMobile);
            window.dispatchEvent(new Event('resize'));
          }}
          className="px-2 py-1 rounded text-xs font-mono border border-[#333350] text-[#666680] hover:text-[#e8e8f0] hover:border-[#666680] transition-colors"
          title="Toggle Mobile/Desktop View"
        >
          📱/🖥️
        </button>
        <span className="text-[#666680]">{utcTime}</span>
      </div>
    </div>
  );
}
