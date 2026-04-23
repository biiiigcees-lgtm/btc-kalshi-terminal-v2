// /src/components/BTCLivePrice.tsx — Simple, smooth live BTC price display
'use client';
import { usePriceStore } from '@/stores/priceStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function BTCLivePrice() {
  const { spotPrice, feedHealth, priceFreshness, feedLatency } = usePriceStore();
  const hasPrice = spotPrice > 0;

  // Price freshness indicator
  const freshnessStatus = priceFreshness < 1000 ? 'LIVE' : priceFreshness < 3000 ? 'STALE' : 'DELAYED';
  const freshnessColor = priceFreshness < 1000 ? '#00ff88' : priceFreshness < 3000 ? '#ffaa00' : '#ff4466';

  // Feed health color
  const healthColor = feedHealth === 'healthy' ? '#00ff88' : feedHealth === 'degraded' ? '#ffaa00' : '#ff4466';

  return (
    <div className="flex items-center gap-3">
      {/* BTC label */}
      <span className="text-[10px] font-mono text-[#3a3a50] uppercase tracking-wider">BTC/USD</span>

      {/* Live price */}
      <div className="flex items-baseline gap-1">
        <AnimatePresence mode="wait">
          <motion.span
            key={spotPrice}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="text-xl font-mono font-bold text-[#00ff88]"
          >
            {hasPrice ? `$${spotPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---'}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Feed health badge */}
      {hasPrice && (
        <motion.span
          animate={{ opacity: feedHealth === 'healthy' ? 1 : [1, 0.5, 1] }}
          transition={{ repeat: feedHealth !== 'healthy' ? Infinity : 0, duration: 1 }}
          className="text-[7px] font-mono px-1.5 py-0.5 rounded"
          style={{ background: `${healthColor}20`, color: healthColor }}
        >
          {feedHealth.toUpperCase()}
        </motion.span>
      )}

      {/* Freshness indicator */}
      {hasPrice && (
        <span className="text-[8px] font-mono" style={{ color: freshnessColor }}>
          ● {freshnessStatus}
        </span>
      )}

      {/* Latency */}
      {hasPrice && feedLatency > 0 && (
        <span className="text-[8px] font-mono text-[#555570]">
          {feedLatency.toFixed(0)}ms
        </span>
      )}
    </div>
  );
}
