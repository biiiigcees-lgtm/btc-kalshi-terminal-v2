'use client';

interface SignalStrengthBadgeProps {
  confluence: 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR';
  score: number;
}

export function SignalStrengthBadge({ confluence, score }: SignalStrengthBadgeProps) {
  const getStrength = () => {
    const absScore = Math.abs(score);
    if (absScore > 0.6) return { label: 'EXTREME', color: '#ff4466' };
    if (absScore > 0.4) return { label: 'STRONG', color: '#ffaa00' };
    if (absScore > 0.2) return { label: 'MODERATE', color: '#00ff88' };
    return { label: 'WEAK', color: '#8888aa' };
  };

  const strength = getStrength();
  const directionColor = confluence.includes('BULL') ? '#00ff88' : confluence.includes('BEAR') ? '#ff4466' : '#8888aa';

  return (
    <div className="flex items-center gap-2">
      <div 
        className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
        style={{ 
          backgroundColor: `${strength.color}20`,
          color: strength.color,
          border: `1px solid ${strength.color}40`
        }}
      >
        {strength.label}
      </div>
      <div 
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: directionColor }}
      />
    </div>
  );
}
