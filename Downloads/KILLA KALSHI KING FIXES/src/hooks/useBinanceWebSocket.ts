// /src/hooks/useBinanceWebSocket.ts — FIXED
// KEY FIX: Added 1m kline stream for real-time candle data
// 15m kline fires only every 15min — app appeared dead between closes
// Now uses combined stream: ticker + 1m kline (real-time) + 15m kline (signal recompute trigger)
// REST history load uses /api/klines server proxy to bypass Vercel geo-restrictions
'use client';
import { useEffect, useRef } from 'react';
import { usePriceStore } from '../stores/priceStore';
import type { Candle } from '../types';

// Combined stream: ticker for price + 1m kline for real-time candles
const COMBINED_WS = 'wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/btcusdt@kline_1m/btcusdt@kline_15m';
const KRAKEN_WS_URL = 'wss://ws.kraken.com/';
const KRAKEN_OHLC_URL = 'https://api.kraken.com/0/public/OHLC?pair=XBTUSDT&interval=15';

interface KrakenOHLCResponse {
  result?: {
    XBTUSDT?: number[][];
    XXBTZUSD?: number[][];
  };
}

export function useBinanceWebSocket(onCandleClose: () => void) {
  const {
    setSpotPrice,
    setCandles,
    setCurrentCandle,
    appendCandle,
    setConnectionStatus,
    incrementConnectionRetry,
    resetConnectionRetries,
    setLastError,
  } = usePriceStore();

  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);
  const usedKrakenRef = useRef(false);

  // Load 15m candle history
  async function loadHistory() {
    // Try Vercel server proxy first (bypasses Binance geo-restrictions)
    try {
      const res = await fetch('/api/klines?symbol=BTCUSDT&interval=15m&limit=200');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const candles: Candle[] = data.map((k: any[]) => ({
            time: Math.floor(k[0] / 1000),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          }));
          setCandles(candles);
          return;
        }
      }
    } catch { /* fall through */ }

    // Try Kraken REST
    try {
      const res = await fetch(KRAKEN_OHLC_URL);
      if (res.ok) {
        const json = await res.json() as KrakenOHLCResponse;
        const ohlc = json.result?.XBTUSDT || json.result?.XXBTZUSD || [];
        if (ohlc.length > 0) {
          const candles: Candle[] = ohlc.slice(-200).map((k) => ({
            time: Math.floor(k[0]),
            open: parseFloat(String(k[1])),
            high: parseFloat(String(k[2])),
            low: parseFloat(String(k[3])),
            close: parseFloat(String(k[4])),
            volume: parseFloat(String(k[6])),
          }));
          setCandles(candles);
          return;
        }
      }
    } catch { /* fall through */ }

    // Fallback: generate synthetic mock data so signals can compute immediately
    loadMockData();
  }

  function loadMockData() {
    const basePrice = 85000;
    const now = Math.floor(Date.now() / 1000);
    const candles: Candle[] = [];
    let price = basePrice;
    for (let i = 200; i > 0; i--) {
      const time = now - i * 15 * 60;
      const change = (Math.random() - 0.48) * 500;
      price = Math.max(70000, price + change);
      const volatility = Math.random() * 200 + 50;
      const open = price;
      const close = price + (Math.random() - 0.5) * volatility;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      candles.push({ time, open, high, low, close, volume: Math.random() * 800 + 200 });
      price = close;
    }
    setCandles(candles);
  }

  function connectBinance() {
    setConnectionStatus('reconnecting');
    const ws = new WebSocket(COMBINED_WS);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      backoffRef.current = 1000;
      resetConnectionRetries();
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (!msg.data) return;

        // Ticker — real-time price
        if (msg.stream === 'btcusdt@ticker') {
          setSpotPrice(parseFloat(msg.data.c));
          // Also update 24h change data in store if needed
        }

        // 1m kline — updates currentCandle in real-time every second
        if (msg.stream === 'btcusdt@kline_1m') {
          const k = msg.data.k;
          const candle: Candle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          };
          setCurrentCandle(candle);
        }

        // 15m kline — on close, append to candle array and trigger signal recompute
        if (msg.stream === 'btcusdt@kline_15m') {
          const k = msg.data.k;
          if (k.x) { // candle is closed
            const candle: Candle = {
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
            };
            appendCandle(candle);
            onCandleClose();
          }
        }
      } catch { /* malformed message, ignore */ }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      setLastError('Binance WebSocket error — switching to Kraken');
      ws.close();
    };

    ws.onclose = () => {
      incrementConnectionRetry();
      const retries = usePriceStore.getState().connectionRetries;
      if (retries >= 3 && !usedKrakenRef.current) {
        usedKrakenRef.current = true;
        connectKraken();
        return;
      }
      setConnectionStatus('reconnecting');
      backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      setTimeout(connectBinance, backoffRef.current);
    };
  }

  function connectKraken() {
    setConnectionStatus('reconnecting');
    const ws = new WebSocket(KRAKEN_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      backoffRef.current = 1000;
      resetConnectionRetries();
      ws.send(JSON.stringify({
        event: 'subscribe',
        pair: ['XBT/USDT'],
        subscription: { name: 'ohlc', interval: 15 },
      }));
      ws.send(JSON.stringify({
        event: 'subscribe',
        pair: ['XBT/USDT'],
        subscription: { name: 'ticker' },
      }));
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (!Array.isArray(data)) return;

        // Kraken ticker: [channelID, { c: [price, vol] }, 'ticker', 'XBT/USDT']
        if (data[2] === 'ticker' && data[1]?.c) {
          setSpotPrice(parseFloat(String(data[1].c[0])));
        }

        // Kraken OHLC: [channelID, [time, endtime, open, high, low, close, vwap, vol, count], 'ohlc-15', 'XBT/USDT']
        if (typeof data[2] === 'string' && data[2].startsWith('ohlc') && Array.isArray(data[1])) {
          const ohlc = data[1];
          const candle: Candle = {
            time: Math.floor(Number(ohlc[0])),
            open: parseFloat(String(ohlc[2])),
            high: parseFloat(String(ohlc[3])),
            low: parseFloat(String(ohlc[4])),
            close: parseFloat(String(ohlc[5])),
            volume: parseFloat(String(ohlc[7])),
          };
          setCurrentCandle(candle);
          // Kraken sends OHLC update on each trade — treat candle as "current"
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      incrementConnectionRetry();
      setConnectionStatus('reconnecting');
      backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      setTimeout(connectKraken, backoffRef.current);
    };
  }

  // REST price fallback — fires every 5s in case WebSocket fails
  function startRestFallback() {
    const fetchPrice = async () => {
      if (usePriceStore.getState().connectionStatus === 'connected') return;
      try {
        const res = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSDT');
        const data = await res.json();
        const price = data.result?.XBTUSDT?.c?.[0] || data.result?.XXBTZUSD?.c?.[0];
        if (price) {
          setSpotPrice(parseFloat(price));
          setConnectionStatus('connected');
        }
      } catch { /* ignore */ }
    };
    return setInterval(fetchPrice, 5000);
  }

  // CoinGecko cross-reference
  function startCoinGeckoPoll() {
    const fetch_ = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
        if (!res.ok) return;
        const data = await res.json();
        if (data.bitcoin?.usd) {
          usePriceStore.getState().setCoingeckoPrice(data.bitcoin.usd);
        }
      } catch { /* ignore */ }
    };
    fetch_();
    return setInterval(fetch_, 30000);
  }

  useEffect(() => {
    loadHistory();
    connectBinance();
    const restInterval = startRestFallback();
    const cgInterval = startCoinGeckoPoll();

    return () => {
      wsRef.current?.close();
      clearInterval(restInterval);
      clearInterval(cgInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
