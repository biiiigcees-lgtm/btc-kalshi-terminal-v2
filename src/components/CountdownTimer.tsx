// /src/components/CountdownTimer.tsx
'use client';
import { motion } from 'framer-motion';
import { useKalshiWindow } from '../hooks/useKalshiWindow';
import { useKalshiStore } from '../stores/kalshiStore';
import { useTradeStore } from '../stores/tradeStore';
import { useAutoAnalysis } from '../hooks/useAutoAnalysis';

const RADIUS = 80;
const STROKE = 8;
const CIRCUMFERENCE = Math.PI * RADIUS;
const TOTAL = 900;

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

export default function CountdownTimer() {
  const { secondsRemaining } = useKalshiWindow();
  const { targetPrice, edge, expectedValue, setTargetPrice } = useKalshiStore();
  const { intendedBet, setIntendedBet, accountBalance } = useTradeStore();
  
  // Auto-trigger AI analysis when both target price and bet amount are entered
  const { isReady } = useAutoAnalysis((context) => {
    // Dispatch custom event for AIAdvisor to pick up
    if (typeof globalThis !== 'undefined' && globalThis.window) {
      globalThis.window.dispatchEvent(new CustomEvent('auto-analyze', { detail: context }));
    }
  });

  const pct = secondsRemaining / TOTAL;
  const dashoffset = CIRCUMFERENCE * (1 - pct);

  function getArcColor(remaining: number): string {
    if (remaining <= 60) return '#ff4466';
    if (remaining <= 180) return '#ffaa00';
    return '#4488ff';
  }
  
  const arcColor = getArcColor(secondsRemaining);

  const shouldPulse = secondsRemaining <= 60;

  const edgePositive = edge >= 0;
  const evPositive = expectedValue >= 0;

  return (
    <div className="flex flex-col items-center gap-3 p-3">
      {/* SVG Arc Timer */}
      <div className="relative">
        <svg width={200} height={110} viewBox="0 0 200 110">
          {/* Background arc */}
          <path
            d={`M ${STROKE} 100 A ${RADIUS} ${RADIUS} 0 0 1 ${200 - STROKE} 100`}
            fill="none"
            stroke="#1e1e2e"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <motion.path
            d={`M ${STROKE} 100 A ${RADIUS} ${RADIUS} 0 0 1 ${200 - STROKE} 100`}
            fill="none"
            stroke={arcColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashoffset}
            animate={shouldPulse ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            transition={shouldPulse ? { duration: 0.8, repeat: Infinity } : {}}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className={`font-mono text-3xl font-bold leading-none ${secondsRemaining < 60 ? 'text-[#ff4444]' : secondsRemaining < 180 ? 'text-[#ffaa00]' : 'text-[#00ff88]'}`}>
            {fmt(secondsRemaining)}
          </span>
          <span className="text-[10px] font-mono text-[#666680] tracking-widest mt-1">WINDOW</span>
        </div>
      </div>

      {/* Kalshi Inputs */}
      <div className="w-full space-y-2">
        <div>
          <label htmlFor="target-price" className="text-[10px] font-display text-[#666680] tracking-widest uppercase block mb-1">Target Price</label>
          <div className="flex items-center border border-[#1e1e2e] rounded bg-[#0d0d14] px-2">
            <span className="text-[#666680] text-sm mr-1">$</span>
            <input
              id="target-price"
              type="number"
              className="bg-transparent text-sm font-mono text-[#e8e8f0] w-full py-1.5 focus:outline-none"
              placeholder="84,250.00"
              value={targetPrice ?? ''}
              onChange={e => setTargetPrice(e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="bet-amount" className="text-[10px] font-display text-[#666680] tracking-widest uppercase block mb-1">
            Bet Amount (Max: ${(accountBalance * 0.50).toFixed(0)})
          </label>
          <div className="flex items-center border border-[#1e1e2e] rounded bg-[#0d0d14] px-2">
            <span className="text-[#666680] text-sm mr-1">$</span>
            <input
              id="bet-amount"
              type="number"
              className="bg-transparent text-sm font-mono text-[#e8e8f0] w-full py-1.5 focus:outline-none"
              placeholder="25.00"
              value={intendedBet || ''}
              min={1}
              max={accountBalance * 0.50}
              step={1}
              onChange={e => {
                const value = e.target.value ? parseFloat(e.target.value) : 0;
                setIntendedBet(value);
              }}
            />
          </div>
        </div>
        
        {isReady && (
          <div className="text-[10px] text-[#00ff88] text-center py-1">
            ✓ AI Analysis Auto-Triggered
          </div>
        )}
      </div>

      {/* Edge / EV display */}
      <div className="w-full grid grid-cols-2 gap-2 pt-1">
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded p-2 text-center">
          <div className="text-[9px] font-display text-[#666680] uppercase tracking-widest">Edge</div>
          <div className={`text-sm font-mono font-bold mt-0.5 ${edgePositive ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
            {edgePositive ? '+' : ''}{edge.toFixed(1)}%
          </div>
        </div>
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded p-2 text-center">
          <div className="text-[9px] font-display text-[#666680] uppercase tracking-widest">EV</div>
          <div className={`text-sm font-mono font-bold mt-0.5 ${evPositive ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
            {evPositive ? '+' : ''}{(expectedValue * 100).toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}
