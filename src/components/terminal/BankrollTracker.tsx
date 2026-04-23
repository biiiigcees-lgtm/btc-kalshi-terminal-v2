// /src/components/terminal/BankrollTracker.tsx — Bankroll and PnL display
'use client';
import { useTerminalStore } from '@/stores/terminalStore';

export default function BankrollTracker() {
  const { bankroll, initialBankroll, totalPnL, winCount, lossCount, resetBankroll } = useTerminalStore();

  const totalTrades = winCount + lossCount;
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
  const pnlPct = initialBankroll > 0 ? (totalPnL / initialBankroll) * 100 : 0;
  const pnlColor = totalPnL > 0 ? '#00ff88' : totalPnL < 0 ? '#ff4466' : '#555570';

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider">Bankroll</span>
        <span className="text-sm font-mono font-bold text-[#e8e8f0]">${bankroll.toFixed(2)}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider">PnL</span>
        <span className="text-xs font-mono font-bold" style={{ color: pnlColor }}>
          {totalPnL > 0 ? '+' : ''}${totalPnL.toFixed(2)} ({pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1">
        <div className="bg-[#0a0a12] rounded p-1 text-center">
          <div className="text-[7px] font-mono text-[#3a3a50] uppercase">Trades</div>
          <div className="text-[10px] font-mono font-bold text-[#e8e8f0]">{totalTrades}</div>
        </div>
        <div className="bg-[#0a0a12] rounded p-1 text-center">
          <div className="text-[7px] font-mono text-[#3a3a50] uppercase">Wins</div>
          <div className="text-[10px] font-mono font-bold text-[#00ff88]">{winCount}</div>
        </div>
        <div className="bg-[#0a0a12] rounded p-1 text-center">
          <div className="text-[7px] font-mono text-[#3a3a50] uppercase">Losses</div>
          <div className="text-[10px] font-mono font-bold text-[#ff4466]">{lossCount}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider">Win Rate</span>
        <span className="text-[10px] font-mono font-bold" style={{ color: winRate >= 50 ? '#00ff88' : '#ffaa00' }}>
          {winRate.toFixed(1)}%
        </span>
      </div>

      <button
        onClick={resetBankroll}
        className="text-[8px] font-mono text-[#3a3a50] hover:text-[#ff4466] transition-colors uppercase tracking-wider"
      >
        Reset Bankroll
      </button>
    </div>
  );
}
