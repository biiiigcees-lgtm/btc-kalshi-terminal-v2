// /src/components/terminal/SignalHistory.tsx — Recent decision history
'use client';
import { useTerminalStore } from '@/stores/terminalStore';
import type { TerminalDecision } from '@/types';

const DECISION_COLORS: Record<TerminalDecision, string> = {
  BUY_YES: '#00ff88',
  BUY_NO: '#ff4466',
  WAIT: '#ffaa00',
  REDUCE_EXPOSURE: '#ff66cc',
};

const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
};

export default function SignalHistory() {
  const { signalHistory } = useTerminalStore();
  const recent = signalHistory.slice(0, 20);

  if (recent.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[9px] font-mono text-[#2a2a3a]">
        No signal history yet
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-[#141420] flex-shrink-0">
        <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider flex-1">Decision</span>
        <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider w-10 text-center">Conf</span>
        <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider w-10 text-center">Quality</span>
        <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider w-12 text-right">Time</span>
      </div>

      {/* Rows */}
      {recent.map((s, i) => {
        const color = DECISION_COLORS[s.decision];
        const isFlipped = s.decisionFlipped;
        return (
          <div
            key={s.timestamp + '-' + i}
            className="flex items-center gap-2 px-2 py-1 border-b border-[#0d0d14] hover:bg-[#0a0a14] transition-colors"
          >
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {isFlipped && <span className="text-[7px] text-[#ffaa00]">↻</span>}
              <span className="text-[9px] font-mono font-bold truncate" style={{ color }}>
                {s.decision.replace('_', ' ')}
              </span>
            </div>
            <span className="text-[9px] font-mono w-10 text-center" style={{ color }}>
              {s.confidence}
            </span>
            <span className="text-[8px] font-mono w-10 text-center text-[#555570]">
              {s.tradeQuality}
            </span>
            <span className="text-[8px] font-mono text-[#3a3a50] w-12 text-right">
              {timeAgo(s.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
