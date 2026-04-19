// /src/stores/paperTradeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TradeDirection } from '../types';

export interface PaperTrade {
  id: string;
  timestamp: number;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number | null;
  size: number;
  fees: number;
  pnl: number | null;
  status: 'open' | 'closed';
  windowId: string;
  exitWindowId: string | null;
  exitTimestamp: number | null;
  metadata: {
    ensembleProbability: number;
    edge: number;
    expectedValue: number;
    regime: string;
    targetPrice: number | null;
  };
}

interface PaperTradeStore {
  // Account
  virtualBalance: number;
  initialBalance: number;
  
  // Trades
  trades: PaperTrade[];
  activeTrade: PaperTrade | null;
  
  // Metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  currentDrawdown: number;
  
  // Actions
  setVirtualBalance: (balance: number) => void;
  enterTrade: (params: {
    direction: TradeDirection;
    entryPrice: number;
    size: number;
    windowId: string;
    metadata: PaperTrade['metadata'];
  }) => PaperTrade | null;
  exitTrade: (params: {
    exitPrice: number;
    windowId: string;
  }) => void;
  closeAllTrades: (exitPrice: number) => void;
  resetAccount: () => void;
  calculateMetrics: () => void;
}

const KALSHI_FEE_RATE = 0.04; // 4% fee on winnings

export const usePaperTradeStore = create<PaperTradeStore>()(
  persist(
    (set, get) => ({
      virtualBalance: 10000,
      initialBalance: 10000,
      trades: [],
      activeTrade: null,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,

      setVirtualBalance: (balance) => set({ virtualBalance: balance }),

      enterTrade: ({ direction, entryPrice, size, windowId, metadata }) => {
        const state = get();
        
        // Comprehensive input validation
        if (!direction || (direction !== 'UP' && direction !== 'DOWN')) {
          console.error('Invalid trade direction: must be UP or DOWN');
          return null;
        }
        
        if (!entryPrice || typeof entryPrice !== 'number' || entryPrice <= 0 || !isFinite(entryPrice)) {
          console.error('Invalid entry price: must be positive number');
          return null;
        }
        
        if (!size || typeof size !== 'number' || size <= 0 || !isFinite(size)) {
          console.error('Invalid trade size: must be positive number');
          return null;
        }
        
        if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
          console.error('Invalid window ID: must be non-empty string');
          return null;
        }
        
        // Check if already have active trade
        if (state.activeTrade) {
          console.warn('Trade already active - close current trade first');
          return null;
        }
        
        // Check sufficient balance
        if (size > state.virtualBalance) {
          console.warn(`Insufficient virtual balance: $${size.toFixed(2)} needed, $${state.virtualBalance.toFixed(2)} available`);
          return null;
        }
        
        // Validate max bet size (prevent excessive bets)
        const maxBetSize = state.virtualBalance * 0.25; // Max 25% of balance per trade
        if (size > maxBetSize) {
          console.warn(`Trade size exceeds max limit: $${size.toFixed(2)} > $${maxBetSize.toFixed(2)} (25% of balance)`);
          return null;
        }

        const trade: PaperTrade = {
          id: `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          direction,
          entryPrice,
          exitPrice: null,
          size,
          fees: 0,
          pnl: null,
          status: 'open',
          windowId,
          exitWindowId: null,
          exitTimestamp: null,
          metadata,
        };

        set({ 
          activeTrade: trade,
          virtualBalance: state.virtualBalance - size, // Reserve the bet amount
        });

        return trade;
      },

      exitTrade: ({ exitPrice, windowId }) => {
        const state = get();
        if (!state.activeTrade) {
          console.warn('exitTrade: No active trade to close');
          return;
        }

        // Validate exitPrice
        if (!exitPrice || typeof exitPrice !== 'number' || exitPrice <= 0 || !isFinite(exitPrice)) {
          console.error('exitTrade: Invalid exitPrice', exitPrice);
          return;
        }

        // Validate windowId
        if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
          console.error('exitTrade: Invalid windowId', windowId);
          return;
        }

        const trade = state.activeTrade;
        const direction = trade.direction;
        
        // Calculate P&L for binary options
        // In binary markets: if correct, you win ~85-96% of bet; if wrong, you lose 100% of bet
        let isWin = false;
        let pnl = 0;
        
        if (direction === 'UP') {
          // UP wins if exit > entry (price went up)
          isWin = exitPrice > trade.entryPrice;
        } else {
          // DOWN wins if exit < entry (price went down)
          isWin = exitPrice < trade.entryPrice;
        }
        
        if (isWin) {
          // Win: Return bet + profit (Kalshi typically pays ~85-96% on wins)
          // For paper trading, we use 0.96 (96%) as the payout multiplier
          const grossProfit = trade.size * 0.96;
          const fees = grossProfit * KALSHI_FEE_RATE;
          pnl = grossProfit - fees;
        } else {
          // Loss: Lose the entire bet size
          pnl = -trade.size;
        }

        // Calculate new balance: Return the reserved bet size + P&L
        // state.virtualBalance currently has trade.size deducted (reserved)
        // So we add back trade.size + pnl
        const newBalance = state.virtualBalance + trade.size + pnl;

        const closedTrade: PaperTrade = {
          ...trade,
          exitPrice,
          exitWindowId: windowId,
          exitTimestamp: Date.now(),
          pnl,
          fees: isWin ? pnl * KALSHI_FEE_RATE / (1 - KALSHI_FEE_RATE) : 0, // Recalculate for record
          status: 'closed',
        };

        set({
          trades: [...state.trades, closedTrade],
          activeTrade: null,
          virtualBalance: newBalance,
        });

        get().calculateMetrics();
      },

      closeAllTrades: (exitPrice) => {
        const state = get();
        if (state.activeTrade) {
          get().exitTrade({ exitPrice, windowId: 'manual-close' });
        }
      },

      resetAccount: () => {
        set({
          virtualBalance: 10000,
          initialBalance: 10000,
          trades: [],
          activeTrade: null,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          avgWin: 0,
          avgLoss: 0,
          profitFactor: 0,
          maxDrawdown: 0,
          currentDrawdown: 0,
        });
      },

      calculateMetrics: () => {
        const state = get();
        const closedTrades = state.trades.filter(t => t.status === 'closed');
        
        if (closedTrades.length === 0) return;

        const totalTrades = closedTrades.length;
        const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
        const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0).length;
        const winRate = (winningTrades / totalTrades) * 100;

        const wins = closedTrades.filter(t => (t.pnl || 0) > 0).map(t => t.pnl || 0);
        const losses = closedTrades.filter(t => (t.pnl || 0) < 0).map(t => Math.abs(t.pnl || 0));

        const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

        const grossProfit = wins.reduce((a, b) => a + b, 0);
        const grossLoss = losses.reduce((a, b) => a + b, 0);
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

        // Calculate drawdown
        let peak = state.initialBalance;
        let maxDrawdown = 0;
        let runningBalance = state.initialBalance;

        for (const trade of closedTrades) {
          runningBalance += trade.pnl || 0;
          if (runningBalance > peak) {
            peak = runningBalance;
          }
          const drawdown = (peak - runningBalance) / peak;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }
        }

        const currentDrawdown = (peak - state.virtualBalance) / peak;

        set({
          totalTrades,
          winningTrades,
          losingTrades,
          winRate,
          avgWin,
          avgLoss,
          profitFactor,
          maxDrawdown,
          currentDrawdown,
        });
      },
    }),
    { name: 'btc-terminal-paper-trades' }
  )
);
