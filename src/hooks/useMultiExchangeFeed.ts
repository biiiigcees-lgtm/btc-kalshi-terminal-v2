// /src/hooks/useMultiExchangeFeed.ts
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { usePriceStore } from '../stores/priceStore';

// Exchange WebSocket URLs
const EXCHANGE_WS = {
  binance: 'wss://stream.binance.com:9443/ws/btcusdt@ticker',
  kraken: 'wss://ws.kraken.com/',
  coinbase: 'wss://ws-feed.exchange.coinbase.com',
};

interface ExchangePrice {
  exchange: string;
  price: number;
  timestamp: number;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'stale' | 'error';

export interface ExchangeStatus {
  exchange: string;
  status: ConnectionStatus;
  lastPrice: number | null;
  lastUpdate: number;
  errorCount: number;
}

const STALE_THRESHOLD_MS = 15000; // 15 seconds
const MAX_ERRORS_BEFORE_BACKOFF = 5;

export function useMultiExchangeFeed() {
  const { setSpotPrice, setCoingeckoPrice } = usePriceStore();
  const wsRefs = useRef<{ [key: string]: WebSocket | null }>({
    binance: null,
    kraken: null,
    coinbase: null,
  });
  const pricesRef = useRef<{ [key: string]: ExchangePrice }>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [exchangeStatus, setExchangeStatus] = useState<Record<string, ExchangeStatus>>({
    binance: { exchange: 'binance', status: 'disconnected', lastPrice: null, lastUpdate: 0, errorCount: 0 },
    kraken: { exchange: 'kraken', status: 'disconnected', lastPrice: null, lastUpdate: 0, errorCount: 0 },
    coinbase: { exchange: 'coinbase', status: 'disconnected', lastPrice: null, lastUpdate: 0, errorCount: 0 },
  });
  const errorCounts = useRef<{ [key: string]: number }>({ binance: 0, kraken: 0, coinbase: 0 });

  const updateExchangeStatus = useCallback((exchange: string, updates: Partial<ExchangeStatus>) => {
    setExchangeStatus(prev => ({
      ...prev,
      [exchange]: { ...prev[exchange], ...updates, exchange }
    }));
  }, []);

  const checkStaleness = useCallback(() => {
    const now = Date.now();
    setExchangeStatus(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(exchange => {
        const status = updated[exchange];
        if (status.status === 'connected' && now - status.lastUpdate > STALE_THRESHOLD_MS) {
          updated[exchange] = { ...status, status: 'stale' };
        }
      });
      return updated;
    });
  }, []);

  useEffect(() => {
    // Connect to Kraken (most reliable, no geo-restrictions)
    connectKraken();
    
    // Try Binance as backup
    connectBinance();
    
    // Aggregate prices every second
    intervalRef.current = setInterval(aggregatePrices, 1000);
    
    // Check for stale connections every 5 seconds
    const stalenessInterval = setInterval(checkStaleness, 5000);

    return () => {
      Object.values(wsRefs.current).forEach(ws => ws?.close());
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(stalenessInterval);
    };
  }, [checkStaleness]);

  function connectKraken() {
    try {
      updateExchangeStatus('kraken', { status: 'disconnected' });
      const ws = new WebSocket(EXCHANGE_WS.kraken);
      wsRefs.current.kraken = ws;

      ws.onopen = () => {
        updateExchangeStatus('kraken', { status: 'connected', errorCount: 0 });
        errorCounts.current.kraken = 0;
        ws.send(JSON.stringify({
          event: 'subscribe',
          pair: ['XBT/USDT'],
          subscription: { name: 'ticker' }
        }));
      };

      ws.onmessage = (evt) => {
        const data = JSON.parse(evt.data);
        if (Array.isArray(data) && data.length > 1 && data[1]?.c) {
          const price = parseFloat(data[1].c[0]);
          const timestamp = Date.now();
          pricesRef.current.kraken = {
            exchange: 'kraken',
            price,
            timestamp,
          };
          updateExchangeStatus('kraken', { 
            lastPrice: price, 
            lastUpdate: timestamp,
            status: 'connected'
          });
        }
      };

      ws.onerror = () => {
        errorCounts.current.kraken++;
        updateExchangeStatus('kraken', { 
          status: 'error',
          errorCount: errorCounts.current.kraken
        });
        ws.close();
      };
      
      ws.onclose = () => {
        updateExchangeStatus('kraken', { status: 'disconnected' });
        // Exponential backoff based on error count
        const backoff = Math.min(5000 * Math.pow(2, errorCounts.current.kraken), 60000);
        setTimeout(connectKraken, backoff);
      };
    } catch (e) {
      console.error('Kraken connection failed:', e);
      updateExchangeStatus('kraken', { status: 'error' });
    }
  }

  function connectBinance() {
    try {
      updateExchangeStatus('binance', { status: 'disconnected' });
      const ws = new WebSocket(EXCHANGE_WS.binance);
      wsRefs.current.binance = ws;

      ws.onopen = () => {
        updateExchangeStatus('binance', { status: 'connected', errorCount: 0 });
        errorCounts.current.binance = 0;
      };

      ws.onmessage = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.c) {
          const price = parseFloat(data.c);
          const timestamp = Date.now();
          pricesRef.current.binance = {
            exchange: 'binance',
            price,
            timestamp,
          };
          updateExchangeStatus('binance', { 
            lastPrice: price, 
            lastUpdate: timestamp,
            status: 'connected'
          });
        }
      };

      ws.onerror = () => {
        errorCounts.current.binance++;
        updateExchangeStatus('binance', { 
          status: 'error',
          errorCount: errorCounts.current.binance
        });
        ws.close();
        wsRefs.current.binance = null;
      };
      
      ws.onclose = () => {
        updateExchangeStatus('binance', { status: 'disconnected' });
        // Exponential backoff
        const backoff = Math.min(5000 * Math.pow(2, errorCounts.current.binance), 60000);
        setTimeout(connectBinance, backoff);
      };
    } catch (e) {
      console.error('Binance connection failed:', e);
      updateExchangeStatus('binance', { status: 'error' });
    }
  }

  function aggregatePrices() {
    const prices = Object.values(pricesRef.current).filter(
      p => p && Date.now() - p.timestamp < 10000 // Only use prices < 10s old
    );

    if (prices.length === 0) return;

    // Calculate VWAP (volume-weighted, but we don't have volume, so simple median)
    const sortedPrices = prices.map(p => p.price).sort((a, b) => a - b);
    const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
    
    // Use Kraken as primary if available, otherwise median
    const krakenPrice = pricesRef.current.kraken?.price;
    const primaryPrice = krakenPrice || medianPrice;

    setSpotPrice(primaryPrice);

    // Calculate spread/divergence across exchanges
    if (prices.length >= 2) {
      const minPrice = Math.min(...prices.map(p => p.price));
      const maxPrice = Math.max(...prices.map(p => p.price));
      const spread = ((maxPrice - minPrice) / minPrice) * 100;
      
      // If spread > 0.1%, log warning
      if (spread > 0.1) {
        console.warn(`Exchange divergence: ${spread.toFixed(3)}%`);
      }
    }

    // Set CoinGecko price as secondary reference (using median as proxy)
    setCoingeckoPrice(medianPrice);
  }

  // Get overall health status
  const getHealthStatus = useCallback(() => {
    const statuses = Object.values(exchangeStatus);
    const connected = statuses.filter(s => s.status === 'connected').length;
    const stale = statuses.filter(s => s.status === 'stale').length;
    const disconnected = statuses.filter(s => s.status === 'disconnected').length;
    
    if (connected >= 1) return { status: 'healthy', color: '#00ff88' };
    if (stale >= 1) return { status: 'degraded', color: '#ffaa00' };
    return { status: 'unhealthy', color: '#ff4466' };
  }, [exchangeStatus]);

  return {
    getExchangePrices: () => pricesRef.current,
    exchangeStatus,
    getHealthStatus,
    isPriceStale: (exchange: string) => {
      const status = exchangeStatus[exchange];
      if (!status) return true;
      return status.status === 'stale' || Date.now() - status.lastUpdate > STALE_THRESHOLD_MS;
    },
  };
}
