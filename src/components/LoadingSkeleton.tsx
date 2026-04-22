export function SignalSkeleton() {
  return (
    <div className="border border-[#1a1a2a] rounded-lg p-4 bg-[#0c141a] space-y-3 animate-pulse">
      <div className="h-4 bg-[#1a1a2a] rounded w-24"></div>
      <div className="h-8 bg-[#1a1a2a] rounded w-32"></div>
      <div className="h-6 bg-[#1a1a2a] rounded w-48"></div>
    </div>
  );
}

export function PriceSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-12 bg-[#1a1a2a] rounded mb-4"></div>
      <div className="h-64 bg-[#1a1a2a] rounded"></div>
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="bg-[#0a0a14] border border-[#1a1a2a] rounded p-2 animate-pulse">
      <div className="h-3 bg-[#1a1a2a] rounded w-16 mb-1"></div>
      <div className="h-4 bg-[#1a1a2a] rounded w-20"></div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <div className="h-8 bg-[#1a1a2a] rounded animate-pulse"></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-[#0c141a] rounded animate-pulse"></div>
      ))}
    </div>
  );
}
