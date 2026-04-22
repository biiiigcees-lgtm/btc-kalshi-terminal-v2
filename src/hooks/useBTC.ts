import { useEffect, useState } from "react";
import { connectBTC } from "@/lib/btcSocket";

export function useBTC() {
  const [price, setPrice] = useState<number | null>(null);
  const [signal, setSignal] = useState<any>(null);

  useEffect(() => {
    connectBTC(setPrice);

    const interval = setInterval(async () => {
      const res = await fetch("/api/signal");
      const data = await res.json();
      setSignal(data);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return { price, signal };
}
