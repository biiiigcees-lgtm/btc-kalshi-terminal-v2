// /src/stores/tradeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TradeRecord } from '../types';

interface TradeStore {
  trades: TradeRecord[];
  accountBalance: number;
  intendedBet: number;
  rollingWinRate20: number;
  profitFactor: number;
  sharpeRatio: number;
  consecutiveLosses: number;
  totalPnL: number;
  dailyLoss: number;
  setAccountBalance: (balance: number) => void;
  setIntendedBet: (bet: number) => void;
  addTrade: (trade: TradeRecord) => void;
  logOutcome: (id: string, outcome: 'win' | 'loss') => void;
  resetDailyLoss: () => void;
}

function computeMetrics(trades: TradeRecord[]) {
  const completed = trades.filter(t => t.result !== 'pending');
  const last20 = completed.slice(-20);
  const wins = last20.filter(t => t.result === 'win').length;
  const rollingWinRate20 = last20.length > 0 ? (wins / last20.length) * 100 : 0;

  const grossProfit = completed.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(completed.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  const returns = completed.map(t => t.pnl);
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1
    ? Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1))
    : 1;
  const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;

  let consecutiveLosses = 0;
  for (let i = completed.length - 1; i >= 0; i--) {
    if (completed[i].result === 'loss') consecutiveLosses++;
    else break;
  }

  const totalPnL = completed.reduce((s, t) => s + t.pnl, 0);
  const dailyLoss = Math.abs(Math.min(0, completed
    .filter(t => {
      const d = new Date(t.windowOpen);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    })
    .reduce((s, t) => s + t.pnl, 0)));

  return { rollingWinRate20, profitFactor, sharpeRatio, consecutiveLosses, totalPnL, dailyLoss };
}

export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      trades: [],
      accountBalance: 1000,
      intendedBet: 25,
      rollingWinRate20: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      consecutiveLosses: 0,
      totalPnL: 0,
      dailyLoss: 0,
      setAccountBalance: (balance) => set({ accountBalance: balance }),
      setIntendedBet: (bet) => {
        // Validation: bet must be positive number, max 50% of balance
        if (typeof bet !== 'number' || !isFinite(bet) || bet <= 0) {
          console.error('Invalid bet amount: must be positive number');
          return;
        }
        const maxBet = get().accountBalance * 0.50; // Max 50% of balance
        if (bet > maxBet) {
          console.warn(`Bet amount exceeds maximum: $${bet.toFixed(2)} > $${maxBet.toFixed(2)} (50% of balance)`);
          return;
        }
        set({ intendedBet: bet });
      },
      addTrade: (trade) => {
        const trades = [...get().trades, trade];
        set({ trades, ...computeMetrics(trades) });
      },
      logOutcome: (id, outcome) => {
        const trades = get().trades.map(t => {
          if (t.id !== id) return t;
          const pnl = outcome === 'win' ? t.bet * 0.96 : -t.bet;
          return { ...t, result: outcome, pnl };
        });
        set({ trades, ...computeMetrics(trades) });
      },
      resetDailyLoss: () => set({ dailyLoss: 0 }),
    }),
    { name: 'btc-terminal-trades' }
  )
);
