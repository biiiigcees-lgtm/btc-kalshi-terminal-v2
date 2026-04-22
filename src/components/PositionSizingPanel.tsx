'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useTradeStore } from '@/stores/tradeStore';
import { useKalshiStore } from '@/stores/kalshiStore';
import { useSignalStore } from '@/stores/signalStore';

function AnimatedValue({ value, prefix = '', suffix = '', color = '#e8e8f0', decimals = 2 }: {
  value: number; prefix?: string; suffix?: string; color?: string; decimals?: number;
}) {
  return (
    <motion.span
      key={value.toFixed(decimals)}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ color }}
      className="font-mono font-bold"
    >
      {prefix}{typeof value === 'number' && isFinite(value) ? value.toFixed(decimals) : '—'}{suffix}
    </motion.span>
  );
}

export default function PositionSizingPanel() {
  const { accountBalance, intendedBet, setAccountBalance, setIntendedBet } = useTradeStore();
  const { recommendedBet, expectedValue, edge, volatilityAdjusted, kellyFraction } = useKalshiStore();
  const { ensembleProbability, regime } = useSignalStore();
  const [balanceErr, setBalanceErr] = useState(false);
  const [betErr, setBetErr] = useState(false);

  const maxLoss = accountBalance * 0.02;
  const evColor = expectedValue > 0 ? '#00ff88' : '#ff4466';
  const edgeColor = edge > 2 ? '#00ff88' : edge > 0 ? '#ffaa00' : '#ff4466';
  const probColor = ensembleProbability > 55 ? '#00ff88' : ensembleProbability < 45 ? '#ff4466' : '#ffaa00';

  const signal = edge > 2 && expectedValue > 0
    ? (ensembleProbability > 55 ? 'ABOVE' : ensembleProbability < 45 ? 'BELOW' : 'NO TRADE')
    : 'NO TRADE';
  const signalColor = signal === 'ABOVE' ? '#00ff88' : signal === 'BELOW' ? '#ff4466' : '#444460';

  let volLabel = 'NORMAL VOL';
  let volColor = '#444460';
  if (volatilityAdjusted) {
    const ratio = kellyFraction;
    volLabel = ratio < 0.05 ? 'EXTREME VOL' : 'HIGH VOL';
    volColor = ratio < 0.05 ? '#ff4466' : '#ffaa00';
  }

  const betPct = accountBalance > 0 ? (intendedBet / accountBalance) * 100 : 0;
  const activePreset = [1, 2, 5, 10].find(p => Math.abs(betPct - p) < 0.5);

  return (
    <div className="flex flex-col h-full bg-[#07070f] font-mono">
      {/* Signal directive row */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a2a] flex-shrink-0">
        <span className="text-[9px] font-mono text-[#444460] uppercase tracking-[0.2em]">DECISION</span>
        <AnimatePresence mode="wait">
          <motion.div key={signal}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2 px-2 py-0.5 rounded border"
            style={{ borderColor: `${signalColor}44`, background: `${signalColor}0d` }}
          >
            <motion.div
              animate={signal !== 'NO TRADE' ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: signalColor }}
            />
            <span className="text-[10px] font-bold" style={{ color: signalColor }}>{signal}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Main metrics grid */}
      <div className="flex-1 overflow-hidden p-2">
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {/* Ensemble probability */}
          <div className="col-span-2 bg-[#0a0a14] border border-[#1a1a2a] rounded p-2">
            <div className="text-[8px] text-[#444460] mb-1">ENSEMBLE PROB</div>
            <AnimatedValue value={ensembleProbability} suffix="%" color={probColor} decimals={1} />
            <div className="mt-1 h-1 bg-[#1a1a2a] rounded overflow-hidden">
              <motion.div
                animate={{ width: `${ensembleProbability}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded"
                style={{ background: probColor }}
              />
            </div>
          </div>

          {/* Edge */}
          <div className="bg-[#0a0a14] border border-[#1a1a2a] rounded p-2">
            <div className="text-[8px] text-[#444460] mb-1">EDGE</div>
            <AnimatedValue value={edge} suffix="%" color={edgeColor} decimals={1} prefix={edge > 0 ? '+' : ''} />
          </div>

          {/* EV */}
          <div className="bg-[#0a0a14] border border-[#1a1a2a] rounded p-2">
            <div className="text-[8px] text-[#444460] mb-1">EV</div>
            <AnimatedValue value={expectedValue * 100} suffix="%" color={evColor} decimals={2} prefix={expectedValue > 0 ? '+' : ''} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {/* Kelly */}
          <div className="col-span-2 bg-[#0a0a14] border border-[#1a1a2a] rounded p-2">
            <div className="text-[8px] text-[#444460] mb-1">KELLY SIZE</div>
            <AnimatedValue value={recommendedBet} prefix="$" color="#4488ff" decimals={0} />
            <div className="text-[8px] text-[#333350]">
              {accountBalance > 0 ? `${((recommendedBet / accountBalance) * 100).toFixed(1)}% of account` : ''}
            </div>
          </div>

          {/* Max loss */}
          <div className="bg-[#0a0a14] border border-[#1a1a2a] rounded p-2">
            <div className="text-[8px] text-[#444460] mb-1">MAX LOSS</div>
            <span className="text-sm font-bold text-[#ff4466]">${maxLoss.toFixed(0)}</span>
          </div>

          {/* Volatility */}
          <div className="bg-[#0a0a14] border border-[#1a1a2a] rounded p-2">
            <div className="text-[8px] text-[#444460] mb-1">VOL</div>
            <span className="text-[10px] font-bold" style={{ color: volColor }}>{volLabel.split(' ')[0]}</span>
          </div>
        </div>

        {/* Regime */}
        <div className="flex gap-1.5 mb-2">
          <div className="bg-[#0a0a14] border border-[#1a1a2a] rounded px-2 py-1 flex-1 text-center">
            <span className="text-[9px] font-mono text-[#444460]">{regime.trend.toUpperCase()}</span>
          </div>
          <div className="bg-[#0a0a14] border border-[#1a1a2a] rounded px-2 py-1 flex-1 text-center">
            <span className="text-[9px] font-mono" style={{ color: volColor }}>{regime.volatility.toUpperCase()} VOL</span>
          </div>
        </div>

        {/* Account + Bet inputs */}
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <div>
            <div className="text-[8px] text-[#444460] mb-1">ACCOUNT</div>
            <div className={`flex items-center border rounded bg-[#0a0a14] px-2 ${balanceErr ? 'border-[#ff4466]' : 'border-[#1a1a2a]'}`}>
              <span className="text-[#444460] text-xs mr-1">$</span>
              <input type="number"
                className="bg-transparent text-sm font-mono text-[#e8e8f0] w-full py-1 focus:outline-none"
                value={accountBalance}
                aria-label="Account Balance"
                placeholder="Account Balance"
                onChange={e => {
                  const n = parseFloat(e.target.value);
                  if (isNaN(n) || n < 0) { setBalanceErr(true); return; }
                  setBalanceErr(false);
                  setAccountBalance(n);
                }}
              />
            </div>
          </div>
          <div>
            <div className="text-[8px] text-[#444460] mb-1">BET SIZE</div>
            <div className={`flex items-center border rounded bg-[#0a0a14] px-2 ${betErr ? 'border-[#ff4466]' : 'border-[#1a1a2a]'}`}>
              <span className="text-[#444460] text-xs mr-1">$</span>
              <input type="number"
                className="bg-transparent text-sm font-mono text-[#e8e8f0] w-full py-1 focus:outline-none"
                value={intendedBet}
                aria-label="Bet Size"
                placeholder="Bet Size"
                onChange={e => {
                  const n = parseFloat(e.target.value);
                  if (isNaN(n) || n < 0) { setBetErr(true); return; }
                  setBetErr(false);
                  setIntendedBet(n);
                }}
              />
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-[#333350]">Presets:</span>
          {[1, 2, 5, 10].map(p => (
            <button key={p}
              onClick={() => { setIntendedBet(Math.round(accountBalance * p / 100 * 100) / 100); setBetErr(false); }}
              className={`px-2 py-0.5 text-[9px] rounded transition-colors ${activePreset === p ? 'bg-[#4488ff] text-white' : 'bg-[#1a1a2a] text-[#444460] hover:text-[#e8e8f0]'}`}
            >
              {p}%
            </button>
          ))}
          <button
            onClick={() => { setIntendedBet(parseFloat(recommendedBet.toFixed(2))); setBetErr(false); }}
            className="px-2 py-0.5 text-[9px] rounded bg-[#1a1a2a] text-[#4488ff] hover:bg-[#4488ff22] transition-colors"
          >
            KELLY
          </button>
        </div>
      </div>
    </div>
  );
}
