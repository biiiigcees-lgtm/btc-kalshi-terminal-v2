# KALSHI · BTC · INTELLIGENCE — V2.0

Professional Kalshi BTC 15-Minute Prediction Market Intelligence Dashboard.

## Stack
- Next.js 14 (App Router)
- TypeScript (strict)
- Tailwind CSS
- TradingView lightweight-charts v4
- Zustand (4 store slices, 2 persisted)
- Framer Motion
- technicalindicators npm package
- Binance WebSocket (kline + ticker)
- Claude API (server-side only via Route Handler)

## Local Development

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the env template:
   ```bash
   cp .env.local.example .env.local
   ```
4. Add your Anthropic API key to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
5. Run dev server:
   ```bash
   npm run dev
   ```
6. Open http://localhost:3000

## Getting Your Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign in or create an account
3. Navigate to API Keys
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-`)
6. Paste into `.env.local` or Vercel env vars

## Vercel Deployment

1. Push this repo to GitHub (`.env.local` is gitignored — safe)
2. Import project at https://vercel.com/new
3. In Vercel project settings → Environment Variables, add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...`
   - Environments: Production, Preview, Development
4. Deploy — Vercel auto-deploys on every GitHub push

## Architecture Notes

- `ANTHROPIC_API_KEY` is read ONLY inside `/app/api/analyze/route.ts` (server-side)
- It NEVER touches the browser or client bundle
- Trade log and account balance are persisted to localStorage via Zustand middleware
- WebSocket reconnects with exponential backoff (1s → 2s → 4s → 8s → max 30s)
- All 10 technical indicators use the `technicalindicators` npm package (no hand-rolled math)

## Features

- Live BTC price via Binance WebSocket (sub-second updates)
- 10 technical signals: RSI, MACD, Stochastic, ROC, BB, Z-Score, Keltner, EMA Alignment, ATR Ratio, VWAP
- Regime-adjusted ensemble probability (trending vs ranging weights)
- Market regime detection (EMA alignment + ATR ratio)
- Two SVG ensemble gauges with spring-animated Framer Motion needles
- 15-minute Kalshi window countdown synced to UTC :00/:15/:30/:45
- Kelly Criterion position sizing with volatility adjustment and 3% hard cap
- AI trade advisor powered by Claude — analyzes full market context
- 8-condition risk alert system with slide-in banners
- Persistent trade log with rolling win rate, profit factor, Sharpe ratio
- TradingView candlestick chart with BB(20), EMA(50), VWAP overlays + Kalshi target price line
- CoinGecko cross-reference with divergence detection
