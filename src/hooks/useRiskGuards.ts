// /src/hooks/useRiskGuards.ts
'use client';
import { useMemo, useEffect, useRef } from 'react';
import { useTradeStore } from '@/stores/tradeStore';
import { usePriceStore } from '@/stores/priceStore';
import { useSignalStore } from '@/stores/signalStore';
import { useAlertStore } from '@/stores/alertStore';
import type { RiskAlert } from '@/types';

export function useRiskGuards(): RiskAlert[] {
  const { consecutiveLosses, rollingWinRate20, totalPnL, accountBalance, dailyLoss, trades } = useTradeStore();
  const { divergencePct } = usePriceStore();
  const { regimeShiftDetected } = useSignalStore();
  const { addAlertToHistory, isSnoozed } = useAlertStore();
  const lastAlertTypes = useRef<Set<string>>(new Set());

  const alerts = useMemo(() => {
    const activeAlerts: RiskAlert[] = [];

    const startingBalance = accountBalance - totalPnL;
    const totalDrawdown = startingBalance > 0 ? (-totalPnL) / startingBalance : 0;

    // Compute 30-trade drawdown
    const last30 = trades.filter(t => t.result !== 'pending').slice(-30);
    const drawdown30 = last30.length > 0
      ? Math.abs(Math.min(0, last30.reduce((s, t) => s + t.pnl, 0))) / accountBalance
      : 0;

    if (consecutiveLosses === 2 && !isSnoozed('consecutive_losses_2')) {
      activeAlerts.push({
        type: 'consecutive_losses_2',
        message: '⚠ 2 CONSECUTIVE LOSSES — Pause. Analyze. Do not chase.',
        color: 'amber',
        active: true,
      });
    }
    if (consecutiveLosses >= 3 && !isSnoozed('consecutive_losses_3')) {
      activeAlerts.push({
        type: 'consecutive_losses_3',
        message: '🛑 3 CONSECUTIVE LOSSES — Reduce position 50% for next 3 trades.',
        color: 'red',
        active: true,
      });
    }
    if (dailyLoss >= accountBalance * 0.05 && !isSnoozed('daily_loss_limit')) {
      activeAlerts.push({
        type: 'daily_loss_limit',
        message: '🛑 DAILY LOSS LIMIT REACHED — Stop trading. Resume tomorrow.',
        color: 'red',
        active: true,
      });
    }
    if (trades.filter(t => t.result !== 'pending').length >= 20 && rollingWinRate20 < 48 && !isSnoozed('model_degradation')) {
      activeAlerts.push({
        type: 'model_degradation',
        message: '🛑 MODEL DEGRADATION — Win rate below 48%. Enter diagnostic mode. Pause live trading.',
        color: 'red',
        active: true,
      });
    }
    if (drawdown30 > 0.15 && drawdown30 <= 0.20 && !isSnoozed('drawdown_warning')) {
      activeAlerts.push({
        type: 'drawdown_warning',
        message: '⚠ DRAWDOWN WARNING — 30-trade drawdown exceeds 15%. Reduce position size 30–50%.',
        color: 'amber',
        active: true,
      });
    }
    if (totalDrawdown > 0.20 && !isSnoozed('critical_drawdown')) {
      activeAlerts.push({
        type: 'critical_drawdown',
        message: '🛑 CRITICAL DRAWDOWN — Account down 20%+ from start. Full stop. Audit model before resuming.',
        color: 'red',
        active: true,
      });
    }
    if (regimeShiftDetected && !isSnoozed('regime_shift')) {
      activeAlerts.push({
        type: 'regime_shift',
        message: '⚠ REGIME SHIFT DETECTED — Signal weights adjusted. Reduce position size. Monitor closely.',
        color: 'amber',
        active: true,
      });
    }
    if (divergencePct > 0.2 && !isSnoozed('data_divergence')) {
      activeAlerts.push({
        type: 'data_divergence',
        message: `⚠ DATA DIVERGENCE — Price sources differ by ${divergencePct.toFixed(3)}%. Reduce position or skip trade.`,
        color: 'amber',
        active: true,
      });
    }

    return activeAlerts;
  }, [consecutiveLosses, rollingWinRate20, totalPnL, accountBalance, dailyLoss, divergencePct, regimeShiftDetected, trades, isSnoozed]);

  // Track new alerts in history
  useEffect(() => {
    const currentTypes = new Set(alerts.map(a => a.type));
    
    // Add new alerts to history
    alerts.forEach(alert => {
      if (!lastAlertTypes.current.has(alert.type)) {
        addAlertToHistory({
          type: alert.type,
          message: alert.message,
          color: alert.color,
        });
      }
    });
    
    lastAlertTypes.current = currentTypes;
  }, [alerts, addAlertToHistory]);

  return alerts;
}
