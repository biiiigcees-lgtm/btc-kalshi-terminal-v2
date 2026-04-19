// /src/components/EnsembleGauges.tsx
'use client';
import GaugeChart from './GaugeChart';
import { useSignalStore } from '@/stores/signalStore';
import { useKalshiStore } from '@/stores/kalshiStore';

const GAUGE1_ZONES = [
  { min: 0, max: 40, color: '#ff4466' },
  { min: 40, max: 50, color: '#ffaa00' },
  { min: 50, max: 60, color: '#00cc66' },
  { min: 60, max: 100, color: '#00ff88' },
];

const GAUGE2_ZONES = [
  { min: 0, max: 40, color: '#ff4466' },
  { min: 40, max: 55, color: '#ffaa00' },
  { min: 55, max: 70, color: '#00cc66' },
  { min: 70, max: 100, color: '#00ff88' },
];

function getDirective(prob: number, ev: number): { text: string; color: string } {
  if (ev <= 0) return { text: 'NO TRADE', color: '#666680' };
  if (prob >= 55) return { text: 'BET UP', color: '#00ff88' };
  if (prob <= 45) return { text: 'BET DOWN', color: '#ff4466' };
  return { text: 'NO TRADE', color: '#666680' };
}

function getVolatilityColor(volatility: string): string {
  if (volatility === 'high') return 'text-[#ff4466]';
  if (volatility === 'low') return 'text-[#4488ff]';
  return 'text-[#666680]';
}

export default function EnsembleGauges() {
  const { ensembleProbability, regime } = useSignalStore();
  const { expectedValue, edge } = useKalshiStore();

  const directive = getDirective(ensembleProbability, expectedValue);

  // Gauge 2 shows edge-adjusted view: blends ensemble with EV signal
  const evAdjusted = Math.min(100, Math.max(0, ensembleProbability + (expectedValue > 0 ? 3 : -3)));

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-3 h-full">
      <div className="grid grid-cols-2 gap-4 w-full">
        <GaugeChart
          value={ensembleProbability}
          title="Ensemble Probability"
          zones={GAUGE1_ZONES}
        />
        <GaugeChart
          value={evAdjusted}
          title="EV-Adjusted Signal"
          zones={GAUGE2_ZONES}
          directive={directive.text}
          directiveColor={directive.color}
        />
      </div>

      {/* Regime badge */}
      <div className="flex gap-2 mt-1">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#1e1e2e] text-[#666680]">
          {regime.trend.toUpperCase()}
        </span>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded border border-[#1e1e2e] ${getVolatilityColor(regime.volatility)}`}
        >
          {regime.volatility.toUpperCase()} VOL
        </span>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded border border-[#1e1e2e] ${edge > 0 ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}
        >
          EDGE {edge > 0 ? '+' : ''}{edge.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
