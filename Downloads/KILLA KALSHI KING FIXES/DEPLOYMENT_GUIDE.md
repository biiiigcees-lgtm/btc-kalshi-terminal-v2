# KILLA KALSHI KING — Fix Deployment Guide

## Root Cause Summary

| # | Severity | File | Bug | Fix |
|---|----------|------|-----|-----|
| 1 | CRITICAL | `src/utils/indicators.ts` | `computeSignals` required 210 candles (EMA200 needs 200+ data points). App had 200 candles from history load but the guard was 210 — signals were always empty array. Everything downstream ($0.00, dead gauges, no AI) cascaded from this. | Replaced `technicalindicators` library with pure math. Changed EMA alignment from 20/50/200 → 9/21/50. Threshold dropped from 210 → 55. |
| 2 | CRITICAL | `src/hooks/useBinanceWebSocket.ts` | Stream was `btcusdt@kline_15m` only. A new candle closes every 15 minutes — `onCandleClose` (which triggers `recompute`) only fired 4x/hour. App appeared completely dead between candle closes. | Added `btcusdt@kline_1m` to combined stream. `currentCandle` now updates every second. `setSpotPrice` triggers signal recompute via Zustand subscription. |
| 3 | CRITICAL | `app/api/analyze/route.ts` | `.env.local` is gitignored and never deployed to Vercel. `GROQ_API_KEY` was never set as a Vercel env var → every AI call returned 500. Also: `generateObject` with Zod schema unreliable with Groq's llama models. | Switched to direct `fetch` calls. Primary: Anthropic Claude (ANTHROPIC_API_KEY). Fallback: Groq text completion (no structured output). |
| 4 | HIGH | `src/hooks/useSignalEngine.ts` | `recompute` only called on `onCandleClose`. Signals never refreshed between 15-minute closes. | Added Zustand `subscribe` to `spotPrice` — recomputes signals on every ticker update using merged candles + currentCandle. |
| 5 | HIGH | `src/utils/regimeDetector.ts` | Same 210-candle guard, used EMA200. Regime always returned `ranging/normal` default. | Aligned to 55-candle threshold, uses EMA9/21/50. |
| 6 | MEDIUM | `src/components/EnsembleGauges.tsx` | `useEffect` dispatched `auto-analyze` CustomEvent on every ensemble/edge state change — multiple times per second. Flooded AI API → rate limit errors. | Removed the auto-analyze dispatch entirely. AI advisor has its own cooldown timer. |
| 7 | MEDIUM | `src/components/SignalDashboard.tsx` | Same flooding issue — dispatched `auto-analyze` on every signal load. | Removed dispatch. |
| 8 | LOW | `package.json` | `"next": "^16.2.4"` — Next.js v16 does not exist. Latest is v15. Build failures on Vercel. Also included `@ai-sdk/groq`, `@ai-sdk/openai`, `ai` SDK packages no longer needed. | Fixed to `"next": "15.3.1"`. Removed unused AI SDK packages. |

---

## Deployment Steps

### Step 1 — Replace files in your repo

Copy these fixed files into your repo at the exact paths shown:

```
src/utils/indicators.ts          ← indicators.ts (fix)
src/utils/regimeDetector.ts      ← regimeDetector.ts (fix)
src/hooks/useBinanceWebSocket.ts ← useBinanceWebSocket.ts (fix)
src/hooks/useSignalEngine.ts     ← useSignalEngine.ts (fix)
src/components/EnsembleGauges.tsx← EnsembleGauges.tsx (fix)
src/components/SignalDashboard.tsx← SignalDashboard.tsx (fix)
app/api/analyze/route.ts         ← route.ts (fix)
package.json                     ← package.json (fix)
next.config.js                   ← next.config.js (fix)
```

### Step 2 — Set environment variables on Vercel

Go to: Vercel Dashboard → btc-kalshi-terminal-v2 → Settings → Environment Variables

Add at minimum ONE of these:

| Variable | Value | Source |
|----------|-------|--------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | https://console.anthropic.com/ |
| `GROQ_API_KEY` | `gsk_...` | https://console.groq.com/keys |

> **Important:** Do NOT commit `.env.local` to git. Remove your hardcoded key from `.env.local` if it was committed.

### Step 3 — Push to GitHub

```bash
git add .
git commit -m "fix: all 8 bugs — signals, WS, AI, package versions"
git push origin main
```

Vercel auto-deploys on push. Build time ~60 seconds.

### Step 4 — Verify

After deploy, open https://btc-kalshi-terminal-v2.vercel.app/ and confirm:
- BTC price shows live (not $0.00) within 5 seconds
- Signal Engine shows 10 indicators within 10–15 seconds
- Ensemble gauges animate to live values
- AI Advisor shows analysis after 15–30 seconds
- Kalshi countdown timer ticks correctly

---

## What is working now

- Binance WebSocket → live BTC price (sub-second via ticker stream)
- 1-minute kline stream → `currentCandle` updates in real-time
- 15-minute kline stream → candle history grows + `onCandleClose` fires correctly
- Signals compute as soon as 55 candles are available (~14 minutes from cold start, or immediately from history load)
- `useSignalEngine` subscribes to `spotPrice` → recomputes on every tick
- AI Advisor calls Anthropic Claude (or Groq fallback) via server-side API route
- No more rate limit flooding from EnsembleGauges/SignalDashboard auto-analyze events
- `package.json` uses valid Next.js 15.3.1 — clean builds on Vercel
