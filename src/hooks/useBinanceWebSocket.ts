// /src/hooks/useBinanceWebSocket.ts — Combined stream with 1m kline for real-time candle updates
'use client';
import { useEffect } from 'react';
import { usePriceStore } from '../stores/priceStore';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

let socket: WebSocket | null = null;

export function connectBTC(onPrice: (price: number) => void, onCandle: (candle: Candle) => void) {
  if (socket) return;

  // Combined stream: trade for price, 1m kline for currentCandle updates
  socket = new WebSocket("wss://stream.binance.com:9443/stream?streams=btcusdt@trade/btcusdt@kline_1m");

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.stream === 'btcusdt@trade') {
      // Trade stream - price update
      const price = parseFloat(data.data.p);
      onPrice(price);
    } else if (data.stream === 'btcusdt@kline_1m') {
      // 1m kline stream - currentCandle update
      const kline = data.data.k;
      const candle: Candle = {
        time: kline.t,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
        volume: parseFloat(kline.v)
      };
      onCandle(candle);
    }
  };

  socket.onclose = () => {
    socket = null;
    setTimeout(() => connectBTC(onPrice, onCandle), 2000);
  };
}

export function useBinanceWebSocket() {
  const { setSpotPrice, setCurrentCandle, setConnectionStatus } = usePriceStore();

  useEffect(() => {
    setConnectionStatus('connected');

    connectBTC((price) => {
      setSpotPrice(price);
    }, (candle) => {
      setCurrentCandle(candle);
    });

    return () => {
      if (socket) {
        socket.close();
        socket = null;
      }
    };
  }, [setSpotPrice, setCurrentCandle, setConnectionStatus]);
}
