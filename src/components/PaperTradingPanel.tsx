'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaperTradeStore } from '../stores/paperTradeStore';
import { usePriceStore } from '../stores/priceStore';
import { useKalshiStore } from '../stores/kalshiStore';
import { useSignalStore } from '../stores/signalStore';
import { lastAIDirective } from './AIAdvisor';

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0a0a14] border border-[#1a1a2a] rounded p-2">
      <div className="text-[9px] font-mono text-[#444460] uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-bold font-mono" style={{ color: color || '#e8e8f0' }}>{value}</div>
    </div>
  );
}

export default function PaperTradingPanel() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDir, setPendingDir] = useState<'UP' | 'DOWN' | null>(null);

  const {
    virtualBalance, activeTrade, trades,
    totalTrades, winRate, profitFactor, maxDrawdown,
    enterTrade, exitTrade, resetAccount,
  } = usePaperTradeStore();

  const { spotPrice } = usePriceStore();
  const { recommendedBet, edge, expectedValue } = useKalshiStore();
  const { ensembleProbability, regime } = useSignalStore();

  const canTrade = edge > 2 && expectedValue > 0 && !activeTrade && !isExecuting && spotPrice > 0;

  function manualTrade(dir: 'UP' | 'DOWN') {
    if (!canTrade) return;
    setPendingDir(dir);
    setShowConfirm(true);
  }

  async function confirmTrade() {
    if (!pendingDir) return;
    setShowConfirm(false);
    setIsExecuting(true);
    await new Promise(r => setTimeout(r, 300));
    const size = recommendedBet > 0 ? recommendedBet : Math.min(50, virtualBalance * 0.02);
    enterTrade({
      direction: pendingDir,
      entryPrice: spotPrice,
      size,
      windowId: `manual-${Date.now()}`,
      metadata: { ensembleProbability, edge, expectedValue, regime: `${regime.trend}-${regime.volatility}`, targetPrice: null },
    });
    setIsExecuting(false);
    setPendingDir(null);
  }

  function closePosition() {
    if (!activeTrade || !spotPrice) return;
    exitTrade({ exitPrice: spotPrice, windowId: `close-${Date.now()}` });
  }

  const recentTrades = [...trades].reverse().slice(0, 5);

  return (
    <div className="flex flex-col h-full bg-[#07070f] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a2a] flex-shrink-0">
        <span className="text-[9px] font-mono text-[#444460] uppercase tracking-[0.2em]">EXECUTION</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold font-mono ${virtualBalance >= 10000 ? 'text-[#00ff88]' : virtualBalance >= 8000 ? 'text-[#ffaa00]' : 'text-[#ff4466]'}`}>
            ${virtualBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          <button onClick={resetAccount} className="text-[9px] text-[#333350] hover:text-[#666680] transition-colors">↺</button>
        </div>
      </div>

      {/* AI Suggestion */}
      <div className="px-3 py-2 border-b border-[#1a1a2a] flex-shrink-0">
        <div className="text-[9px] font-mono text-[#333350] uppercase tracking-wider mb-1">AI SUGGESTION</div>
        <div className={`text-xs font-bold font-mono ${lastAIDirective === 'UP' ? 'text-[#00ff88]' : lastAIDirective === 'DOWN' ? 'text-[#ff4466]' : lastAIDirective ? 'text-[#4488ff]' : 'text-[#444460]'}`}>
          {lastAIDirective || '—'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
        {/* Active trade */}
        <AnimatePresence>
          {activeTrade && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className={`p-3 rounded border ${activeTrade.direction === 'UP' ? 'bg-[#00ff8808] border-[#00ff8833]' : 'bg-[#ff446608] border-[#ff446633]'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold font-mono text-[#e8e8f0]">ACTIVE TRADE</span>
                <span className={`text-sm font-bold font-mono ${activeTrade.direction === 'UP' ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
                  {activeTrade.direction === 'UP' ? '▲ UP' : '▼ DOWN'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-[#666680] mb-3">
                <div>Entry <span className="text-[#e8e8f0]">${activeTrade.entryPrice.toLocaleString()}</span></div>
                <div>Size <span className="text-[#e8e8f0]">${activeTrade.size.toFixed(0)}</span></div>
                <div>Edge <span className="text-[#00ff88]">{activeTrade.metadata.edge.toFixed(1)}%</span></div>
                <div>EV <span className="text-[#00ff88]">{(activeTrade.metadata.expectedValue * 100).toFixed(2)}%</span></div>
              </div>
              <button onClick={closePosition}
                className="w-full py-1.5 text-xs font-bold rounded bg-[#ff4466] text-white hover:bg-[#ff6688] transition-colors active:scale-95">
                CLOSE POSITION
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual trade buttons (shown when no active trade) */}
        {!activeTrade && (
          <div className="space-y-1.5">
            <div className="text-[9px] text-[#333350] text-center font-mono mb-1">MANUAL EXECUTION</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => manualTrade('UP')} disabled={!canTrade}
                className={`py-3 text-sm font-bold rounded transition-all active:scale-95 ${canTrade ? 'bg-[#00ff88] text-[#0a0a0f] hover:bg-[#00ffaa]' : 'bg-[#1a1a2a] text-[#333350] cursor-not-allowed'}`}>
                {isExecuting ? '⟳' : '▲ UP'}
              </button>
              <button onClick={() => manualTrade('DOWN')} disabled={!canTrade}
                className={`py-3 text-sm font-bold rounded transition-all active:scale-95 ${canTrade ? 'bg-[#ff4466] text-white hover:bg-[#ff6688]' : 'bg-[#1a1a2a] text-[#333350] cursor-not-allowed'}`}>
                {isExecuting ? '⟳' : '▼ DOWN'}
              </button>
            </div>
            {!canTrade && !isExecuting && (
              <div className="text-[9px] text-[#ffaa00] text-center font-mono">
                {spotPrice === 0 ? 'Waiting for price feed...' : edge <= 2 ? 'Edge < 2% — no trade' : 'EV negative — no trade'}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-1.5">
          <StatBox label="Trades" value={String(totalTrades)} />
          <StatBox label="Win Rate" value={`${winRate.toFixed(1)}%`} color={winRate >= 54 ? '#00ff88' : winRate >= 45 ? '#ffaa00' : '#ff4466'} />
          <StatBox label="Profit Factor" value={profitFactor.toFixed(2)} color={profitFactor >= 1.3 ? '#00ff88' : '#ffaa00'} />
          <StatBox label="Max DD" value={`${(maxDrawdown * 100).toFixed(1)}%`} color={maxDrawdown <= 0.1 ? '#00ff88' : '#ff4466'} />
        </div>

        {/* Recent trades */}
        {recentTrades.length > 0 && (
          <div>
            <div className="text-[9px] font-mono text-[#333350] uppercase tracking-wider mb-1">Recent</div>
            <div className="space-y-0.5">
              {recentTrades.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-[#0a0a14] rounded px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] ${t.direction === 'UP' ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
                      {t.direction === 'UP' ? '▲' : '▼'}
                    </span>
                    <span className="text-[9px] text-[#444460]">
                      {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {t.status === 'open' && (
                      <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-[8px] text-[#4488ff]">OPEN</motion.span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold ${(t.pnl || 0) > 0 ? 'text-[#00ff88]' : (t.pnl || 0) < 0 ? 'text-[#ff4466]' : 'text-[#444460]'}`}>
                    {t.status === 'open' ? '—' : `${(t.pnl || 0) >= 0 ? '+' : ''}$${(t.pnl || 0).toFixed(0)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#07070f]/90 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-4 mx-4 w-full max-w-[240px]">
              <div className="text-sm font-bold text-[#e8e8f0] mb-3">Confirm {pendingDir} trade</div>
              <div className="space-y-1.5 text-[11px] font-mono text-[#666680] mb-4">
                <div className="flex justify-between"><span>Size</span><span className="text-[#e8e8f0]">${(recommendedBet > 0 ? recommendedBet : 25).toFixed(0)}</span></div>
                <div className="flex justify-between"><span>Entry</span><span className="text-[#e8e8f0]">${spotPrice?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Edge</span><span className="text-[#00ff88]">{edge.toFixed(1)}%</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setShowConfirm(false); setPendingDir(null); }}
                  className="py-2 text-xs rounded bg-[#1e1e2e] text-[#666680] hover:bg-[#2a2a3a]">Cancel</button>
                <button onClick={confirmTrade}
                  className={`py-2 text-xs font-bold rounded ${pendingDir === 'UP' ? 'bg-[#00ff88] text-[#0a0a0f]' : 'bg-[#ff4466] text-white'}`}>
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
