// /src/lib/decisionLogger.ts — Decision logging for review and analysis
import type { EnhancedDecisionSignal } from '@/types';

interface DecisionLog {
  id: string;
  timestamp: number;
  signal: EnhancedDecisionSignal;
  outcome: 'pending' | 'win' | 'loss' | 'breakeven';
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  holdTime?: number;
  notes?: string;
}

class DecisionLogger {
  private logs: DecisionLog[] = [];
  private maxLogs = 1000;

  logDecision(signal: EnhancedDecisionSignal, entryPrice: number): string {
    const log: DecisionLog = {
      id: `dec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      signal,
      outcome: 'pending',
      entryPrice,
    };

    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    return log.id;
  }

  updateOutcome(
    id: string,
    outcome: 'win' | 'loss' | 'breakeven',
    exitPrice: number,
    notes?: string
  ): void {
    const log = this.logs.find(l => l.id === id);
    if (!log) return;

    log.outcome = outcome;
    log.exitPrice = exitPrice;
    log.pnl = exitPrice - log.entryPrice;
    log.pnlPercent = ((exitPrice - log.entryPrice) / log.entryPrice) * 100;
    log.holdTime = Date.now() - log.timestamp;
    log.notes = notes;
  }

  getLogs(limit?: number): DecisionLog[] {
    return limit ? this.logs.slice(0, limit) : this.logs;
  }

  getPendingLogs(): DecisionLog[] {
    return this.logs.filter(l => l.outcome === 'pending');
  }

  getStats() {
    const completed = this.logs.filter(l => l.outcome !== 'pending');
    const wins = completed.filter(l => l.outcome === 'win').length;
    const losses = completed.filter(l => l.outcome === 'loss').length;
    const breakeven = completed.filter(l => l.outcome === 'breakeven').length;
    const total = completed.length;

    const hitRate = total > 0 ? (wins / total) * 100 : 0;
    const avgPnl = total > 0 
      ? completed.reduce((sum, l) => sum + (l.pnlPercent || 0), 0) / total 
      : 0;

    const byRegime = this.logs.reduce<Record<string, { wins: number; total: number }>>((acc, log) => {
      const regime = log.signal.regime;
      if (!acc[regime]) acc[regime] = { wins: 0, total: 0 };
      acc[regime].total++;
      if (log.outcome === 'win') acc[regime].wins++;
      return acc;
    }, {});

    const regimeHitRates = Object.entries(byRegime).reduce<Record<string, number>>((acc, [regime, data]) => {
      acc[regime] = data.total > 0 ? (data.wins / data.total) * 100 : 0;
      return acc;
    }, {});

    return {
      total: this.logs.length,
      pending: this.logs.filter(l => l.outcome === 'pending').length,
      completed: total,
      wins,
      losses,
      breakeven,
      hitRate,
      avgPnl,
      regimeHitRates,
    };
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const decisionLogger = new DecisionLogger();
