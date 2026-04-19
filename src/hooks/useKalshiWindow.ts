// /src/hooks/useKalshiWindow.ts
'use client';
import { useState, useEffect } from 'react';

export function useKalshiWindow() {
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [windowOpenTime, setWindowOpenTime] = useState<Date>(new Date());

  useEffect(() => {
    function tick() {
      const now = new Date();
      const totalSeconds = now.getUTCMinutes() * 60 + now.getUTCSeconds();
      const windowSeconds = 15 * 60;
      const elapsed = totalSeconds % windowSeconds;
      const remaining = windowSeconds - elapsed;
      setSecondsRemaining(remaining);
      if (elapsed === 0) {
        setWindowOpenTime(now);
      }
    }
    const interval = setInterval(tick, 1000);
    tick();
    return () => clearInterval(interval);
  }, []);

  return { secondsRemaining, windowOpenTime };
}
