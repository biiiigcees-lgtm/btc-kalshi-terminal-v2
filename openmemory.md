# KILLA_KALSHI_KING - Bitcoin Kalshi Trading Dashboard

## Project Overview
A Next.js-based trading dashboard for Bitcoin Kalshi markets featuring real-time market data, AI-powered trade analysis, paper trading simulation, and technical indicators.

**Tech Stack:**
- Next.js 14.2.3 + React 18.3.1 + TypeScript 5.4.5
- Zustand for state management
- lightweight-charts for candlestick visualization
- technicalindicators for TA calculations
- Framer Motion for animations
- TailwindCSS for styling
- Gemini AI API for trade analysis

## Architecture

### Biological UI Layout
The dashboard uses a biological functional grouping metaphor:

| Zone | Components | Purpose |
|------|------------|---------|
| **SENSORY** | TopBar, BTCChart | Market perception |
| **TEMPORAL** | CountdownTimer | Time awareness (15-min windows) |
| **ANALYSIS** | SignalDashboard, EnsembleGauges | Pattern recognition |
| **DECISION** | PositionSizingPanel, AIAdvisor | Risk assessment |
| **EXECUTION** | PaperTradingPanel | Action center |
| **MEMORY** | TradeLog | Learning & history |

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA SOURCES                                │
├─────────────────────────────────────────────────────────────────┤
│  Binance WS  │  Kraken WS/REST  │  CoinGecko REST (30s poll)   │
└──────┬───────┴────────┬─────────┴──────────────┬─────────────────┘
       │                │                        │
       └────────────────┼────────────────────────┘
                        ▼
            ┌─────────────────────┐
            │   priceStore.ts     │
            │  - spotPrice        │
            │  - candles[]        │
            │  - currentCandle    │
            │  - coingeckoPrice   │
            │  - connectionStatus │
            └──────────┬──────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  useSignal   │ │BTCChart  │ │  TopBar      │
│  Engine.ts   │ │.tsx      │ │  .tsx        │
└──────┬───────┘ └──────────┘ └──────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│         INDICATORS                  │
│  - RSI, MACD, Stochastic           │
│  - Bollinger Bands, Z-Score        │
│  - EMA Alignment, ATR Ratio        │
│  - Keltner Channel, VWAP           │
└────────────────┬────────────────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  signalStore.ts │
        │  - signals[]    │
        │  - regime       │
        │  - ensembleProb │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  ensemble.ts    │
        │  Weighted vote  │
        │  by regime      │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  kalshiStore.ts │
        │  - edge calc    │
        │  - kelly sizing │
        │  - recommended  │
        └─────────────────┘
```

## Components

### Core Components

| File | Responsibility |
|------|----------------|
| `TopBar.tsx` | Live price, connection status, 24h change |
| `BTCChart.tsx` | Candlestick chart + BB/EMA/VWAP overlays |
| `CountdownTimer.tsx` | 15-min window countdown, target price input, bet amount |
| `SignalDashboard.tsx` | Individual signal displays |
| `EnsembleGauges.tsx` | Ensemble probability visualization |
| `PositionSizingPanel.tsx` | Kelly criterion calculations |
| `PaperTradingPanel.tsx` | Virtual trading with UP/DOWN buttons |
| `AIAdvisor.tsx` | Chat interface with Gemini AI |
| `TradeLog.tsx` | Historical trade records |

### Custom Hooks

| File | Purpose |
|------|---------|
| `useBinanceWebSocket.ts` | Real-time price + candle data (Binance → Kraken fallback) |
| `useSignalEngine.ts` | Recompute all signals on candle close |
| `useKalshiWindow.ts` | 15-minute window countdown timer |
| `useAutoAnalysis.ts` | Trigger AI analysis when inputs ready |
| `useMultiExchangeFeed.ts` | Multi-exchange price aggregation |
| `useRiskGuards.ts` | Risk management alerts |

### Stores (Zustand)

| File | State |
|------|-------|
| `priceStore.ts` | spotPrice, candles, connectionStatus |
| `signalStore.ts` | signals[], regime, ensembleProbability |
| `kalshiStore.ts` | targetPrice, edge, kellyFraction, recommendedBet |
| `paperTradeStore.ts` | virtualBalance, activeTrade, trades[], metrics |
| `tradeStore.ts` | Account balance, intendedBet, rollingWinRate20 |

## Key Features

### 1. Real-time Market Data
- Primary: Binance WebSocket (kline_15m + ticker)
- Fallback: Kraken WebSocket + REST API
- Backup: CoinGecko REST polling (30s)
- Auto-reconnect with exponential backoff

### 2. Technical Indicators (10 signals)
```typescript
// Momentum (4)
RSI(14), MACD(12/26/9), Stochastic(14), ROC(10)

// Mean Reversion (3)
Bollinger Bands, Z-Score(20), Keltner Channel

// Trend (3)
EMA Alignment(20/50/200), ATR Ratio, VWAP Deviation
```

### 3. Ensemble Prediction
- Weighted voting based on market regime
- Momentum signals: boosted in trending markets
- Mean reversion: boosted in ranging markets
- High volatility: reduced weights

### 4. Position Sizing (Kelly Criterion)
```typescript
edge = ensembleProbability - impliedProbability
kellyFraction = 2 * p - 1
fractionalKelly = kellyFraction * 0.40  // Conservative
volatilityAdjustment = if (atrRatio > 1.5) ×0.5
cappedFraction = min(fractionalKelly, 0.03)  // Max 3%
recommendedBet = accountBalance * cappedFraction
```

### 5. Paper Trading
- $10,000 starting balance
- UP/DOWN binary options simulation
- 96% payout on wins, 4% fees
- Tracks: Win rate, profit factor, max drawdown
- Trade validation: edge > 2%, EV > 0

### 6. AI Analysis (Gemini)
- Auto-triggered when targetPrice + intendedBet set
- 30-second cooldown between requests
- Sends complete market context
- Parses BET UP / BET DOWN / NO TRADE directives

## User Namespaces

- **frontend**: React components, hooks, stores
- **backend**: API routes, external integrations
- **utils**: Indicators, ensemble, context builder

## Data Types

```typescript
// /src/types/index.ts
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SignalResult {
  name: string;
  value: number;
  confidence: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  category: 'momentum' | 'meanReversion' | 'trend';
}

interface MarketRegime {
  trend: 'up' | 'down' | 'ranging';
  volatility: 'high' | 'normal' | 'low';
}
```

## Environment Variables

```
GEMINI_API_KEY=your_gemini_api_key_here
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/analyze` | POST | AI trade analysis with rate limiting (30s) |
| `/api/klines` | GET | Historical candle data proxy |

## File Structure

```
app/
├── page.tsx              # Main dashboard layout
├── layout.tsx            # Root layout
├── globals.css           # Global styles + animations
└── api/
    ├── analyze/route.ts  # Gemini AI integration
    └── klines/           # Candle data proxy

src/
├── components/           # React components (11 files)
├── hooks/                # Custom hooks (6 files)
├── stores/               # Zustand stores (5 files)
├── utils/                # Utilities (5 files)
├── constants/            # System prompt
└── types/                # TypeScript types
```
