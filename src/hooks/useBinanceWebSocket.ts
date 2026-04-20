// /src/hooks/useBinanceWebSocket.ts
'use client';
import { useEffect, useRef } from 'react';
import { usePriceStore } from '../stores/priceStore';
import type { Candle } from '../types';

const KLINE_URL = 'wss://stream.binance.com:9443/ws/btcusdt@kline_15m';
const TICKER_URL = 'wss://stream.binance.com:9443/ws/btcusdt@ticker';
// Kraken WebSocket (no geo-restrictions)
const KRAKEN_WS_URL = 'wss://ws.kraken.com/';
// Kraken REST API (no geo-restrictions, no API key needed)
const KRAKEN_OHLC_URL = 'https://api.kraken.com/0/public/OHLC?pair=XBTUSDT&interval=15';

interface KrakenOHLCResponse {
  result?: {
    XBTUSDT?: number[][];
    XXBTZUSD?: number[][];
  };
}

export function useBinanceWebSocket(onCandleClose: () => void) {
  const { setSpotPrice, setCandles, setCurrentCandle, appendCandle, setConnectionStatus, incrementConnectionRetry, resetConnectionRetries, setLastError } = usePriceStore();
  const klineWs = useRef<WebSocket | null>(null);
  const tickerWs = useRef<WebSocket | null>(null);
  const klineBackoff = useRef(1000);
  const tickerBackoff = useRef(1000);

  async function loadHistory() {
    try {
      const res = await fetch(KRAKEN_OHLC_URL);
      if (!res.ok) {
        console.error('Kraken API error:', res.status);
        return;
      }
      const json = await res.json();
      // Kraken returns: { result: { XBTUSDT: [[time, open, high, low, close, vwap, volume, count], ...] } }
      const ohlc = json.result?.XBTUSDT || json.result?.XXBTZUSD || [];
      if (ohlc.length === 0) {
        console.error('No OHLC data received from Kraken');
        return;
      }
      const candles: Candle[] = ohlc.slice(-200).map((k: number[]) => ({
        time: Math.floor(k[0]), // Kraken time is already in seconds
        open: parseFloat(String(k[1])),
        high: parseFloat(String(k[2])),
        low: parseFloat(String(k[3])),
        close: parseFloat(String(k[4])),
        volume: parseFloat(String(k[6])),
      }));
      console.log(`Loaded ${candles.length} candles from Kraken`);
      setCandles(candles);
    } catch (e) {
      console.error('History load failed', e);
    }
  }

  function connectKline() {
    setConnectionStatus('reconnecting');
    const ws = new WebSocket(KLINE_URL);
    klineWs.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      klineBackoff.current = 1000;
      resetConnectionRetries();
    };

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      const k = msg.k;
      const candle: Candle = {
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      };
      setCurrentCandle(candle);
      if (k.x) {
        appendCandle(candle);
        onCandleClose();
        // Refetch last 10 candles to ensure no gaps
        fetch(KRAKEN_OHLC_URL)
          .then(r => r.json())
          .then((json: KrakenOHLCResponse) => {
            const ohlc = json.result?.XBTUSDT || json.result?.XXBTZUSD || [];
            const recent: Candle[] = ohlc.slice(-10).map((k: number[]) => ({
              time: Math.floor(k[0]),
              open: Number.parseFloat(String(k[1])),
              high: Number.parseFloat(String(k[2])),
              low: Number.parseFloat(String(k[3])),
              close: Number.parseFloat(String(k[4])),
              volume: Number.parseFloat(String(k[6])),
            }));
            const store = usePriceStore.getState();
            const merged = [...store.candles.slice(0, -10), ...recent];
            setCandles(merged.slice(-200));
          })
          .catch(() => {
            // Candle fetch failed - will retry on next close
          });
      }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      setLastError('WebSocket connection error');
      incrementConnectionRetry();
      ws.close();
    };
    ws.onclose = () => {
      incrementConnectionRetry();
      // Fallback to Kraken after 3 failed attempts
      if (klineBackoff.current > 4000) {
        console.log('Switching to Kraken WebSocket...');
        setLastError(`Binance failed after ${usePriceStore.getState().connectionRetries} retries, switching to Kraken...`);
        connectKrakenKline();
        return;
      }
      setConnectionStatus('reconnecting');
      klineBackoff.current = Math.min(klineBackoff.current * 2, 30000);
      setTimeout(connectKline, klineBackoff.current);
    };
  }

  function connectKrakenKline() {
    setConnectionStatus('reconnecting');
    const ws = new WebSocket(KRAKEN_WS_URL);
    klineWs.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      klineBackoff.current = 1000;
      resetConnectionRetries();
      // Subscribe to OHLC channel
      ws.send(JSON.stringify({
        event: 'subscribe',
        pair: ['XBT/USDT'],
        subscription: { name: 'ohlc', interval: 15 }
      }));
    };

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      // Kraken format: [channelID, [time, endtime, open, high, low, close, vwap, volume, count], ...]
      if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
        const ohlc = data[1];
        const candle: Candle = {
          time: Math.floor(Number(ohlc[0])),
          open: Number.parseFloat(String(ohlc[2])),
          high: Number.parseFloat(String(ohlc[3])),
          low: Number.parseFloat(String(ohlc[4])),
          close: Number.parseFloat(String(ohlc[5])),
          volume: Number.parseFloat(String(ohlc[7])),
        };
        setCurrentCandle(candle);
        // Kraken OHLC updates at close of interval
        if (ohlc[1] <= ohlc[0]) {
          appendCandle(candle);
          onCandleClose();
        }
      }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      setLastError('Kraken WebSocket error');
      incrementConnectionRetry();
    };
    ws.onclose = () => {
      incrementConnectionRetry();
      setConnectionStatus('reconnecting');
      klineBackoff.current = Math.min(klineBackoff.current * 2, 30000);
      setTimeout(connectKrakenKline, klineBackoff.current);
    };
  }

  function connectTicker() {
    const ws = new WebSocket(TICKER_URL);
    tickerWs.current = ws;
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      setSpotPrice(parseFloat(msg.c));
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (tickerBackoff.current > 4000) {
        console.log('Switching to Kraken ticker...');
        connectKrakenTicker();
        return;
      }
      tickerBackoff.current = Math.min(tickerBackoff.current * 2, 30000);
      setTimeout(connectTicker, tickerBackoff.current);
    };
  }

  function connectKrakenTicker() {
    const ws = new WebSocket(KRAKEN_WS_URL);
    tickerWs.current = ws;

    ws.onopen = () => {
      tickerBackoff.current = 1000;
      // Subscribe to ticker channel
      ws.send(JSON.stringify({
        event: 'subscribe',
        pair: ['XBT/USDT'],
        subscription: { name: 'ticker' }
      }));
    };

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      // Kraken ticker format: [channelID, { c: [price, volume], ... }, ...]
      if (Array.isArray(data) && data.length > 1 && data[1]?.c) {
        setSpotPrice(Number.parseFloat(String(data[1].c[0])));
      }
    };

    ws.onclose = () => {
      tickerBackoff.current = Math.min(tickerBackoff.current * 2, 30000);
      setTimeout(connectKrakenTicker, tickerBackoff.current);
    };
  }

  // REST API fallback for price when WebSocket fails
  function startRestFallback() {
    const fetchPrice = async () => {
      try {
        const res = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSDT');
        const data = await res.json();
        const price = data.result?.XBTUSDT?.c?.[0] || data.result?.XXBTZUSD?.c?.[0];
        if (price) {
          setSpotPrice(Number.parseFloat(price));
          setConnectionStatus('connected');
        }
      } catch (e) {
        console.error('REST fallback failed:', e);
      }
    };
    
    fetchPrice();
    return setInterval(fetchPrice, 5000); // Poll every 5 seconds
  }

  useEffect(() => {
    loadHistory();
    connectKline();
    connectTicker();
    
    // Start REST API fallback for price
    const restInterval = startRestFallback();

    // Poll CoinGecko every 30s
    const cgPoll = setInterval(async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        if (!res.ok) {
          console.error('CoinGecko API error:', res.status);
          return;
        }
        const data = await res.json();
        if (data.bitcoin?.usd) {
          usePriceStore.getState().setCoingeckoPrice(data.bitcoin.usd);
        } else {
          console.error('CoinGecko response missing price data:', data);
        }
      } catch (err) {
        console.error('CoinGecko fetch failed:', err);
      }
    }, 30000);

    return () => {
      klineWs.current?.close();
      tickerWs.current?.close();
      clearInterval(restInterval);
      clearInterval(cgPoll);
    };
  }, []);
}
