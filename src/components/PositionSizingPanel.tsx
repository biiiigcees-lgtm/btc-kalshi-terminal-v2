// /src/components/PositionSizingPanel.tsx
'use client';
import { useState } from 'react';
import { useTradeStore } from '@/stores/tradeStore';
import { useKalshiStore } from '@/stores/kalshiStore';

interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly color?: string;
  readonly input?: boolean;
  readonly onInput?: (v: string) => void;
  readonly error?: boolean;
  readonly tooltip?: string;
}

function MetricCard({ label, value, color, input, onInput, error, tooltip }: MetricCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div className="panel p-2 flex flex-col gap-1 min-w-0 relative">
      <span className="text-[9px] font-display text-[#666680] uppercase tracking-widest truncate">{label}</span>
      {input ? (
        <input
          type="number"
          aria-label={label}
          placeholder={label}
          className={`bg-transparent text-sm font-mono font-bold w-full focus:outline-none transition-colors ${
            error ? 'text-[#ff4466] border-b border-[#ff4466]' : 'text-[#e8e8f0]'
          }`}
          value={value}
          onChange={e => onInput?.(e.target.value)}
        />
      ) : (
        <button
          type="button"
          className={`text-sm font-mono font-bold truncate cursor-help bg-transparent border-0 p-0 ${color ? '' : 'text-[#e8e8f0]'}`}
          {...(color && { style: { color } })}
          onMouseEnter={() => tooltip && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => tooltip && setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
        >
          {value}
        </button>
      )}
      {showTooltip && tooltip && (
        <div className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-[#1e1e2e] border border-[#333350] rounded text-[9px] font-mono text-[#8888aa] whitespace-nowrap z-10">
          {tooltip}
        </div>
      )}
    </div>
  );
}

interface PresetButtonProps {
  readonly pct: number;
  readonly onClick: () => void;
  readonly active: boolean;
}

function PresetButton({ pct, onClick, active }: PresetButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-[9px] font-mono rounded transition-colors ${
        active 
          ? 'bg-[#4488ff] text-white' 
          : 'bg-[#1e1e2e] text-[#666680] hover:text-[#e8e8f0] hover:bg-[#333350]'
      }`}
    >
      {pct}%
    </button>
  );
}

export default function PositionSizingPanel() {
  const { accountBalance, intendedBet, setAccountBalance, setIntendedBet } = useTradeStore();
  const { recommendedBet, expectedValue, edge, volatilityAdjusted, kellyFraction } = useKalshiStore();
  const [balanceError, setBalanceError] = useState(false);
  const [betError, setBetError] = useState(false);

  const maxLoss = accountBalance * 0.02;
  const evColor = expectedValue > 0 ? '#00ff88' : '#ff4466';
  const edgeColor = edge > 0 ? '#00ff88' : '#ff4466';

  let volStatus = 'NORMAL VOL';
  let volColor = '#666680';
  if (volatilityAdjusted) {
    const ratio = kellyFraction;
    if (ratio < 0.05) {
      volStatus = '🛑 EXTREME VOL — KELLY -50%';
      volColor = '#ff4466';
    } else {
      volStatus = '⚠ HIGH VOL — KELLY -25%';
      volColor = '#ffaa00';
    }
  }

  // Calculate which preset is active (if any)
  const betPct = accountBalance > 0 ? (intendedBet / accountBalance) * 100 : 0;
  const activePreset = [1, 2, 5, 10].find(p => Math.abs(betPct - p) < 0.5);

  function handleBalanceInput(v: string) {
    const num = Number.parseFloat(v);
    if (Number.isNaN(num) || num < 0) {
      setBalanceError(true);
      return;
    }
    setBalanceError(false);
    setAccountBalance(num);
  }

  function handleBetInput(v: string) {
    const num = Number.parseFloat(v);
    if (Number.isNaN(num) || num < 0) {
      setBetError(true);
      return;
    }
    // Warn if bet exceeds 50% of balance
    if (num > accountBalance * 0.5) {
      setBetError(true);
    } else {
      setBetError(false);
    }
    setIntendedBet(num);
  }

  function setPresetBet(pct: number) {
    const bet = accountBalance * (pct / 100);
    setIntendedBet(Math.round(bet * 100) / 100);
    setBetError(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Metrics row */}
      <div className="grid grid-cols-7 gap-1.5 px-2 py-2 items-center flex-1">
        <MetricCard
          label="Account"
          value={accountBalance.toString()}
          input
          onInput={handleBalanceInput}
          error={balanceError}
        />
        <MetricCard
          label="Bet Size"
          value={intendedBet.toString()}
          input
          onInput={handleBetInput}
          error={betError}
        />
        <MetricCard
          label="Kelly Recommended"
          value={`$${recommendedBet.toFixed(2)} (${((recommendedBet / accountBalance) * 100).toFixed(1)}%)`}
          color="#4488ff"
          tooltip={`Kelly: ${(kellyFraction * 100).toFixed(1)}% × 40% conservative = ${((recommendedBet / accountBalance) * 100).toFixed(2)}%`}
        />
        <MetricCard
          label="Max Loss (2%)"
          value={`$${maxLoss.toFixed(2)}`}
          color="#ff4466"
        />
        <MetricCard
          label="EV"
          value={`${expectedValue > 0 ? '+' : ''}${(expectedValue * 100).toFixed(2)}%`}
          color={evColor}
        />
        <MetricCard
          label="Edge"
          value={`${edge > 0 ? '+' : ''}${edge.toFixed(1)}%`}
          color={edgeColor}
        />
        <MetricCard
          label="Volatility"
          value={volStatus}
          color={volColor}
        />
      </div>

      {/* Preset buttons row */}
      <div className="px-2 pb-2 flex items-center gap-2">
        <span className="text-[9px] font-mono text-[#666680]">Presets:</span>
        <PresetButton pct={1} onClick={() => setPresetBet(1)} active={activePreset === 1} />
        <PresetButton pct={2} onClick={() => setPresetBet(2)} active={activePreset === 2} />
        <PresetButton pct={5} onClick={() => setPresetBet(5)} active={activePreset === 5} />
        <PresetButton pct={10} onClick={() => setPresetBet(10)} active={activePreset === 10} />
        <span className="text-[9px] font-mono text-[#333350] ml-2">
          of ${accountBalance.toFixed(0)}
        </span>
        {betError && (
          <span className="text-[9px] font-mono text-[#ff4466] ml-auto">
            ⚠ Bet exceeds 50% of balance
          </span>
        )}
      </div>
    </div>
  );
}
