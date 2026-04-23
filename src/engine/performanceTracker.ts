// src/engine/performanceTracker.ts — Signal performance tracking and metrics
import type { SignalPerformance, DecisionSignal } from '@/types';

export class PerformanceTracker {
  private performance: Map<string, SignalPerformance> = new Map();
  private signalHistory: Array<{ signal: DecisionSignal; outcome: 'win' | 'loss' | 'breakeven' | 'pending'; timestamp: number }> = [];

  recordSignal(signal: DecisionSignal): void {
    const key = `${signal.regime}_${signal.direction}`;
    const existing = this.performance.get(key);

    if (existing) {
      existing.totalSignals++;
      this.performance.set(key, existing);
    } else {
      this.performance.set(key, {
        hitRate: 0,
        precision: 0,
        recall: 0,
        expectancy: 0,
        totalSignals: 1,
        winningSignals: 0,
        avgReturn: 0,
      });
    }

    this.signalHistory.push({
      signal,
      outcome: 'pending',
      timestamp: Date.now(),
    });
  }

  recordOutcome(signalId: string, outcome: 'win' | 'loss' | 'breakeven', returnPct: number): void {
    const historyEntry = this.signalHistory.find(h => h.signal.timestamp.toString() === signalId);
    if (!historyEntry) return;

    historyEntry.outcome = outcome === 'breakeven' ? 'pending' : outcome;
    const key = `${historyEntry.signal.regime}_${historyEntry.signal.direction}`;
    const existing = this.performance.get(key);

    if (existing) {
      if (outcome === 'win') {
        existing.winningSignals++;
      }
      
      // Update hit rate
      existing.hitRate = existing.winningSignals / existing.totalSignals;
      
      // Update precision (winning signals / total signals of this type)
      existing.precision = existing.hitRate;
      
      // Update avg return
      const totalReturn = existing.avgReturn * (existing.totalSignals - 1) + returnPct;
      existing.avgReturn = totalReturn / existing.totalSignals;
      
      // Update expectancy (avg return * win rate - avg loss * loss rate)
      const avgLoss = returnPct < 0 ? Math.abs(returnPct) : 0;
      existing.expectancy = (existing.avgReturn * existing.hitRate) - (avgLoss * (1 - existing.hitRate));
      
      this.performance.set(key, existing);
    }
  }

  getMetrics(signalType: string): SignalPerformance | null {
    return this.performance.get(signalType) || null;
  }

  getAllMetrics(): Map<string, SignalPerformance> {
    return new Map(this.performance);
  }

  getRecentSignals(limit: number = 10): Array<{ signal: DecisionSignal; outcome: 'win' | 'loss' | 'breakeven' | 'pending'; timestamp: number }> {
    return this.signalHistory.slice(-limit);
  }

  getWinRate(regime?: string, direction?: string): number {
    let total = 0;
    let wins = 0;

    for (const [key, perf] of this.performance) {
      if (regime && !key.startsWith(regime)) continue;
      if (direction && !key.endsWith(direction)) continue;
      
      total += perf.totalSignals;
      wins += perf.winningSignals;
    }

    return total > 0 ? wins / total : 0;
  }

  getExpectancy(regime?: string, direction?: string): number {
    let totalSignals = 0;
    let weightedExpectancy = 0;

    for (const [key, perf] of this.performance) {
      if (regime && !key.startsWith(regime)) continue;
      if (direction && !key.endsWith(direction)) continue;
      
      totalSignals += perf.totalSignals;
      weightedExpectancy += perf.expectancy * perf.totalSignals;
    }

    return totalSignals > 0 ? weightedExpectancy / totalSignals : 0;
  }

  reset(): void {
    this.performance.clear();
    this.signalHistory = [];
  }

  pruneOldSignals(maxAgeMs: number = 86400000): void {
    const cutoff = Date.now() - maxAgeMs;
    this.signalHistory = this.signalHistory.filter(h => h.timestamp > cutoff);
  }
}
