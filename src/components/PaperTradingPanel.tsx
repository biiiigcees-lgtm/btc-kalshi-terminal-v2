'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaperTradeStore } from '../stores/paperTradeStore';
import { usePriceStore } from '../stores/priceStore';
import { useKalshiStore } from '../stores/kalshiStore';
import { useSignalStore } from '../stores/signalStore';
import { lastAIDirective, lastAIAnalysisTime, lastAIConfidence } from './AIAdvisor';

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#07070e] border border-[#111120] rounded p-2">
      <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-bold font-mono" style={{ color: color || '#e8e8f0' }}>{value}</div>
    </div>
  );
}

export default function PaperTradingPanel() {
  const [lastSuggestion, setLastSuggestion] = useState<{
    directive: string; confidence: string; size: number; time: string; reason: string;
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDir, setPendingDir] = useState<'UP' | 'DOWN' | null>(null);
  const lastSeenAnalysis = useRef(0);

  const { virtualBalance, activeTrade, trades, totalTrades, winRate, profitFactor, maxDrawdown, enterTrade, exitTrade, resetAccount } = usePaperTradeStore();
  const { spotPrice } = usePriceStore();
  const { recommendedBet, edge, expectedValue } = useKalshiStore();
  const { ensembleProbability, regime } = useSignalStore();

  const canTrade = edge > 2 && expectedValue > 0 && !activeTrade && !isExecuting && spotPrice > 0;

  // Watch AI directive and update suggestion panel
  useEffect(() => {
    const id = setInterval(() => {
      if (lastAIAnalysisTime > lastSeenAnalysis.current && lastAIDirective) {
        lastSeenAnalysis.current = lastAIAnalysisTime;
        const size = recommendedBet > 0 ? recommendedBet : Math.min(25, virtualBalance * 0.02);
        setLastSuggestion({
          directive: lastAIDirective,
          confidence: lastAIConfidence,
          size,
          time: new Date(lastAIAnalysisTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reason: lastAIDirective === 'NO TRADE'
            ? 'Edge below threshold or negative EV'
            : lastAIDirective === 'BET UP'
            ? `Ensemble ${ensembleProbability.toFixed(0)}% bullish, edge +${edge.toFixed(1)}%`
            : `Ensemble ${ensembleProbability.toFixed(0)}% bearish, edge ${edge.toFixed(1)}%`,
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [recommendedBet, virtualBalance, ensembleProbability, edge]);

  async function executeTrade(dir: 'UP' | 'DOWN') {
    if (!canTrade || !spotPrice) return;
    setIsExecuting(true);
    await new Promise(r => setTimeout(r, 300));
    const size = recommendedBet > 0 ? recommendedBet : Math.min(25, virtualBalance * 0.02);
    enterTrade({
      direction: dir,
      entryPrice: spotPrice,
      size,
      windowId: `trade-${Date.now()}`,
      metadata: { ensembleProbability, edge, expectedValue, regime: `${regime.trend}-${regime.volatility}`, targetPrice: null },
    });
    setIsExecuting(false);
    setPendingDir(null);
    setShowConfirm(false);
  }

  function closeTrade() {
    if (!activeTrade || !spotPrice) return;
    exitTrade({ exitPrice: spotPrice, windowId: `close-${Date.now()}` });
  }

  const recentTrades = [...trades].reverse().slice(0, 4);

  const suggestionColor = lastSuggestion?.directive === 'BET UP' ? '#00ff88'
    : lastSuggestion?.directive === 'BET DOWN' ? '#ff4466' : '#555570';

  return (
    <div className="flex flex-col h-full bg-[#05050a] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#0d0d18] flex-shrink-0">
        <span className="text-[8px] font-mono text-[#2a2a3a] uppercase tracking-[0.25em]">EXECUTION</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold font-mono ${virtualBalance >= 10000 ? 'text-[#00ff88]' : virtualBalance >= 7500 ? 'text-[#ffaa00]' : 'text-[#ff4466]'}`}>
            ${virtualBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <button onClick={resetAccount} className="text-[8px] text-[#2a2a3a] hover:text-[#555570]">↺</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
        {/* AI Trade Suggestion */}
        <div>
          <div className="text-[7px] font-mono text-[#1e1e2e] uppercase tracking-widest mb-1">AI SUGGESTION</div>
          <AnimatePresence mode="wait">
            {lastSuggestion ? (
              <motion.div key={lastSuggestion.time}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded border p-2.5"
                style={{
                  background: `${suggestionColor}08`,
                  borderColor: `${suggestionColor}25`,
                }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <motion.span
                      animate={lastSuggestion.directive !== 'NO TRADE' ? { opacity: [1, 0.3, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="text-sm font-bold"
                      style={{ color: suggestionColor }}
                    >
                      {lastSuggestion.directive === 'BET UP' ? '▲' : lastSuggestion.directive === 'BET DOWN' ? '▼' : '—'}
                    </motion.span>
                    <span className="text-xs font-bold" style={{ color: suggestionColor }}>
                      {lastSuggestion.directive}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                      lastSuggestion.confidence === 'HIGH' ? 'text-[#00ff88] bg-[#00ff8812]' :
                      lastSuggestion.confidence === 'MEDIUM' ? 'text-[#ffaa00] bg-[#ffaa0012]' :
                      'text-[#555570] bg-[#1a1a2a]'
                    }`}>{lastSuggestion.confidence}</span>
                    <span className="text-[8px] text-[#2a2a3a]">{lastSuggestion.time}</span>
                  </div>
                </div>
                <div className="text-[9px] text-[#444460] mb-2">{lastSuggestion.reason}</div>
                {lastSuggestion.directive !== 'NO TRADE' && canTrade && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] text-[#2a2a3a]">Suggested size: <span className="text-[#4488ff]">${lastSuggestion.size.toFixed(0)}</span></span>
                    <button
                      onClick={() => { setPendingDir(lastSuggestion.directive === 'BET UP' ? 'UP' : 'DOWN'); setShowConfirm(true); }}
                      className="ml-auto px-2 py-0.5 text-[8px] font-bold rounded border border-[#4488ff44] text-[#4488ff] hover:bg-[#4488ff15] transition-colors"
                    >
                      EXECUTE →
                    </button>
                  </div>
                )}
                {lastSuggestion.directive === 'NO TRADE' && (
                  <div className="text-[8px] text-[#2a2a3a]">Holding — edge insufficient</div>
                )}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded border border-[#0d0d18] p-2.5 bg-[#07070e]">
                <div className="text-[9px] text-[#1e1e2e]">Waiting for AI analysis...</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Active trade */}
        <AnimatePresence>
          {activeTrade && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded border p-2.5"
              style={{ background: activeTrade.direction === 'UP' ? '#00ff8808' : '#ff446808', borderColor: activeTrade.direction === 'UP' ? '#00ff8830' : '#ff446830' }}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[9px] font-bold text-[#e8e8f0]">ACTIVE POSITION</span>
                <span className={`text-xs font-bold ${activeTrade.direction === 'UP' ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
                  {activeTrade.direction === 'UP' ? '▲ UP' : '▼ DOWN'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[9px] text-[#444460] mb-2">
                <span>Entry <span className="text-[#e8e8f0]">${activeTrade.entryPrice.toLocaleString()}</span></span>
                <span>Size <span className="text-[#e8e8f0]">${activeTrade.size.toFixed(0)}</span></span>
              </div>
              <button onClick={closeTrade}
                className="w-full py-1.5 text-[9px] font-bold rounded bg-[#ff4466] text-white hover:bg-[#ff6688] transition-colors">
                CLOSE POSITION
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual buttons */}
        {!activeTrade && (
          <div>
            <div className="text-[7px] font-mono text-[#1e1e2e] uppercase tracking-widest mb-1">MANUAL EXECUTION</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => { setPendingDir('UP'); setShowConfirm(true); }} disabled={!canTrade}
                className={`py-2.5 text-xs font-bold rounded transition-all ${canTrade ? 'bg-[#00ff88] text-[#050508] hover:bg-[#00ffaa] active:scale-95' : 'bg-[#0d0d18] text-[#1e1e2e] cursor-not-allowed'}`}>
                ▲ UP
              </button>
              <button onClick={() => { setPendingDir('DOWN'); setShowConfirm(true); }} disabled={!canTrade}
                className={`py-2.5 text-xs font-bold rounded transition-all ${canTrade ? 'bg-[#ff4466] text-white hover:bg-[#ff6688] active:scale-95' : 'bg-[#0d0d18] text-[#1e1e2e] cursor-not-allowed'}`}>
                ▼ DOWN
              </button>
            </div>
            {!canTrade && (
              <div className="text-[8px] text-[#2a2a3a] text-center mt-1">
                {spotPrice === 0 ? 'Waiting for price...' : edge <= 2 ? `Edge ${edge.toFixed(1)}% — min 2% required` : 'EV negative'}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-1">
          <Stat label="Trades" value={String(totalTrades)} />
          <Stat label="Win Rate" value={`${winRate.toFixed(1)}%`} color={winRate >= 54 ? '#00ff88' : winRate >= 45 ? '#ffaa00' : '#ff4466'} />
          <Stat label="Profit Factor" value={profitFactor.toFixed(2)} color={profitFactor >= 1.3 ? '#00ff88' : '#ffaa00'} />
          <Stat label="Max DD" value={`${(maxDrawdown * 100).toFixed(1)}%`} color={maxDrawdown <= 0.1 ? '#00ff88' : '#ff4466'} />
        </div>

        {/* Recent */}
        {recentTrades.length > 0 && (
          <div>
            <div className="text-[7px] font-mono text-[#1e1e2e] uppercase tracking-widest mb-1">RECENT</div>
            <div className="space-y-0.5">
              {recentTrades.map(t => (
                <div key={t.id} className="flex justify-between items-center bg-[#07070e] border border-[#0d0d18] rounded px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] ${t.direction === 'UP' ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>{t.direction === 'UP' ? '▲' : '▼'}</span>
                    <span className="text-[8px] text-[#2a2a3a]">{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {t.status === 'open' && <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-[7px] text-[#4488ff]">OPEN</motion.span>}
                  </div>
                  <span className={`text-[9px] font-bold ${(t.pnl || 0) > 0 ? 'text-[#00ff88]' : (t.pnl || 0) < 0 ? 'text-[#ff4466]' : 'text-[#2a2a3a]'}`}>
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
        {showConfirm && pendingDir && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#05050a]/90 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }}
              className="bg-[#0a0a14] border border-[#1a1a2a] rounded-lg p-4 mx-4 w-full max-w-[220px]">
              <div className="text-xs font-bold text-[#e8e8f0] mb-3">
                Confirm {pendingDir === 'UP' ? '▲ UP' : '▼ DOWN'}
              </div>
              <div className="space-y-1 text-[9px] font-mono text-[#444460] mb-4">
                <div className="flex justify-between"><span>Size</span><span className="text-[#e8e8f0]">${(recommendedBet > 0 ? recommendedBet : 25).toFixed(0)}</span></div>
                <div className="flex justify-between"><span>Entry</span><span className="text-[#e8e8f0]">${spotPrice?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Edge</span><span className="text-[#00ff88]">{edge.toFixed(1)}%</span></div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => { setShowConfirm(false); setPendingDir(null); }}
                  className="py-1.5 text-[9px] rounded bg-[#0d0d18] text-[#555570] hover:bg-[#141420]">Cancel</button>
                <button onClick={() => executeTrade(pendingDir)}
                  className={`py-1.5 text-[9px] font-bold rounded ${pendingDir === 'UP' ? 'bg-[#00ff88] text-[#050508]' : 'bg-[#ff4466] text-white'}`}>
                  {isExecuting ? '⟳' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
