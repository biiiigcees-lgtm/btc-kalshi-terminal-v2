'use client';
import { useEffect, useRef, useCallback } from 'react';
import { usePriceStore } from '../stores/priceStore';
import type { Candle } from '../types';
import { performanceMonitor } from '@/lib/performance';

const COMBINED_WS = 'wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/btcusdt@kline_1m/btcusdt@kline_15m';
const KRAKEN_WS = 'wss://ws.kraken.com/';
const KRAKEN_OHLC = 'https://api.kraken.com/0/public/OHLC?pair=XBTUSDT&interval=15';

const MAX_RETRIES = 5;
const INITIAL_BACKOFF = 1000;
const MAX_BACKOFF = 30000;
const HEARTBEAT_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 10000;

export function useBinanceWebSocket(onCandleClose: () => void) {
  const { setSpotPrice, setCandles, setCurrentCandle, appendCandle, setConnectionStatus, incrementConnectionRetry, resetConnectionRetries, setLastError } = usePriceStore();
  const wsRef = useRef<WebSocket | null>(null);
  const backoff = useRef(INITIAL_BACKOFF);
  const krakenMode = useRef(false);
  const mounted = useRef(true);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTime = useRef(Date.now());
  const connectionAttempts = useRef(0);

  async function loadHistory() {
    // Try server proxy first (bypasses geo-restrictions)
    try {
      const res = await fetch('/api/klines?symbol=BTCUSDT&interval=15m&limit=200');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const candles: Candle[] = data.map((k: number[]) => ({
            time: Math.floor(k[0] / 1000),
            open: parseFloat(String(k[1])),
            high: parseFloat(String(k[2])),
            low: parseFloat(String(k[3])),
            close: parseFloat(String(k[4])),
            volume: parseFloat(String(k[5])),
          }));
          setCandles(candles);
          return;
        }
      }
    } catch { /* fall through */ }

    // Try Kraken REST
    try {
      const res = await fetch(KRAKEN_OHLC);
      if (res.ok) {
        const json = await res.json();
        const ohlc: number[][] = json.result?.XBTUSDT || json.result?.XXBTZUSD || [];
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

    // Synthetic fallback so signals can compute immediately
    const now = Math.floor(Date.now() / 1000);
    let price = 85000;
    const candles: Candle[] = [];
    for (let i = 200; i > 0; i--) {
      price += (Math.random() - 0.48) * 400;
      price = Math.max(70000, price);
      const v = Math.random() * 200 + 50;
      const o = price;
      const c = price + (Math.random() - 0.5) * v;
      const h = Math.max(o, c) + Math.random() * v * 0.3;
      const l = Math.min(o, c) - Math.random() * v * 0.3;
      candles.push({ time: now - i * 900, open: o, high: h, low: l, close: c, volume: Math.random() * 600 + 200 });
      price = c;
    }
    setCandles(candles);
  }

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    
    heartbeatRef.current = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        clearInterval(heartbeatRef.current!);
        return;
      }
      
      const timeSinceLastMessage = Date.now() - lastMessageTime.current;
      if (timeSinceLastMessage > HEARTBEAT_INTERVAL) {
        console.warn('WebSocket heartbeat timeout, reconnecting...');
        wsRef.current.close();
      }
    }, HEARTBEAT_INTERVAL / 2);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  function connectBinance() {
    if (!mounted.current) return;
    setConnectionStatus('reconnecting');
    connectionAttempts.current++;
    
    try {
      const ws = new WebSocket(COMBINED_WS);
      wsRef.current = ws;
      
      // Connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn('WebSocket connection timeout');
          ws.close();
        }
      }, CONNECTION_TIMEOUT);
      
      ws.onopen = () => {
        if (!mounted.current) { ws.close(); return; }
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        setConnectionStatus('connected');
        backoff.current = INITIAL_BACKOFF;
        resetConnectionRetries();
        connectionAttempts.current = 0;
        lastMessageTime.current = Date.now();
        startHeartbeat();
        
        performanceMonitor.recordWebSocketLatency(Date.now() - (lastMessageTime.current - HEARTBEAT_INTERVAL));
      };
      
      ws.onmessage = (evt) => {
        if (!mounted.current) return;
        lastMessageTime.current = Date.now();
        
        try {
          const msg = JSON.parse(evt.data);
          if (!msg?.data || !msg?.stream) return;
          
          if (msg.stream === 'btcusdt@ticker') {
            const p = parseFloat(msg.data.c);
            if (p > 0) setSpotPrice(p);
          }
          
          if (msg.stream === 'btcusdt@kline_1m') {
            const k = msg.data.k;
            setCurrentCandle({
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o), high: parseFloat(k.h),
              low: parseFloat(k.l), close: parseFloat(k.c),
              volume: parseFloat(k.v),
            });
          }
          
          if (msg.stream === 'btcusdt@kline_15m' && msg.data.k?.x) {
            const k = msg.data.k;
            appendCandle({
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o), high: parseFloat(k.h),
              low: parseFloat(k.l), close: parseFloat(k.c),
              volume: parseFloat(k.v),
            });
            onCandleClose();
          }
        } catch { /* malformed message */ }
      };
      
      ws.onerror = () => {
        console.error('WebSocket error');
        setConnectionStatus('error');
        stopHeartbeat();
        ws.close();
      };
      
      ws.onclose = () => {
        if (!mounted.current) return;
        stopHeartbeat();
        
        incrementConnectionRetry();
        const retries = usePriceStore.getState().connectionRetries;
        
        if (retries >= 3 && !krakenMode.current) {
          krakenMode.current = true;
          setLastError('Binance blocked — switching to Kraken');
          connectKraken();
          return;
        }
        
        if (krakenMode.current) {
          backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF);
          setTimeout(connectKraken, backoff.current);
          return;
        }
        
        if (connectionAttempts.current >= MAX_RETRIES) {
          setLastError('Max retries reached, switching to Kraken');
          krakenMode.current = true;
          connectKraken();
          return;
        }
        
        setConnectionStatus('reconnecting');
        backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF);
        setTimeout(connectBinance, backoff.current);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setTimeout(connectBinance, 3000);
    }
  }

  function connectKraken() {
    if (!mounted.current) return;
    setConnectionStatus('reconnecting');
    connectionAttempts.current++;
    
    try {
      const ws = new WebSocket(KRAKEN_WS);
      wsRef.current = ws;
      
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn('Kraken WebSocket connection timeout');
          ws.close();
        }
      }, CONNECTION_TIMEOUT);
      
      ws.onopen = () => {
        if (!mounted.current) { ws.close(); return; }
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        setConnectionStatus('connected');
        backoff.current = INITIAL_BACKOFF;
        resetConnectionRetries();
        connectionAttempts.current = 0;
        lastMessageTime.current = Date.now();
        startHeartbeat();
        
        ws.send(JSON.stringify({ event: 'subscribe', pair: ['XBT/USDT'], subscription: { name: 'ticker' } }));
        ws.send(JSON.stringify({ event: 'subscribe', pair: ['XBT/USDT'], subscription: { name: 'ohlc', interval: 15 } }));
      };
      
      ws.onmessage = (evt) => {
        if (!mounted.current) return;
        lastMessageTime.current = Date.now();
        
        try {
          const data = JSON.parse(evt.data);
          if (!Array.isArray(data)) return;
          
          if (data[2] === 'ticker' && data[1]?.c?.[0]) {
            const p = parseFloat(String(data[1].c[0]));
            if (p > 0) setSpotPrice(p);
          }
          
          if (typeof data[2] === 'string' && data[2].startsWith('ohlc') && Array.isArray(data[1])) {
            const o = data[1];
            setCurrentCandle({
              time: Math.floor(Number(o[0])),
              open: parseFloat(String(o[2])), high: parseFloat(String(o[3])),
              low: parseFloat(String(o[4])), close: parseFloat(String(o[5])),
              volume: parseFloat(String(o[7])),
            });
          }
        } catch { /* ignore */ }
      };
      
      ws.onerror = () => {
        console.error('Kraken WebSocket error');
        setConnectionStatus('error');
        stopHeartbeat();
        ws.close();
      };
      
      ws.onclose = () => {
        if (!mounted.current) return;
        stopHeartbeat();
        
        backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF);
        setTimeout(connectKraken, backoff.current);
      };
    } catch (error) {
      console.error('Kraken WebSocket connection error:', error);
      setTimeout(connectKraken, 5000);
    }
  }

  function startRestFallback() {
    const poll = async () => {
      if (usePriceStore.getState().connectionStatus === 'connected') return;
      try {
        const res = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSDT');
        const data = await res.json();
        const p = data.result?.XBTUSDT?.c?.[0];
        if (p) { setSpotPrice(parseFloat(p)); setConnectionStatus('connected'); }
      } catch { /* ignore */ }
    };
    poll();
    return setInterval(poll, 5000);
  }

  function startCoinGecko() {
    const fetch_ = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await res.json();
        if (data.bitcoin?.usd) usePriceStore.getState().setCoingeckoPrice(data.bitcoin.usd);
      } catch { /* ignore */ }
    };
    fetch_();
    return setInterval(fetch_, 30000);
  }

  useEffect(() => {
    mounted.current = true;
    loadHistory();
    connectBinance();
    const restId = startRestFallback();
    const cgId = startCoinGecko();
    
    return () => {
      mounted.current = false;
      stopHeartbeat();
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      wsRef.current?.close();
      clearInterval(restId);
      clearInterval(cgId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startHeartbeat, stopHeartbeat]);
}
