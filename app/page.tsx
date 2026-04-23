'use client';
import dynamic from 'next/dynamic';
import TopBar from '@/components/TopBar';
import RiskAlertBanner from '@/components/RiskAlertBanner';
import CountdownTimer from '@/components/CountdownTimer';
import SignalDashboard from '@/components/SignalDashboard';
import EnsembleGauges from '@/components/EnsembleGauges';
import PositionSizingPanel from '@/components/PositionSizingPanel';
import ErrorBoundaryWrapper from '@/components/ErrorBoundaryWrapper';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import { PriceSkeleton } from '@/components/LoadingSkeleton';

const BTCChart = dynamic(() => import('@/components/BTCChart'), {
  ssr: false,
  loading: () => <PriceSkeleton />,
});

const PaperTradingPanel = dynamic(() => import('@/components/PaperTradingPanel'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-[#333350] text-xs font-mono">Loading...</div>,
});

const AIAdvisor = dynamic(() => import('@/components/AIAdvisor'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-[#333350] text-xs font-mono">Loading AI...</div>,
});

const TradeLog = dynamic(() => import('@/components/TradeLog'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-[#333350] text-xs font-mono">Loading trades...</div>,
});

function SectionLabel({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-1 flex-shrink-0">
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-[9px] font-mono text-[#444460] uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0d0d14] border border-[#1a1a2a] rounded-md overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function Dashboard() {
  const { recompute } = useSignalEngine();
  useBinanceWebSocket(recompute);

  return (
    <div className="flex flex-col bg-[#070710] min-h-screen">
      {/* Risk alerts float at top */}
      <RiskAlertBanner />

      {/* Top bar — always visible */}
      <div className="flex-shrink-0">
        <TopBar />
      </div>

      {/* ═══════════════════════════════════════
          MOBILE LAYOUT (< lg)
          Single column, scrollable, logical order
          ═══════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col gap-3 p-3 pb-8">

        {/* SENSORY — Chart */}
        <div>
          <SectionLabel color="#00ff88" label="SENSORY" />
          <Panel className="h-[260px]">
            <ErrorBoundaryWrapper>
              <BTCChart />
            </ErrorBoundaryWrapper>
          </Panel>
        </div>

        {/* TEMPORAL — Countdown + Inputs */}
        <div>
          <SectionLabel color="#ffaa00" label="TEMPORAL" />
          <Panel>
            <ErrorBoundaryWrapper>
              <CountdownTimer />
            </ErrorBoundaryWrapper>
          </Panel>
        </div>

        {/* ANALYSIS — Signals + Gauges stacked */}
        <div>
          <SectionLabel color="#4488ff" label="ANALYSIS" />
          <div className="flex flex-col gap-2">
            <Panel className="h-[340px]">
              <ErrorBoundaryWrapper>
                <SignalDashboard />
              </ErrorBoundaryWrapper>
            </Panel>
            <Panel className="h-[220px]">
              <ErrorBoundaryWrapper>
                <EnsembleGauges />
              </ErrorBoundaryWrapper>
            </Panel>
          </div>
        </div>

        {/* DECISION — Position sizing */}
        <div>
          <SectionLabel color="#ff66cc" label="DECISION" />
          <Panel>
            <ErrorBoundaryWrapper>
              <PositionSizingPanel />
            </ErrorBoundaryWrapper>
          </Panel>
        </div>

        {/* AI ADVISOR */}
        <div>
          <SectionLabel color="#aa44ff" label="AI ADVISOR" />
          <Panel className="h-[320px]">
            <ErrorBoundaryWrapper>
              <AIAdvisor />
            </ErrorBoundaryWrapper>
          </Panel>
        </div>

        {/* EXECUTION — Paper trading */}
        <div>
          <SectionLabel color="#ff4466" label="EXECUTION" />
          <Panel className="h-[360px]">
            <ErrorBoundaryWrapper>
              <PaperTradingPanel />
            </ErrorBoundaryWrapper>
          </Panel>
        </div>

        {/* MEMORY — Trade log */}
        <div>
          <SectionLabel color="#8888aa" label="MEMORY" />
          <Panel className="h-[400px]">
            <TradeLog />
          </Panel>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          DESKTOP LAYOUT (>= lg)
          Fixed height viewport, 3-column grid
          No overflow, no overlap
          ═══════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col flex-1 overflow-hidden"
        style={{ height: 'calc(100vh - 57px)' }}
      >
        {/* Main 3-column area */}
        <div className="flex flex-1 gap-2 p-2 overflow-hidden min-h-0">

          {/* ── COLUMN 1: Temporal + Sensory ── */}
          <div className="flex flex-col gap-2 overflow-hidden" style={{ width: '260px', flexShrink: 0 }}>
            <div className="flex flex-col gap-1 flex-shrink-0">
              <SectionLabel color="#ffaa00" label="TEMPORAL" />
              <Panel>
                <ErrorBoundaryWrapper>
                  <CountdownTimer />
                </ErrorBoundaryWrapper>
              </Panel>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-h-0">
              <SectionLabel color="#00ff88" label="SENSORY" />
              <Panel className="flex-1 min-h-0">
                <ErrorBoundaryWrapper>
                  <BTCChart />
                </ErrorBoundaryWrapper>
              </Panel>
            </div>
          </div>

          {/* ── COLUMN 2: Analysis + Decision + AI ── */}
          <div className="flex flex-col gap-2 flex-1 min-w-0 overflow-hidden">

            {/* Analysis row */}
            <div className="flex flex-col gap-1 flex-shrink-0">
              <SectionLabel color="#4488ff" label="ANALYSIS" />
              <div className="grid grid-cols-2 gap-2" style={{ height: '240px' }}>
                <Panel>
                  <ErrorBoundaryWrapper>
                    <SignalDashboard />
                  </ErrorBoundaryWrapper>
                </Panel>
                <Panel>
                  <ErrorBoundaryWrapper>
                    <EnsembleGauges />
                  </ErrorBoundaryWrapper>
                </Panel>
              </div>
            </div>

            {/* Decision row */}
            <div className="flex flex-col gap-1 flex-shrink-0">
              <SectionLabel color="#ff66cc" label="DECISION" />
              <Panel>
                <ErrorBoundaryWrapper>
                  <PositionSizingPanel />
                </ErrorBoundaryWrapper>
              </Panel>
            </div>

            {/* AI Advisor */}
            <div className="flex flex-col gap-1 flex-1 min-h-0">
              <SectionLabel color="#aa44ff" label="AI ADVISOR" />
              <Panel className="flex-1 min-h-0">
                <ErrorBoundaryWrapper>
                  <AIAdvisor />
                </ErrorBoundaryWrapper>
              </Panel>
            </div>
          </div>

          {/* ── COLUMN 3: Execution ── */}
          <div className="flex flex-col gap-2 overflow-hidden" style={{ width: '280px', flexShrink: 0 }}>
            <div className="flex flex-col gap-1 flex-1 min-h-0">
              <SectionLabel color="#ff4466" label="EXECUTION" />
              <Panel className="flex-1 min-h-0">
                <ErrorBoundaryWrapper>
                  <PaperTradingPanel />
                </ErrorBoundaryWrapper>
              </Panel>
            </div>
          </div>
        </div>

        {/* ── BOTTOM ROW: Memory / Trade Log ── */}
        <div className="flex flex-col gap-1 px-2 pb-2 flex-shrink-0" style={{ height: '200px' }}>
          <SectionLabel color="#8888aa" label="MEMORY & LEARNING" />
          <Panel className="flex-1 min-h-0">
            <ErrorBoundaryWrapper>
              <TradeLog />
            </ErrorBoundaryWrapper>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
