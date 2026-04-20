'use client';
import { useState } from 'react';
import { useTradeStore } from '@/stores/tradeStore';
import { useSignalStore } from '@/stores/signalStore';
import { useKalshiStore } from '@/stores/kalshiStore';
import { useKalshiWindow } from '@/hooks/useKalshiWindow';
import type { TradeRecord } from '@/types';

function MetricBadge({ label, value, target, color }: { label: string; value: string; target?: string; color: string }) {
  return (
    <div className="panel p-2 text-center">
      <div className="text-[9px] font-display text-[#666680] uppercase tracking-widest">{label}</div>
      <div className="text-sm font-mono font-bold mt-0.5" {...(color && { style: { color } })}>{value}</div>
      {target && <div className="text-[9px] font-mono text-[#333350]">{target}</div>}
    </div>
  );
}

export default function TradeLog() {
  const {
    trades, rollingWinRate20, profitFactor, sharpeRatio,
    consecutiveLosses, totalPnL, accountBalance, addTrade, logOutcome
  } = useTradeStore();
  const { ensembleProbability } = useSignalStore();
  const { impliedProbability, edge } = useKalshiStore();
  const { windowOpenTime } = useKalshiWindow();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'win' | 'loss' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTrade, setManualTrade] = useState({
    direction: 'UP' as 'UP' | 'DOWN',
    entryPrice: '',
    exitPrice: '',
    shares: '',
    notes: ''
  });

  function handleLogTrade() {
    const trade: TradeRecord = {
      id: `trade-${Date.now()}`,
      windowOpen: windowOpenTime.toISOString(),
      direction: ensembleProbability >= 50 ? 'UP' : 'DOWN',
      predictedPct: ensembleProbability,
      kalshiPct: impliedProbability,
      edge,
      bet: useTradeStore.getState().intendedBet,
      result: 'pending',
      pnl: 0,
    };
    addTrade(trade);
  }

  function handleManualTradeEntry() {
    const entryPrice = parseFloat(manualTrade.entryPrice);
    const exitPrice = parseFloat(manualTrade.exitPrice);
    const shares = parseFloat(manualTrade.shares);
    
    if (!entryPrice || !shares) {
      alert('Please enter entry price and shares');
      return;
    }

    const trade: TradeRecord = {
      id: `manual-trade-${Date.now()}`,
      windowOpen: new Date().toISOString(),
      direction: manualTrade.direction,
      predictedPct: manualTrade.direction === 'UP' ? 55 : 45,
      kalshiPct: 50,
      edge: manualTrade.direction === 'UP' ? 5 : -5,
      bet: entryPrice * shares,
      result: exitPrice ? (manualTrade.direction === 'UP' ? (exitPrice > entryPrice ? 'win' : 'loss') : (exitPrice < entryPrice ? 'win' : 'loss')) : 'pending',
      pnl: exitPrice ? ((manualTrade.direction === 'UP' ? (exitPrice - entryPrice) : (entryPrice - exitPrice)) * shares) : 0,
    };
    
    addTrade(trade);
    setManualTrade({ direction: 'UP', entryPrice: '', exitPrice: '', shares: '', notes: '' });
    setShowManualEntry(false);
  }

  function exportTrades(format: 'csv' | 'json') {
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (format === 'json') {
      const dataStr = JSON.stringify(trades, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trades_${timestamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['Window', 'Direction', 'Predicted%', 'Kalshi%', 'Edge%', 'Bet', 'Result', 'P&L'];
      const rows = trades.map(t => [
        new Date(t.windowOpen).toLocaleString(),
        t.direction,
        t.predictedPct.toFixed(1),
        t.kalshiPct.toFixed(1),
        t.edge.toFixed(1),
        t.bet.toFixed(2),
        t.result,
        t.pnl.toFixed(2)
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trades_${timestamp}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
    setShowExportMenu(false);
  }

  const filteredTrades = trades.filter(trade => {
    if (filter !== 'all' && trade.result !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        trade.direction.toLowerCase().includes(query) ||
        trade.result.toLowerCase().includes(query) ||
        new Date(trade.windowOpen).toLocaleString().toLowerCase().includes(query)
      );
    }
    return true;
  });

  const wr20Color = rollingWinRate20 >= 54 ? '#00ff88' : rollingWinRate20 >= 50 ? '#ffaa00' : '#ff4466';
  const pfColor = profitFactor >= 1.3 ? '#00ff88' : profitFactor >= 1.1 ? '#ffaa00' : '#ff4466';
  const shColor = sharpeRatio >= 0.5 ? '#00ff88' : sharpeRatio >= 0.3 ? '#ffaa00' : '#ff4466';
  const clColor = consecutiveLosses >= 3 ? '#ff4466' : consecutiveLosses >= 2 ? '#ffaa00' : '#00ff88';
  const pnlColor = totalPnL >= 0 ? '#00ff88' : '#ff4466';

  const completed = trades.filter(t => t.result !== 'pending');

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-5 gap-1.5 px-2 pt-2 pb-1">
        <MetricBadge label="Win Rate (20)" value={`${rollingWinRate20.toFixed(1)}%`} target="target: 54%" color={wr20Color} />
        <MetricBadge label="Profit Factor" value={`${profitFactor.toFixed(2)}x`} target="target: 1.3x" color={pfColor} />
        <MetricBadge label="Sharpe Ratio" value={sharpeRatio.toFixed(3)} target="target: 0.5" color={shColor} />
        <MetricBadge label="Consec. Losses" value={`${consecutiveLosses}`} color={clColor} />
        <MetricBadge label="Total P&L" value={`${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`} color={pnlColor} />
      </div>

      <div className="px-2 pb-1 flex items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          aria-label="Filter trades by result"
          className="bg-[#1e1e2e] text-[10px] font-mono text-[#e8e8f0] rounded px-2 py-1 border border-[#333350] focus:outline-none focus:border-[#4488ff]"
        >
          <option value="all">All Trades</option>
          <option value="win">Wins Only</option>
          <option value="loss">Losses Only</option>
          <option value="pending">Pending</option>
        </select>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-[#1e1e2e] text-[10px] font-mono text-[#e8e8f0] rounded px-2 py-1 border border-[#333350] focus:outline-none focus:border-[#4488ff]"
        />
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-2 py-1 text-[10px] font-mono rounded border border-[#333350] text-[#666680] hover:text-[#e8e8f0] hover:border-[#666680] transition-colors"
          >
            Export v
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-6 z-20 bg-[#111118] border border-[#1e1e2e] rounded shadow-lg min-w-[100px]">
              <button
                className="block w-full px-3 py-1.5 text-left text-[10px] font-mono text-[#e8e8f0] hover:bg-[#1e1e2e]"
                onClick={() => exportTrades('csv')}
              >
                Export CSV
              </button>
              <button
                className="block w-full px-3 py-1.5 text-left text-[10px] font-mono text-[#e8e8f0] hover:bg-[#1e1e2e]"
                onClick={() => exportTrades('json')}
              >
                Export JSON
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-2 pb-1 flex gap-2">
        <button
          onClick={handleLogTrade}
          className="flex-1 py-1 text-xs font-mono rounded border border-[#1e1e2e] text-[#4488ff] hover:bg-[#4488ff11] transition-colors"
        >
          + LOG THIS TRADE
        </button>
        <button
          onClick={() => setShowManualEntry(!showManualEntry)}
          className="flex-1 py-1 text-xs font-mono rounded border border-[#1e1e2e] text-[#ffaa00] hover:bg-[#ffaa0011] transition-colors"
        >
          {showManualEntry ? 'CANCEL' : '+ MANUAL ENTRY'}
        </button>
      </div>

      {showManualEntry && (
        <div className="px-2 pb-2 space-y-2 border-b border-[#1e1e2e]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-display text-[#666680] uppercase tracking-widest block mb-1">Direction</label>
              <select
                value={manualTrade.direction}
                onChange={(e) => setManualTrade({...manualTrade, direction: e.target.value as 'UP' | 'DOWN'})}
                className="w-full bg-[#1e1e2e] text-xs font-mono text-[#e8e8f0] rounded px-2 py-1 border border-[#333350] focus:outline-none focus:border-[#4488ff]"
              >
                <option value="UP">UP</option>
                <option value="DOWN">DOWN</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-display text-[#666680] uppercase tracking-widest block mb-1">Entry Price</label>
              <input
                type="number"
                value={manualTrade.entryPrice}
                onChange={(e) => setManualTrade({...manualTrade, entryPrice: e.target.value})}
                placeholder="74000"
                className="w-full bg-[#1e1e2e] text-xs font-mono text-[#e8e8f0] rounded px-2 py-1 border border-[#333350] focus:outline-none focus:border-[#4488ff]"
              />
            </div>
            <div>
              <label className="text-[9px] font-display text-[#666680] uppercase tracking-widest block mb-1">Exit Price (optional)</label>
              <input
                type="number"
                value={manualTrade.exitPrice}
                onChange={(e) => setManualTrade({...manualTrade, exitPrice: e.target.value})}
                placeholder="74500"
                className="w-full bg-[#1e1e2e] text-xs font-mono text-[#e8e8f0] rounded px-2 py-1 border border-[#333350] focus:outline-none focus:border-[#4488ff]"
              />
            </div>
            <div>
              <label className="text-[9px] font-display text-[#666680] uppercase tracking-widest block mb-1">Shares/Contracts</label>
              <input
                type="number"
                value={manualTrade.shares}
                onChange={(e) => setManualTrade({...manualTrade, shares: e.target.value})}
                placeholder="10"
                className="w-full bg-[#1e1e2e] text-xs font-mono text-[#e8e8f0] rounded px-2 py-1 border border-[#333350] focus:outline-none focus:border-[#4488ff]"
              />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-display text-[#666680] uppercase tracking-widest block mb-1">Notes (optional)</label>
            <input
              type="text"
              value={manualTrade.notes}
              onChange={(e) => setManualTrade({...manualTrade, notes: e.target.value})}
              placeholder="Trade notes..."
              className="w-full bg-[#1e1e2e] text-xs font-mono text-[#e8e8f0] rounded px-2 py-1 border border-[#333350] focus:outline-none focus:border-[#4488ff]"
            />
          </div>
          <button
            onClick={handleManualTradeEntry}
            className="w-full py-1 text-xs font-mono rounded bg-[#ffaa00] text-black font-bold hover:bg-[#ffaa00bb] transition-colors"
          >
            SAVE TRADE
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2">
        <table className="w-full text-[10px] font-mono border-collapse">
          <thead>
            <tr className="text-[#333350] text-[9px] uppercase tracking-wider">
              <th className="text-left py-1 px-1">Window</th>
              <th className="text-left py-1 px-1">Dir</th>
              <th className="text-right py-1 px-1">Pred%</th>
              <th className="text-right py-1 px-1">Kalshi%</th>
              <th className="text-right py-1 px-1">Edge%</th>
              <th className="text-right py-1 px-1">Bet</th>
              <th className="text-left py-1 px-1">Result</th>
              <th className="text-right py-1 px-1">P&L</th>
              <th className="py-1 px-1"></th>
            </tr>
          </thead>
          <tbody>
            {[...filteredTrades].reverse().map(trade => {
              const borderColor = trade.result === 'win' ? '#00ff88' : trade.result === 'loss' ? '#ff4466' : '#4488ff';
              const directionColor = trade.direction === 'UP' ? 'text-[#00ff88]' : 'text-[#ff4466]';
              const edgeColor = trade.edge > 0 ? 'text-[#00ff88]' : 'text-[#ff4466]';
              const resultColor = trade.result === 'win' ? 'text-[#00ff88]' : trade.result === 'loss' ? 'text-[#ff4466]' : 'text-[#4488ff]';
              const pnlColor = trade.pnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff4466]';
              return (
                <tr
                  key={trade.id}
                  className="border-b border-[#1e1e2e]"
                  style={{ borderLeft: `3px solid ${borderColor}` }}
                >
                  <td className="py-1 px-1 text-[#666680]">
                    {new Date(trade.windowOpen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className={`py-1 px-1 font-bold ${directionColor}`}>
                    {trade.direction}
                  </td>
                  <td className="py-1 px-1 text-right text-[#e8e8f0]">{trade.predictedPct.toFixed(1)}</td>
                  <td className="py-1 px-1 text-right text-[#666680]">{trade.kalshiPct.toFixed(1)}</td>
                  <td className={`py-1 px-1 text-right ${edgeColor}`}>
                    {trade.edge > 0 ? '+' : ''}{trade.edge.toFixed(1)}
                  </td>
                  <td className="py-1 px-1 text-right text-[#e8e8f0]">${trade.bet.toFixed(0)}</td>
                  <td className="py-1 px-1">
                    <span className={`uppercase text-[9px] ${resultColor}`}>
                      {trade.result}
                    </span>
                  </td>
                  <td className={`py-1 px-1 text-right ${pnlColor}`}>
                    {trade.pnl !== 0 ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-1 px-1">
                    {trade.result === 'pending' && (
                      <div className="relative">
                        <button
                          className="text-[9px] px-1.5 py-0.5 rounded border border-[#1e1e2e] text-[#666680] hover:text-[#e8e8f0]"
                          onClick={() => setOpenDropdown(openDropdown === trade.id ? null : trade.id)}
                        >
                          LOG v
                        </button>
                        {openDropdown === trade.id && (
                          <div className="absolute right-0 top-5 z-20 bg-[#111118] border border-[#1e1e2e] rounded shadow-lg">
                            <button
                              className="block w-full px-3 py-1 text-left text-[10px] font-mono text-[#00ff88] hover:bg-[#00ff8811]"
                              onClick={() => { logOutcome(trade.id, 'win'); setOpenDropdown(null); }}
                            >WIN</button>
                            <button
                              className="block w-full px-3 py-1 text-left text-[10px] font-mono text-[#ff4466] hover:bg-[#ff446611]"
                              onClick={() => { logOutcome(trade.id, 'loss'); setOpenDropdown(null); }}
                            >LOSS</button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredTrades.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-[#333350] text-xs">
                  {trades.length === 0 ? 'No trades logged yet' : 'No trades match filter'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
