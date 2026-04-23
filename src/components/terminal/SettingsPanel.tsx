// /src/components/terminal/SettingsPanel.tsx — Terminal settings
'use client';
import { useTerminalStore } from '@/stores/terminalStore';
import type { AggressivenessLevel } from '@/types';

const AGGRO_CONFIG: Record<AggressivenessLevel, { label: string; desc: string; color: string }> = {
  conservative: { label: 'CONSERVATIVE', desc: 'Higher confidence thresholds, fewer signals', color: '#4488ff' },
  moderate: { label: 'MODERATE', desc: 'Balanced approach, standard thresholds', color: '#ffaa00' },
  aggressive: { label: 'AGGRESSIVE', desc: 'Lower thresholds, more signals, higher risk', color: '#ff4466' },
};

export default function SettingsPanel() {
  const { settings, updateSettings } = useTerminalStore();

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Aggressiveness */}
      <div>
        <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-2">Aggressiveness</div>
        <div className="flex gap-1">
          {(Object.keys(AGGRO_CONFIG) as AggressivenessLevel[]).map((level) => {
            const cfg = AGGRO_CONFIG[level];
            const active = settings.aggressiveness === level;
            return (
              <button
                key={level}
                onClick={() => updateSettings({ aggressiveness: level })}
                className="flex-1 px-2 py-1.5 rounded text-[8px] font-mono font-bold border transition-all"
                style={{
                  color: active ? cfg.color : '#3a3a50',
                  borderColor: active ? `${cfg.color}66` : '#141420',
                  background: active ? `${cfg.color}12` : '#08080f',
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
        <div className="text-[8px] font-mono text-[#3a3a50] mt-1">
          {AGGRO_CONFIG[settings.aggressiveness].desc}
        </div>
      </div>

      {/* Alert threshold */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider">Alert Threshold</span>
          <span className="text-[9px] font-mono text-[#8888aa]">{settings.alertThreshold}</span>
        </div>
        <input
          type="range"
          min={40}
          max={95}
          value={settings.alertThreshold}
          onChange={(e) => updateSettings({ alertThreshold: Number(e.target.value) })}
          title="Alert confidence threshold"
          className="w-full h-1 appearance-none bg-[#1a1a2a] rounded-full accent-[#ffaa00]"
        />
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showExplainability}
            onChange={(e) => updateSettings({ showExplainability: e.target.checked })}
            className="accent-[#4488ff]"
          />
          <span className="text-[9px] font-mono text-[#8888aa]">Show Explainability</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.compactMode}
            onChange={(e) => updateSettings({ compactMode: e.target.checked })}
            className="accent-[#4488ff]"
          />
          <span className="text-[9px] font-mono text-[#8888aa]">Compact Mode</span>
        </label>
      </div>
    </div>
  );
}
