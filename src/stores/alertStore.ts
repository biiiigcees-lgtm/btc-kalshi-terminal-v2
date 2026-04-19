// /src/stores/alertStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AlertRecord {
  id: string;
  type: string;
  message: string;
  color: 'red' | 'amber';
  timestamp: number;
  acknowledged: boolean;
  snoozedUntil: number | null;
}

interface AlertStore {
  alertHistory: AlertRecord[];
  snoozedAlerts: Record<string, number>; // alertType -> snoozedUntil timestamp
  acknowledgeAlert: (alertId: string) => void;
  snoozeAlert: (alertType: string, durationMinutes: number) => void;
  isSnoozed: (alertType: string) => boolean;
  clearOldAlerts: () => void;
  getAlertHistory: (limit?: number) => AlertRecord[];
  addAlertToHistory: (alert: Omit<AlertRecord, 'id' | 'timestamp' | 'acknowledged' | 'snoozedUntil'>) => void;
}

export const useAlertStore = create<AlertStore>()(
  persist(
    (set, get) => ({
      alertHistory: [],
      snoozedAlerts: {},

      acknowledgeAlert: (alertId) => {
        set((state) => ({
          alertHistory: state.alertHistory.map((alert) =>
            alert.id === alertId ? { ...alert, acknowledged: true } : alert
          ),
        }));
      },

      snoozeAlert: (alertType, durationMinutes) => {
        const snoozedUntil = Date.now() + durationMinutes * 60 * 1000;
        set((state) => ({
          snoozedAlerts: {
            ...state.snoozedAlerts,
            [alertType]: snoozedUntil,
          },
        }));
      },

      isSnoozed: (alertType) => {
        const snoozedUntil = get().snoozedAlerts[alertType];
        if (!snoozedUntil) return false;
        return Date.now() < snoozedUntil;
      },

      clearOldAlerts: () => {
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        set((state) => ({
          alertHistory: state.alertHistory.filter((alert) => alert.timestamp > oneWeekAgo),
          snoozedAlerts: Object.fromEntries(
            Object.entries(state.snoozedAlerts).filter(([, until]) => until > Date.now())
          ),
        }));
      },

      getAlertHistory: (limit = 50) => {
        return get()
          .alertHistory.slice()
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      },

      addAlertToHistory: (alert) => {
        const newAlert: AlertRecord = {
          ...alert,
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          acknowledged: false,
          snoozedUntil: null,
        };
        set((state) => ({
          alertHistory: [newAlert, ...state.alertHistory].slice(0, 100), // Keep last 100
        }));
      },
    }),
    {
      name: 'btc-terminal-alerts',
    }
  )
);
