// /src/components/GaugeChart.tsx
'use client';
import { motion } from 'framer-motion';

interface GaugeProps {
  readonly value: number; // 0–100
  readonly title: string;
  readonly zones: readonly { readonly min: number; readonly max: number; readonly color: string }[];
  readonly directive?: string;
  readonly directiveColor?: string;
}

const CX = 100;
const CY = 90;
const R = 75;

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function describeArc(startDeg: number, endDeg: number, r: number) {
  const s = polarToXY(startDeg, r);
  const e = polarToXY(endDeg, r);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

const colorToTailwindClass = (color: string | undefined): string => {
  if (!color) return 'text-[#666680]';
  if (color === '#00ff88') return 'text-[#00ff88]';
  if (color === '#ff4466') return 'text-[#ff4466]';
  if (color === '#666680') return 'text-[#666680]';
  return 'text-[#666680]';
};

export default function GaugeChart({ value, title, zones, directive, directiveColor }: GaugeProps) {
  // 0% = -90deg (left), 50% = 0deg (top), 100% = +90deg (right)
  const needleAngle = -90 + (value / 100) * 180;

  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-display text-[#666680] uppercase tracking-widest mb-1">{title}</span>
      <svg width={200} height={120} viewBox={`0 0 200 120`}>
        {/* Glow effect */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d={describeArc(0, 180, R)}
          fill="none"
          stroke="#252538"
          strokeWidth={16}
          strokeLinecap="round"
        />

        {/* Zone arcs */}
        {zones.map((zone) => {
          const startDeg = zone.min * 1.8;
          const endDeg = zone.max * 1.8;
          return (
            <path
              key={`${zone.min}-${zone.max}-${zone.color}`}
              d={describeArc(startDeg, endDeg, R)}
              fill="none"
              stroke={zone.color}
              strokeWidth={16}
              strokeLinecap="butt"
              opacity={0.6}
            />
          );
        })}

        {/* Needle */}
        <motion.g
          animate={{ rotate: needleAngle + 90 }}
          style={{ originX: `${CX}px`, originY: `${CY}px` }}
          initial={false}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        >
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - (R - 15)}
            stroke="#e8e8f0"
            strokeWidth={3}
            strokeLinecap="round"
            filter="url(#glow)"
          />
        </motion.g>

        {/* Center dot */}
        <circle cx={CX} cy={CY} r={6} fill="#e8e8f0" filter="url(#glow)" />

        {/* Value text */}
        <text
          x={CX}
          y={CY - 14}
          textAnchor="middle"
          fill="#e8e8f0"
          fontSize={22}
          fontFamily="JetBrains Mono, monospace"
          fontWeight="700"
        >
          {value.toFixed(1)}%
        </text>

        {/* Min/Max labels */}
        <text x={15} y={108} fill="#444460" fontSize={9} fontFamily="JetBrains Mono">0</text>
        <text x={180} y={108} fill="#444460" fontSize={9} fontFamily="JetBrains Mono">100</text>
        <text x={CX} y={112} textAnchor="middle" fill="#444460" fontSize={9} fontFamily="JetBrains Mono">50</text>
      </svg>

      {/* Directive */}
      {directive && (
        <div className={`text-xl font-display font-bold tracking-wider mt-1 ${colorToTailwindClass(directiveColor)}`}>
          {directive}
        </div>
      )}
    </div>
  );
}
