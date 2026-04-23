// /src/components/terminal/KalshiMarketPanel.tsx — Right panel: Kalshi market data
'use client';
import { useKalshiStore } from '@/stores/kalshiStore';
import { usePriceStore } from '@/stores/priceStore';
import { useTerminalStore } from '@/stores/terminalStore';

export default function KalshiMarketPanel() {
  const { spotPrice } = usePriceStore();
  const {
    targetPrice, impliedProbability, edge, expectedValue,
    kellyFraction, fractionalKelly, recommendedBet,
    volatilityAdjusted, bankroll, setTargetPrice, setImpliedProbability, setBankroll,
  } = useKalshiStore();
  const { terminalSignal } = useTerminalStore();

  const distance = targetPrice && spotPrice > 0
    ? ((targetPrice - spotPrice) / spotPrice) * 100
    : null;

  return (
    <div className="flex flex-col h-full p-3 gap-3 overflow-y-auto">
      {/* Market probability */}
      <div>
        <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-2">Kalshi Market Probability</div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={99}
            value={impliedProbability}
            onChange={(e) => setImpliedProbability(Number(e.target.value))}
            title="Kalshi implied probability"
            className="flex-1 h-1 appearance-none bg-[#1a1a2a] rounded-full accent-[#4488ff]"
          />
          <span className="text-lg font-mono font-bold text-[#4488ff] w-12 text-right">
            {impliedProbability}¢
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] font-mono text-[#00ff88]">YES {impliedProbability}¢</span>
          <span className="text-[8px] font-mono text-[#ff4466]">NO {100 - impliedProbability}¢</span>
        </div>
      </div>

      {/* Target price */}
      <div>
        <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">Target Price</div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-bold text-[#ffaa00]">
            ${targetPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
          </span>
          {distance !== null && (
            <span className={`text-[9px] font-mono ${distance > 0 ? 'text-[#00ff88]' : distance < 0 ? 'text-[#ff4466]' : 'text-[#555570]'}`}>
              {distance > 0 ? '+' : ''}{distance.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* Implied edge */}
      <div className="bg-[#0a0a12] rounded p-2">
        <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">Implied Edge</div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-mono font-bold ${edge > 0 ? 'text-[#00ff88]' : edge < 0 ? 'text-[#ff4466]' : 'text-[#555570]'}`}>
            {edge > 0 ? '+' : ''}{edge.toFixed(1)}%
          </span>
          <span className="text-[8px] font-mono text-[#3a3a50]">vs market</span>
        </div>
      </div>

      {/* Position sizing */}
      <div className="bg-[#0a0a12] rounded p-2">
        <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">Position Sizing</div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[7px] font-mono text-[#3a3a50]">Bankroll</span>
          <input
            type="number"
            value={bankroll}
            onChange={(e) => setBankroll(Number(e.target.value))}
            title="Bankroll amount"
            className="flex-1 bg-[#0d0d18] border border-[#141420] rounded px-2 py-0.5 text-[10px] font-mono text-[#e8e8f0]"
            min={100}
            step={100}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[7px] font-mono text-[#3a3a50]">Kelly</div>
            <div className="text-[10px] font-mono text-[#8888aa]">{(kellyFraction * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-[7px] font-mono text-[#3a3a50]">Frac. Kelly</div>
            <div className="text-[10px] font-mono text-[#8888aa]">{(fractionalKelly * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-[7px] font-mono text-[#3a3a50]">Recommended</div>
            <div className="text-[10px] font-mono text-[#4488ff]">${recommendedBet.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[7px] font-mono text-[#3a3a50]">EV</div>
            <div className={`text-[10px] font-mono ${expectedValue > 0 ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
              {expectedValue > 0 ? '+' : ''}{(expectedValue * 100).toFixed(1)}¢
            </div>
          </div>
        </div>
        {volatilityAdjusted && (
          <div className="text-[8px] font-mono text-[#ffaa00] mt-1">⚠ Vol-adjusted</div>
        )}
      </div>

      {/* Model vs Market comparison */}
      {terminalSignal && (
        <div className="bg-[#0a0a12] rounded p-2">
          <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">Model vs Market</div>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[7px] font-mono text-[#3a3a50]">Model</div>
              <div className="text-xs font-mono font-bold text-[#00ff88]">
                {terminalSignal.decision === 'BUY_YES' ? 'BULL' : terminalSignal.decision === 'BUY_NO' ? 'BEAR' : 'NEUT'}
              </div>
            </div>
            <div className="text-[8px] font-mono text-[#2a2a3a]">vs</div>
            <div>
              <div className="text-[7px] font-mono text-[#3a3a50]">Market</div>
              <div className="text-xs font-mono font-bold text-[#4488ff]">{impliedProbability}¢ YES</div>
            </div>
          </div>
        </div>
      )}

      {/* Spread / Liquidity placeholder */}
      <div className="bg-[#0a0a12] rounded p-2">
        <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">Liquidity</div>
        <div className="text-[9px] font-mono text-[#3a3a50]">
          Connect Kalshi WebSocket for real-time order book depth
        </div>
      </div>
    </div>
  );
}
