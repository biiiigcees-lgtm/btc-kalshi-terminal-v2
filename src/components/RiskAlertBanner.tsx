'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRiskGuards } from '@/hooks/useRiskGuards';
import { useAlertStore, type AlertRecord } from '@/stores/alertStore';

const SNOOZE_OPTIONS = [
  { label: '15m', minutes: 15 },
  { label: '1h', minutes: 60 },
  { label: '4h', minutes: 240 },
  { label: '24h', minutes: 1440 },
];

function AlertHistoryPanel({ 
  onClose, 
  history 
}: { 
  onClose: () => void;
  history: AlertRecord[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute top-full right-0 mt-2 w-96 max-h-96 overflow-y-auto bg-[#111118] border border-[#1e1e2e] rounded-lg shadow-xl z-50"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e1e2e]">
        <span className="text-xs font-mono text-[#666680]">Alert History</span>
        <button onClick={onClose} className="text-[#666680] hover:text-[#e8e8f0]">✕</button>
      </div>
      {history.length === 0 ? (
        <div className="px-4 py-6 text-center text-[10px] font-mono text-[#333350]">
          No alerts in history
        </div>
      ) : (
        <div className="p-2 space-y-1">
          {history.map((alert) => (
            <div 
              key={alert.id}
              className={`px-3 py-2 rounded text-[10px] font-mono ${alert.acknowledged ? 'opacity-50' : ''} ${alert.color === 'red' ? 'bg-[#2a0a0a] border-l-2 border-[#ff4466]' : 'bg-[#2a1a00] border-l-2 border-[#ffaa00]'}`}
            >
              <div className="flex items-center justify-between">
                <span className={alert.color === 'red' ? 'text-[#ff4466]' : 'text-[#ffaa00]'}>
                  {alert.message.slice(0, 50)}...
                </span>
                <span className="text-[8px] text-[#666680]">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {alert.snoozedUntil && (
                <div className="text-[8px] text-[#666680] mt-1">
                  Snoozed until {new Date(alert.snoozedUntil).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function RiskAlertBanner() {
  const alerts = useRiskGuards();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { snoozeAlert, getAlertHistory, clearOldAlerts } = useAlertStore();

  const visible = alerts.filter(a => !dismissed.has(a.type));
  const topAlert = visible[0];
  const alertHistory = getAlertHistory(20);

  useEffect(() => {
    const interval = setInterval(clearOldAlerts, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [clearOldAlerts]);

  useEffect(() => {
    if (alerts.length > 0) {
      setDismissed(prev => {
        const next = new Set(prev);
        const activeTypes = new Set(alerts.map(a => a.type));
        Array.from(prev).forEach(type => {
          if (!activeTypes.has(type as any)) next.delete(type);
        });
        return next;
      });
    }
  }, [alerts.map(a => a.type).join(',')]);

  if (!topAlert) return null;

  const isRed = topAlert.color === 'red';
  const bgClass = isRed ? 'bg-[#2a0a0a] border-b border-[#ff4466] text-[#ff4466]' : 'bg-[#2a1a00] border-b border-[#ffaa00] text-[#ffaa00]';
  const snoozeClass = isRed ? 'border-[#ff4466] text-[#ff4466]' : 'border-[#ffaa00] text-[#ffaa00]';
  const historyClass = isRed ? 'text-[#ff4466]' : 'text-[#ffaa00]';
  const dismissClass = isRed ? 'text-[#ff4466]' : 'text-[#ffaa00]';
  const badgeClass = isRed ? 'bg-[#ff4466]/33 text-[#ff4466]' : 'bg-[#ffaa00]/33 text-[#ffaa00]';

  return (
    <AnimatePresence>
      <motion.div
        key={topAlert.type}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`relative z-50 flex items-center justify-between px-4 py-2 text-xs font-mono ${bgClass}`}
      >
        <div className="flex items-center gap-3">
          {visible.length > 1 && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${badgeClass}`}>
              {visible.length} ALERTS
            </span>
          )}
          <span>{topAlert.message}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
              className={`px-2 py-0.5 text-[10px] rounded border opacity-60 hover:opacity-100 transition-opacity ${snoozeClass}`}
            >
              Snooze v
            </button>
            {showSnoozeMenu && (
              <div className="absolute top-full right-0 mt-1 bg-[#111118] border border-[#1e1e2e] rounded shadow-lg z-50">
                {SNOOZE_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => {
                      snoozeAlert(topAlert.type, option.minutes);
                      setDismissed(d => new Set(Array.from(d).concat(topAlert.type)));
                      setShowSnoozeMenu(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-[10px] font-mono text-[#e8e8f0] hover:bg-[#1e1e2e] first:rounded-t last:rounded-b"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`text-[10px] opacity-60 hover:opacity-100 transition-opacity ${historyClass}`}
          >
            History
          </button>
          <button
            onClick={() => setDismissed(d => new Set(Array.from(d).concat(topAlert.type)))}
            className={`text-lg leading-none opacity-60 hover:opacity-100 transition-opacity ${dismissClass}`}
          >
            ✕
          </button>
        </div>
        {showHistory && (
          <AlertHistoryPanel 
            onClose={() => setShowHistory(false)} 
            history={alertHistory}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
