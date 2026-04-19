// /src/components/PaperTradingPanel.tsx
'use client';
import { useState } from 'react';
import { usePaperTradeStore } from '../stores/paperTradeStore';
import { usePriceStore } from '../stores/priceStore';
import { useKalshiStore } from '../stores/kalshiStore';
import { useSignalStore } from '../stores/signalStore';
import type { PaperTrade } from '../stores/paperTradeStore';

interface TradeConfirmationModalProps {
  readonly pendingDirection: 'UP' | 'DOWN' | null;
  readonly recommendedBet: number;
  readonly edge: number;
  readonly spotPrice: number | undefined;
  readonly isExecuting: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function TradeConfirmationModal({ pendingDirection, recommendedBet, edge, spotPrice, isExecuting, onCancel, onConfirm }: TradeConfirmationModalProps) {
  return (
    <div className="absolute inset-0 bg-[#0a0a0f]/90 flex items-center justify-center z-50">
      <div className="bg-[#1e1e2e] border border-[#333350] rounded-lg p-4 max-w-xs w-full mx-4">
        <div className="text-sm font-bold text-[#e8e8f0] mb-3">Confirm Trade</div>
        <div className="space-y-2 text-xs text-[#8888aa] mb-4">
          <div className="flex justify-between">
            <span>Direction:</span>
            <span className={pendingDirection === 'UP' ? 'text-[#00ff88]' : 'text-[#ff4466]'}>
              {pendingDirection}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Size:</span>
            <span>${recommendedBet.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Edge:</span>
            <span className="text-[#00ff88]">{edge.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span>Entry Price:</span>
            <span>${spotPrice?.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isExecuting}
            className="flex-1 py-2 text-xs rounded bg-[#333350] text-[#e8e8f0] hover:bg-[#444460] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isExecuting}
            className="flex-1 py-2 text-xs rounded bg-[#4488ff] text-white hover:bg-[#66aaff] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isExecuting ? (
              <>
                <span className="animate-spin">⟳</span>
                <span>Confirming...</span>
              </>
            ) : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActiveTradeDisplayProps {
  readonly activeTrade: PaperTrade;
  readonly onClose: () => void;
}

function ActiveTradeDisplay({ activeTrade, onClose }: ActiveTradeDisplayProps) {
  return (
    <div className="m-2 p-3 bg-[#1e1e2e] rounded border border-[#333350]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[#e8e8f0]">ACTIVE TRADE</span>
        <span className={`text-xs font-bold ${activeTrade.direction === 'UP' ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
          {activeTrade.direction === 'UP' ? '▲ UP' : '▼ DOWN'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] text-[#8888aa] mb-3">
        <div>Entry: ${activeTrade.entryPrice.toLocaleString()}</div>
        <div>Size: ${activeTrade.size.toLocaleString()}</div>
        <div>Edge: {activeTrade.metadata.edge.toFixed(2)}%</div>
        <div>EV: {activeTrade.metadata.expectedValue.toFixed(3)}</div>
      </div>
      <button
        onClick={onClose}
        className="w-full py-2 text-xs font-bold rounded bg-[#ff4466] text-white hover:bg-[#ff6688] transition-colors"
      >
        CLOSE POSITION
      </button>
    </div>
  );
}

interface TradeEntryButtonsProps {
  readonly canTrade: boolean;
  readonly optimisticTrade: { direction: 'UP' | 'DOWN'; timestamp: number } | null;
  readonly onEnterTrade: (direction: 'UP' | 'DOWN') => void;
}

function TradeEntryButtons({ canTrade, optimisticTrade, onEnterTrade }: TradeEntryButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 p-2">
      <button
        onClick={() => onEnterTrade('UP')}
        disabled={!canTrade}
        className={`py-3 text-sm font-bold rounded transition-all relative overflow-hidden ${
          canTrade 
            ? 'bg-[#00ff88] text-[#0a0a0f] hover:bg-[#00ffaa]' 
            : 'bg-[#1e1e2e] text-[#444460] cursor-not-allowed'
        }`}
      >
        {optimisticTrade?.direction === 'UP' && (
          <span className="absolute inset-0 flex items-center justify-center bg-[#00ff88]">
            <span className="animate-pulse">EXECUTING...</span>
          </span>
        )}
        <span className={optimisticTrade?.direction === 'UP' ? 'opacity-0' : ''}>▲ UP</span>
      </button>
      <button
        onClick={() => onEnterTrade('DOWN')}
        disabled={!canTrade}
        className={`py-3 text-sm font-bold rounded transition-all relative overflow-hidden ${
          canTrade 
            ? 'bg-[#ff4466] text-white hover:bg-[#ff6688]' 
            : 'bg-[#1e1e2e] text-[#444460] cursor-not-allowed'
        }`}
      >
        {optimisticTrade?.direction === 'DOWN' && (
          <span className="absolute inset-0 flex items-center justify-center bg-[#ff4466]">
            <span className="animate-pulse">EXECUTING...</span>
          </span>
        )}
        <span className={optimisticTrade?.direction === 'DOWN' ? 'opacity-0' : ''}>▼ DOWN</span>
      </button>
    </div>
  );
}

interface PerformanceStatsProps {
  readonly totalTrades: number;
  readonly winRate: number;
  readonly profitFactor: number;
  readonly maxDrawdown: number;
}

function PerformanceStats({ totalTrades, winRate, profitFactor, maxDrawdown }: PerformanceStatsProps) {
  return (
    <>
      <div className="text-[9px] text-[#666680] uppercase tracking-widest mb-2">Performance</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#1e1e2e] rounded p-2">
          <div className="text-[9px] text-[#666680]">Trades</div>
          <div className="text-sm font-bold text-[#e8e8f0]">{totalTrades}</div>
        </div>
        <div className="bg-[#1e1e2e] rounded p-2">
          <div className="text-[9px] text-[#666680]">Win Rate</div>
          <div className={`text-sm font-bold ${winRate >= 50 ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
            {winRate.toFixed(1)}%
          </div>
        </div>
        <div className="bg-[#1e1e2e] rounded p-2">
          <div className="text-[9px] text-[#666680]">Profit Factor</div>
          <div className={`text-sm font-bold ${profitFactor >= 1.5 ? 'text-[#00ff88]' : 'text-[#ffaa00]'}`}>
            {profitFactor.toFixed(2)}
          </div>
        </div>
        <div className="bg-[#1e1e2e] rounded p-2">
          <div className="text-[9px] text-[#666680]">Max DD</div>
          <div className={`text-sm font-bold ${maxDrawdown <= 0.1 ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
            {(maxDrawdown * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </>
  );
}

interface RecentTradesListProps {
  readonly trades: PaperTrade[];
}

function RecentTradesList({ trades }: RecentTradesListProps) {
  if (trades.length === 0) return null;
  
  return (
    <>
      <div className="text-[9px] text-[#666680] uppercase tracking-widest mt-3 mb-2">Recent Trades</div>
      <div className="space-y-1 max-h-24 overflow-y-auto">
        {trades.slice(-5).reverse().map((trade) => (
          <div key={trade.id} className="flex items-center justify-between bg-[#1e1e2e] rounded px-2 py-1">
            <div className="flex items-center gap-2">
              <span className={trade.direction === 'UP' ? 'text-[#00ff88]' : 'text-[#ff4466]'}>
                {trade.direction === 'UP' ? '▲' : '▼'}
              </span>
              <span className="text-[9px] text-[#8888aa]">
                {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <span className={`text-xs font-bold ${(trade.pnl || 0) >= 0 ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
              {(trade.pnl || 0) >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function PaperTradingPanel() {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingDirection, setPendingDirection] = useState<'UP' | 'DOWN' | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [optimisticTrade, setOptimisticTrade] = useState<{ direction: 'UP' | 'DOWN'; timestamp: number } | null>(null);
  
  const { 
    virtualBalance, 
    activeTrade, 
    trades,
    totalTrades,
    winRate,
    profitFactor,
    maxDrawdown,
    enterTrade,
    exitTrade,
    resetAccount,
  } = usePaperTradeStore();
  
  const { spotPrice } = usePriceStore();
  const { recommendedBet, edge, expectedValue } = useKalshiStore();
  const { ensembleProbability, regime } = useSignalStore();

  const canTrade = edge > 2 && expectedValue > 0 && !activeTrade && !isExecuting;

  const handleEnterTrade = (direction: 'UP' | 'DOWN') => {
    if (!canTrade) return;
    setPendingDirection(direction);
    setShowConfirmation(true);
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setPendingDirection(null);
  };

  const confirmTrade = async () => {
    if (!pendingDirection || !spotPrice) return;
    
    setIsExecuting(true);
    setShowConfirmation(false);
    
    // Optimistic update - show immediate feedback
    setOptimisticTrade({ direction: pendingDirection, timestamp: Date.now() });
    
    const tradeSize = recommendedBet > 0 ? recommendedBet : Math.min(100, virtualBalance * 0.02);
    
    try {
      // Simulate network delay for realistic feel
      await new Promise(resolve => setTimeout(resolve, 300));
      
      enterTrade({
        direction: pendingDirection,
        entryPrice: spotPrice,
        size: tradeSize,
        windowId: `window-${Date.now()}`,
        metadata: {
          ensembleProbability,
          edge,
          expectedValue,
          regime: `${regime.trend}-${regime.volatility}`,
          targetPrice: null,
        },
      });
    } catch (error) {
      console.error('Trade execution failed:', error);
    } finally {
      setIsExecuting(false);
      setOptimisticTrade(null);
      setPendingDirection(null);
    }
  };

  const handleCloseTrade = async () => {
    if (activeTrade && spotPrice && !isExecuting) {
      setIsExecuting(true);
      
      try {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 200));
        exitTrade({
          exitPrice: spotPrice,
          windowId: `window-${Date.now()}`,
        });
      } catch (error) {
        console.error('Trade close failed:', error);
      } finally {
        setIsExecuting(false);
      }
    }
  };

  const formatCurrency = (n: number) => 
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col h-full bg-[#0d0d14] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e2e]">
        <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest">
          Paper Trading
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${virtualBalance >= 10000 ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
            {formatCurrency(virtualBalance)}
          </span>
          <button
            onClick={resetAccount}
            className="text-[9px] text-[#666680] hover:text-[#e8e8f0] transition-colors"
            title="Reset to $10,000"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Active Trade */}
      {activeTrade ? (
        <ActiveTradeDisplay activeTrade={activeTrade} onClose={handleCloseTrade} />
      ) : (
        <TradeEntryButtons canTrade={canTrade} optimisticTrade={optimisticTrade} onEnterTrade={handleEnterTrade} />
      )}

      {/* Trade Restriction Message */}
      {!canTrade && !activeTrade && !isExecuting && (
        <div className="px-3 py-2 text-[9px] text-[#ffaa00] text-center">
          {edge <= 2 && 'Edge must be > 2% to trade'}
          {expectedValue <= 0 && expectedValue !== 0 && 'EV must be positive'}
        </div>
      )}
      {isExecuting && (
        <div className="px-3 py-2 text-[9px] text-[#4488ff] text-center animate-pulse">
          Processing trade...
        </div>
      )}

      {/* Stats */}
      <div className="flex-1 px-3 py-2">
        <PerformanceStats totalTrades={totalTrades} winRate={winRate} profitFactor={profitFactor} maxDrawdown={maxDrawdown} />
        <RecentTradesList trades={trades} />
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <TradeConfirmationModal
          pendingDirection={pendingDirection}
          recommendedBet={recommendedBet}
          edge={edge}
          spotPrice={spotPrice}
          isExecuting={isExecuting}
          onCancel={handleCancelConfirmation}
          onConfirm={confirmTrade}
        />
      )}
    </div>
  );
}
