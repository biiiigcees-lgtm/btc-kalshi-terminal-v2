export function executionTimingModel({
  probability,
  closes,
  volumes
}: {
  probability: number;
  closes: number[];
  volumes: number[];
}) {
  const last = closes[closes.length - 1];

  // --- Momentum (last 3 candles acceleration)
  const momentum =
    (closes[closes.length - 1] - closes[closes.length - 2]) +
    (closes[closes.length - 2] - closes[closes.length - 3]);

  // --- Late move detection (avoid chasing)
  const moveSize = Math.abs(
    closes[closes.length - 1] - closes[closes.length - 5]
  );

  // --- Volume confirmation
  const avgVol =
    volumes.slice(0, -1).reduce((a, b) => a + b, 0) / volumes.length;

  const volumeSpike = volumes[volumes.length - 1] > avgVol * 1.2;

  // --- Entry conditions
  const goodMomentum = Math.abs(momentum) > 0;
  const notLateMove = moveSize < last * 0.003; // <0.3% move already happened

  let entry = false;
  let timing = "WAIT";

  if (probability > 0.6 && goodMomentum && volumeSpike && notLateMove) {
    entry = true;
    timing = "ENTER NOW";
  }

  if (probability < 0.4 && goodMomentum && volumeSpike && notLateMove) {
    entry = true;
    timing = "ENTER NOW";
  }

  if (!notLateMove) {
    timing = "TOO LATE";
  }

  if (!volumeSpike) {
    timing = "WEAK VOLUME";
  }

  return {
    entry,
    timing,
    momentum,
    volumeSpike,
    moveSize
  };
}
