'use client';
import dynamic from 'next/dynamic';
import TopBar from '@/components/TopBar';
import RiskAlertBanner from '@/components/RiskAlertBanner';
import CountdownTimer from '@/components/CountdownTimer';
import SignalDashboard from '@/components/SignalDashboard';
import EnsembleGauges from '@/components/EnsembleGauges';
import PositionSizingPanel from '@/components/PositionSizingPanel';
import PaperTradingPanel from '@/components/PaperTradingPanel';
import TradeLog from '@/components/TradeLog';
import RecommendationCard from '@/components/terminal/RecommendationCard';
import KalshiMarketPanel from '@/components/terminal/KalshiMarketPanel';
import SignalHistory from '@/components/terminal/SignalHistory';
import SettingsPanel from '@/components/terminal/SettingsPanel';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import { useTerminalEngine } from '@/hooks/useTerminalEngine';
import { useTerminalStore } from '@/stores/terminalStore';

const BTCChart = dynamic(() => import('@/components/BTCChart'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-[#1e1e2e] text-xs font-mono tracking-widest">
      LOADING CHART...
    </div>
  ),
});

function Label({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1 flex-shrink-0">
      <div className="w-1 h-1 rounded-full" style={{ background: color }} />
      <span className="text-[8px] font-mono uppercase tracking-[0.25em]" style={{ color: '#2a2a3a' }}>{text}</span>
    </div>
  );
}

function Panel({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`bg-[#08080f] border border-[#141420] rounded overflow-hidden ${className}`} style={style}>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { recompute } = useSignalEngine();
  useBinanceWebSocket(recompute);
  useTerminalEngine();

  const { terminalSignal } = useTerminalStore();

  return (
    <div className="flex flex-col bg-[#050508] min-h-screen text-[#e8e8f0]">
      <RiskAlertBanner />
      <div className="flex-shrink-0"><TopBar /></div>

      {/* ── MOBILE ── */}
      <div className="lg:hidden flex flex-col gap-2 p-2 pb-10">
        {/* Decision card */}
        <Label color="#00ff88" text="AI DECISION" />
        <Panel className="h-[280px]"><RecommendationCard signal={terminalSignal} /></Panel>

        {/* Chart */}
        <Label color="#4488ff" text="BTC/USD" />
        <Panel className="h-[200px]"><BTCChart /></Panel>

        {/* Kalshi */}
        <Label color="#ffaa00" text="KALSHI MARKET" />
        <Panel className="h-[240px]"><KalshiMarketPanel /></Panel>

        {/* Signals */}
        <Label color="#4488ff" text="SIGNALS" />
        <Panel className="h-[260px]"><SignalDashboard /></Panel>

        {/* Execution */}
        <Label color="#ff4466" text="EXECUTION" />
        <Panel className="h-[300px]"><PaperTradingPanel /></Panel>

        {/* History */}
        <Label color="#8888aa" text="SIGNAL HISTORY" />
        <Panel className="h-[200px]"><SignalHistory /></Panel>

        {/* Settings */}
        <Label color="#555570" text="SETTINGS" />
        <Panel><SettingsPanel /></Panel>
      </div>

      {/* ── DESKTOP: 3-PANEL TERMINAL ── */}
      <div
        className="hidden lg:flex flex-col flex-1 overflow-hidden p-1.5 gap-1.5"
        style={{ height: 'calc(100vh - 52px)' }}
      >
        {/* MAIN ROW: Left (Decision) | Center (Chart) | Right (Kalshi) */}
        <div className="flex gap-1.5 flex-1 min-h-0">

          {/* LEFT PANEL: Decision + Ensemble */}
          <div className="flex flex-col gap-1.5 flex-shrink-0" style={{ width: '300px' }}>
            {/* Decision card - dominant */}
            <div className="flex flex-col flex-1 min-h-0">
              <Label color="#00ff88" text="AI DECISION" />
              <Panel className="flex-1 min-h-0 overflow-hidden">
                <RecommendationCard signal={terminalSignal} />
              </Panel>
            </div>
            {/* Compact ensemble strip */}
            <div className="flex flex-col flex-shrink-0" style={{ height: '120px' }}>
              <Label color="#4488ff" text="ENSEMBLE" />
              <Panel className="flex-1 min-h-0 overflow-hidden">
                <EnsembleGauges />
              </Panel>
            </div>
          </div>

          {/* CENTER PANEL: Chart + Indicators */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {/* Chart */}
            <div className="flex flex-col flex-1 min-h-0">
              <Label color="#4488ff" text="BTC/USD — LIVE" />
              <Panel className="flex-1 min-h-0">
                <BTCChart />
              </Panel>
            </div>
            {/* Signal dashboard strip */}
            <div className="flex flex-col flex-shrink-0" style={{ height: '140px' }}>
              <Label color="#4488ff" text="INDICATORS" />
              <Panel className="flex-1 min-h-0 overflow-hidden">
                <SignalDashboard />
              </Panel>
            </div>
          </div>

          {/* RIGHT PANEL: Kalshi + Position */}
          <div className="flex flex-col gap-1.5 flex-shrink-0" style={{ width: '280px' }}>
            {/* Kalshi market */}
            <div className="flex flex-col flex-1 min-h-0">
              <Label color="#ffaa00" text="KALSHI MARKET" />
              <Panel className="flex-1 min-h-0 overflow-hidden">
                <KalshiMarketPanel />
              </Panel>
            </div>
            {/* Position sizing */}
            <div className="flex flex-col flex-shrink-0" style={{ height: '180px' }}>
              <Label color="#ff66cc" text="POSITION" />
              <Panel className="flex-1 min-h-0 overflow-hidden">
                <PositionSizingPanel />
              </Panel>
            </div>
          </div>
        </div>

        {/* LOWER ROW: History + Execution + Settings */}
        <div className="flex gap-1.5 flex-shrink-0" style={{ height: '160px' }}>
          {/* Signal history */}
          <div className="flex flex-col" style={{ width: '300px' }}>
            <Label color="#8888aa" text="SIGNAL HISTORY" />
            <Panel className="flex-1 min-h-0 overflow-hidden">
              <SignalHistory />
            </Panel>
          </div>

          {/* Execution */}
          <div className="flex flex-col flex-1 min-w-0">
            <Label color="#ff4466" text="EXECUTION" />
            <Panel className="flex-1 min-h-0 overflow-hidden">
              <PaperTradingPanel />
            </Panel>
          </div>

          {/* Countdown + Settings */}
          <div className="flex flex-col gap-1.5 flex-shrink-0" style={{ width: '280px' }}>
            <Panel className="flex-shrink-0 overflow-hidden" style={{ height: '50px' }}>
              <CountdownTimer />
            </Panel>
            <Panel className="flex-1 min-h-0 overflow-hidden overflow-y-auto">
              <SettingsPanel />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
