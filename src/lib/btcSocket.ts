let socket: WebSocket | null = null;

export function connectBTC(onPrice: (price: number) => void) {
  if (socket) return;

  socket = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const price = parseFloat(data.p);
    onPrice(price);
  };

  socket.onclose = () => {
    socket = null;
    setTimeout(() => connectBTC(onPrice), 2000);
  };
}
