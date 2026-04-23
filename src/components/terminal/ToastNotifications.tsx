// /src/components/terminal/ToastNotifications.tsx — Alert toasts for flips and regime changes
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTerminalStore } from '@/stores/terminalStore';
import { useSignalStore } from '@/stores/signalStore';

interface Toast {
  id: string;
  type: 'decision_flip' | 'regime_change';
  message: string;
  color: string;
}

export default function ToastNotifications() {
  const { lastDecisionFlip } = useTerminalStore();
  const { regime } = useSignalStore();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastRegime, setLastRegime] = useState(regime.trend);

  useEffect(() => {
    if (lastDecisionFlip) {
      const toast: Toast = {
        id: `flip-${lastDecisionFlip}`,
        type: 'decision_flip',
        message: 'Decision flipped — review new signal',
        color: '#ffaa00',
      };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    }
  }, [lastDecisionFlip]);

  useEffect(() => {
    if (regime.trend !== lastRegime) {
      const toast: Toast = {
        id: `regime-${Date.now()}`,
        type: 'regime_change',
        message: `Regime changed to ${regime.trend.toUpperCase()}`,
        color: '#4488ff',
      };
      setToasts((prev) => [...prev, toast]);
      setLastRegime(regime.trend);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    }
  }, [regime.trend, lastRegime]);

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-auto bg-[#0a0a12] border rounded px-3 py-2 shadow-lg"
            style={{ borderColor: `${toast.color}44` }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: toast.color }} />
              <span className="text-[10px] font-mono" style={{ color: toast.color }}>
                {toast.message}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
