"use client";

import { useState } from "react";
import { useBTC } from "@/hooks/useBTC";

export default function PredictPage() {
  const { price } = useBTC();
  const [targetPrice, setTargetPrice] = useState("");
  const [timeWindow, setTimeWindow] = useState("15M");
  const [prediction, setPrediction] = useState<null | {
    probability: number;
    decision: string;
    confidence: string;
    targetAnalysis?: {
      targetPrice: number;
      currentPrice: number;
      distance: string;
      distancePercent: string;
      direction: string;
      probability: number;
      timeWindow: string;
      volatility: number;
    };
  }>(null);

  const runPrediction = async () => {
    try {
      const res = await fetch("/api/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPrice, timeWindow }),
      });
      const data = await res.json();
      setPrediction(data);
    } catch (err) {
      console.error("Prediction failed", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#050a0e] text-[#e0f0f8] font-mono p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Live Price Card */}
        <div className="border border-[#1a2a35] rounded-lg p-4 bg-[#0c141a]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-[#4a7a96] tracking-widest mb-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ffe7] opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ffe7]"></span>
                </span>
                <span>LIVE</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-[#00ffe7]">
                {price ? `$${price.toFixed(2)}` : "Loading..."}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-[#4a7a96] tracking-widest mb-1">AI PREDICTION ENGINE</div>
              <div className="text-[10px] text-[#1a2a35]">v2.0 · Weighted Signals + Timing</div>
              <div className="text-[10px] text-[#1a2a35] mt-0.5">P(price &gt; target in N min)</div>
            </div>
          </div>
        </div>

        {/* Prediction Parameters */}
        <div className="border border-[#1a2a35] rounded-lg p-4 bg-[#0c141a] space-y-4">
          <div className="text-[10px] text-[#4a7a96] tracking-widest">PREDICTION PARAMETERS</div>
          
          <div className="space-y-1.5">
            <label className="text-[11px] text-[#4a7a96] tracking-wider">TARGET PRICE (USD)</label>
            <input
              type="number"
              placeholder="e.g. 85000"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="w-full bg-[#050a0e] border border-[#1a2a35] rounded px-3 py-2 text-[#e0f0f8] text-sm font-mono placeholder:text-[#1a2a35] focus:outline-none focus:border-[#00ffe7]/50 focus:ring-1 focus:ring-[#00ffe7]/20 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-[#4a7a96] tracking-wider">TIME WINDOW</label>
            <div className="flex gap-2">
              {["5M", "15M", "1H"].map((tw) => (
                <button
                  key={tw}
                  onClick={() => setTimeWindow(tw)}
                  className={`flex-1 py-1.5 text-[11px] font-mono tracking-widest rounded border transition-all ${
                    timeWindow === tw
                      ? "border-[#00ffe7]/50 text-[#00ffe7] bg-[#00ffe7]/10"
                      : "border-[#1a2a35] text-[#4a7a96] hover:border-[#1a2a35]/80 hover:text-[#e0f0f8]"
                  }`}
                >
                  {tw}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runPrediction}
            className="w-full py-2.5 rounded border font-mono text-sm tracking-widest transition-all border-[#00ffe7]/40 text-[#00ffe7] hover:bg-[#00ffe7]/10 active:scale-[0.99]"
          >
            RUN PREDICTION
          </button>
        </div>

        {/* Prediction Result */}
        {prediction && (
          <div className="border border-[#1a2a35] rounded-lg p-4 bg-[#0c141a] space-y-3">
            <div className="text-[10px] text-[#4a7a96] tracking-widest">PREDICTION RESULT</div>
            <div className="text-3xl font-bold text-[#00ffe7]">
              {prediction.decision}
            </div>
            <div className="text-xl font-mono">
              P(win) = {prediction.probability}%
            </div>
            <div className="text-sm text-[#4a7a96]">
              Confidence: {prediction.confidence}
            </div>
            {prediction.targetAnalysis && (
              <div className="mt-4 pt-4 border-t border-[#1a2a35] space-y-2">
                <div className="text-[10px] text-[#4a7a96] tracking-widest">TARGET ANALYSIS</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-[#4a7a96] text-[10px]">TARGET</div>
                    <div className="text-[#e0f0f8]">${prediction.targetAnalysis.targetPrice}</div>
                  </div>
                  <div>
                    <div className="text-[#4a7a96] text-[10px]">CURRENT</div>
                    <div className="text-[#e0f0f8]">${prediction.targetAnalysis.currentPrice}</div>
                  </div>
                  <div>
                    <div className="text-[#4a7a96] text-[10px]">DIRECTION</div>
                    <div className={`font-bold ${prediction.targetAnalysis.direction === 'ABOVE' ? 'text-green-400' : 'text-red-400'}`}>
                      {prediction.targetAnalysis.direction}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#4a7a96] text-[10px]">DISTANCE</div>
                    <div className="text-[#e0f0f8]">{prediction.targetAnalysis.distancePercent}%</div>
                  </div>
                  <div>
                    <div className="text-[#4a7a96] text-[10px]">WINDOW</div>
                    <div className="text-[#e0f0f8]">{prediction.targetAnalysis.timeWindow}</div>
                  </div>
                  <div>
                    <div className="text-[#4a7a96] text-[10px]">VOLATILITY</div>
                    <div className="text-[#e0f0f8]">{prediction.targetAnalysis.volatility}%</div>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[#4a7a96] text-[10px]">P(HIT TARGET)</div>
                  <div className="text-2xl font-bold text-[#00ffe7]">
                    {prediction.targetAnalysis.probability}%
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-[10px] text-[#1a2a35] text-center space-y-1 pb-4">
          <div>Weighted Signals + Execution Timing · Binance live data</div>
          <div>Signals are probabilistic — not financial advice</div>
        </div>
      </div>
    </div>
  );
}
