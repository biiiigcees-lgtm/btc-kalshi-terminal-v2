'use client';
import TopBar from '@/components/TopBar';
import RiskAlertBanner from '@/components/RiskAlertBanner';
import CountdownTimer from '@/components/CountdownTimer';
import SignalDashboard from '@/components/SignalDashboard';
import EnsembleGauges from '@/components/EnsembleGauges';
import PositionSizingPanel from '@/components/PositionSizingPanel';
import PaperTradingPanel from '@/components/PaperTradingPanel';
import AIAdvisor from '@/components/AIAdvisor';
import TradeLog from '@/components/TradeLog';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import { useSignalEngine } from '@/hooks/useSignalEngine';

function Label({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1 flex-shrink-0">
      <div className="w-1 h-1 rounded-full" style={{ background: color }} />
      <span className="text-[8px] font-mono uppercase tracking-[0.25em]" style={{ color: '#2a2a3a' }}>{text}</span>
    </div>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#08080f] border border-[#141420] rounded overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { recompute } = useSignalEngine();
  useBinanceWebSocket(recompute);

  return (
    <div className="flex flex-col bg-[#050508] min-h-screen text-[#e8e8f0]">
      <RiskAlertBanner />
      <div className="flex-shrink-0"><TopBar /></div>

      {/* ── MOBILE ── */}
      <div className="lg:hidden flex flex-col gap-2 p-2 pb-10">
        <Label color="#ffaa00" text="TEMPORAL" />
        <Panel><CountdownTimer /></Panel>

        <Label color="#4488ff" text="ANALYSIS" />
        <Panel className="h-[320px]"><SignalDashboard /></Panel>
        <Panel className="h-[200px]"><EnsembleGauges /></Panel>

        <Label color="#aa44ff" text="AI INTELLIGENCE" />
        <Panel className="h-[400px]"><AIAdvisor /></Panel>

        <Label color="#ff66cc" text="DECISION" />
        <Panel><PositionSizingPanel /></Panel>

        <Label color="#ff4466" text="EXECUTION" />
        <Panel className="h-[340px]"><PaperTradingPanel /></Panel>

        <Label color="#8888aa" text="MEMORY" />
        <Panel className="h-[380px]"><TradeLog /></Panel>
      </div>

      {/* ── DESKTOP ── */}
      <div
        className="hidden lg:flex flex-col flex-1 overflow-hidden gap-1.5 p-1.5"
        style={{ height: 'calc(100vh - 52px)' }}
      >
        {/* ROW 1: Countdown + AI */}
        <div className="flex gap-1.5 flex-shrink-0" style={{ height: '42%' }}>
          {/* Countdown — narrow column */}
          <div className="flex flex-col flex-shrink-0" style={{ width: '200px' }}>
            <Label color="#ffaa00" text="TEMPORAL" />
            <Panel className="flex-1"><CountdownTimer /></Panel>
          </div>

          {/* AI Advisor — key panel, always visible */}
          <div className="flex flex-col flex-1 min-w-0">
            <Label color="#aa44ff" text="AI INTELLIGENCE" />
            <Panel className="flex-1 min-h-0"><AIAdvisor /></Panel>
          </div>
        </div>

        {/* ROW 2: Signals + Gauges + Decision + Execution */}
        <div className="flex gap-1.5 flex-1 min-h-0 overflow-hidden">
          {/* Signals */}
          <div className="flex flex-col min-w-0" style={{ width: '280px', flexShrink: 0 }}>
            <Label color="#4488ff" text="ANALYSIS" />
            <Panel className="flex-1 min-h-0"><SignalDashboard /></Panel>
          </div>

          {/* Gauges */}
          <div className="flex flex-col flex-shrink-0" style={{ width: '220px' }}>
            <Label color="#4488ff" text="ENSEMBLE" />
            <Panel className="flex-1 min-h-0"><EnsembleGauges /></Panel>
          </div>

          {/* Decision */}
          <div className="flex flex-col flex-shrink-0" style={{ width: '280px' }}>
            <Label color="#ff66cc" text="DECISION" />
            <Panel className="flex-1 min-h-0"><PositionSizingPanel /></Panel>
          </div>

          {/* Execution */}
          <div className="flex flex-col flex-1 min-w-0">
            <Label color="#ff4466" text="EXECUTION" />
            <Panel className="flex-1 min-h-0"><PaperTradingPanel /></Panel>
          </div>
        </div>

        {/* ROW 3: Trade log — compact bottom strip */}
        <div className="flex flex-col flex-shrink-0" style={{ height: '160px' }}>
          <Label color="#8888aa" text="MEMORY & LEARNING" />
          <Panel className="flex-1 min-h-0"><TradeLog /></Panel>
        </div>
      </div>
    </div>
  );
}
