// /app/page.tsx
'use client';
import dynamic from 'next/dynamic';
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

// Dynamically import chart to avoid SSR issues with lightweight-charts
const BTCChart = dynamic(() => import('@/components/BTCChart'), { ssr: false });

function Dashboard() {
  const { recompute } = useSignalEngine();
  useBinanceWebSocket(recompute);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0a0f] mobile-dashboard">
      {/* Risk Alert Banner — floats above everything */}
      <RiskAlertBanner />

      {/* TOP BAR */}
      <TopBar />

      {/* MOBILE LAYOUT - Biological Grouping */}
      <div className="mobile-layout flex-1 overflow-y-auto lg:hidden">
        <div className="p-2 space-y-3">
          
          {/* GROUP 1: SENSORY - Market Perception */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-[#00ff88]" />
              <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest">SENSORY</span>
            </div>
            <div className="panel p-3">
              <TopBar />
            </div>
            <div className="panel overflow-hidden h-[300px]">
              <BTCChart />
            </div>
          </div>

          {/* GROUP 2: TEMPORAL - Time Awareness */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-[#ffaa00]" />
              <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest">TEMPORAL</span>
            </div>
            <div className="panel p-2">
              <CountdownTimer />
            </div>
          </div>
          
          {/* GROUP 3: ANALYSIS - Pattern Recognition */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-[#4488ff]" />
              <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest">ANALYSIS</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="panel p-2 h-[180px]">
                <SignalDashboard />
              </div>
              <div className="panel p-2 h-[180px]">
                <EnsembleGauges />
              </div>
            </div>
          </div>
          
          {/* GROUP 4: DECISION - Risk Assessment */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-[#ff66cc]" />
              <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest">DECISION</span>
            </div>
            <div className="panel p-2">
              <PositionSizingPanel />
            </div>
            <div className="panel p-2 h-[180px]">
              <AIAdvisor />
            </div>
          </div>
          
          {/* GROUP 5: EXECUTION - Action Center */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-[#ff4466]" />
              <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest">EXECUTION</span>
            </div>
            <div className="panel p-2 h-[280px]">
              <PaperTradingPanel />
            </div>
          </div>
          
          {/* GROUP 6: MEMORY - Learning & History */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-[#8888aa]" />
              <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest">MEMORY</span>
            </div>
            <div className="panel p-2 h-[200px]">
              <TradeLog />
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP LAYOUT - Biological Functional Zones */}
      <div
        className="hidden lg:grid flex-1 overflow-hidden desktop-layout p-[6px] gap-[6px]"
        style={{
          gridTemplateColumns: '240px 1fr 280px',
          gridTemplateRows: '1fr 1fr 200px',
        }}
      >
        {/* ═══════════════════════════════════════════════════════════
           COLUMN 1: SENSORY & TEMPORAL (Left - Time & Market Awareness)
           ═══════════════════════════════════════════════════════════ */}
        <div
          className="overflow-hidden flex flex-col gap-[6px]"
          style={{
            gridColumn: '1',
            gridRow: '1 / 2',
          }}
        >
          {/* Temporal Group */}
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-[#ffaa00]" />
            <span className="text-[9px] font-display text-[#666680] uppercase tracking-widest">TEMPORAL</span>
          </div>
          <div className="panel overflow-hidden flex-shrink-0 h-[140px]">
            <CountdownTimer />
          </div>
          
          {/* Sensory Group */}
          <div className="flex items-center gap-2 px-1 mt-2">
            <div className="w-2 h-2 rounded-full bg-[#00ff88]" />
            <span className="text-[9px] font-display text-[#666680] uppercase tracking-widest">SENSORY</span>
          </div>
          <div className="panel overflow-hidden flex-1 min-h-[200px]">
            <div className="h-full">
              <BTCChart />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
           COLUMN 2: ANALYSIS & DECISION (Center - Cognitive Processing)
           ═══════════════════════════════════════════════════════════ */}
        <div
          className="overflow-hidden flex flex-col gap-[6px]"
          style={{
            gridColumn: '2',
            gridRow: '1 / 3',
          }}
        >
          {/* Analysis Group */}
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-[#4488ff]" />
            <span className="text-[9px] font-display text-[#666680] uppercase tracking-widest">ANALYSIS</span>
          </div>
          <div 
            className="overflow-hidden grid grid-cols-2 gap-[6px] h-[200px]"
          >
            <div className="panel overflow-hidden">
              <SignalDashboard />
            </div>
            <div className="panel overflow-hidden">
              <EnsembleGauges />
            </div>
          </div>

          {/* Decision Group */}
          <div className="flex items-center gap-2 px-1 mt-1">
            <div className="w-2 h-2 rounded-full bg-[#ff66cc]" />
            <span className="text-[9px] font-display text-[#666680] uppercase tracking-widest">DECISION</span>
          </div>
          <div className="panel overflow-hidden flex-shrink-0 h-[80px]">
            <PositionSizingPanel />
          </div>
          
          <div className="panel overflow-hidden flex-1 min-h-[150px]">
            <AIAdvisor />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
           COLUMN 3: EXECUTION (Right - Action & Motor)
           ═══════════════════════════════════════════════════════════ */}
        <div
          className="overflow-hidden flex flex-col gap-[6px]"
          style={{
            gridColumn: '3',
            gridRow: '1 / 3',
          }}
        >
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-[#ff4466]" />
            <span className="text-[9px] font-display text-[#666680] uppercase tracking-widest">EXECUTION</span>
          </div>
          <div className="panel overflow-hidden flex-1">
            <PaperTradingPanel />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
           ROW 3: MEMORY (Bottom - Full Width Learning Center)
           ═══════════════════════════════════════════════════════════ */}
        <div
          className="overflow-hidden flex flex-col gap-[6px]"
          style={{
            gridColumn: '1 / 4',
            gridRow: '3',
          }}
        >
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-[#8888aa]" />
            <span className="text-[9px] font-display text-[#666680] uppercase tracking-widest">MEMORY & LEARNING</span>
          </div>
          <div className="panel overflow-hidden flex-1">
            <TradeLog />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
