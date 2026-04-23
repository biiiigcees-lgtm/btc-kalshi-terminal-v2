'use client';
import { useEffect, useState } from 'react';
import { usePriceStore } from '@/stores/priceStore';
import BTCLivePrice from './BTCLivePrice';

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

  const statusColor =
    connectionStatus === 'connected' ? '#00ff88' :
    connectionStatus === 'reconnecting' ? '#ffaa00' : '#ff4466';

  const statusLabel =
    connectionStatus === 'connected' ? '● LIVE' :
    connectionStatus === 'reconnecting' ? `◌ RETRY #${connectionRetries}` : '✕ ERROR';

  const changePositive = change24h.usd >= 0;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a2a] bg-[#070710] relative z-10 gap-4">
      {/* Title */}
      <div className="font-display font-bold tracking-[0.15em] text-sm uppercase text-[#4488ff] whitespace-nowrap flex-shrink-0"
        style={{ fontFamily: 'Syne, sans-serif' }}>
        KALSHI · BTC
      </div>

      {/* Live Price with smooth updates */}
      <div className="flex items-center gap-4 flex-1 justify-center min-w-0">
        <BTCLivePrice />
        <span className={`text-xs font-mono whitespace-nowrap ${changePositive ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
          {changePositive ? '+' : ''}{fmtPrice(Math.abs(change24h.usd))} ({changePositive ? '+' : ''}{change24h.pct.toFixed(2)}%)
        </span>
      </div>

      {/* Right badges */}
      <div className="flex items-center gap-2 text-xs font-mono flex-shrink-0">
        {divergencePct > 0.2 && (
          <span className="hidden sm:block px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#2a1a00] text-[#ffaa00] border border-[#ffaa00]/30">
            ⚠ {divergencePct.toFixed(2)}%
          </span>
        )}
        <span
          className="px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer relative border"
          style={{ color: statusColor, borderColor: `${statusColor}44`, backgroundColor: `${statusColor}0d` }}
          onClick={() => lastError && setShowError(!showError)}
        >
          <span className={connectionStatus === 'connected' ? 'pulse-green' : connectionStatus === 'error' ? 'pulse-red' : ''}>
            {statusLabel}
          </span>
          {showError && lastError && (
            <div className="absolute top-full right-0 mt-1 px-3 py-2 bg-[#1e1e2e] border border-[#ff4466] rounded text-[9px] text-[#ff4466] whitespace-nowrap z-50 max-w-[260px]">
              {lastError}
            </div>
          )}
        </span>
        <span className="hidden md:block text-[#333350] text-[9px]">{utcTime}</span>
      </div>
    </div>
  );
}
