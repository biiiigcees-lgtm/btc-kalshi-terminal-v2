import { useBTC } from "@/hooks/useBTC";

export default function BTCSignal() {
  const { price, signal } = useBTC();

  return (
    <div>
      <h1>BTC: {price ? price.toFixed(2) : "Loading..."}</h1>

      {signal && (
        <div>
          <h2>{signal.decision}</h2>
          <p>Probability: {signal.probability}%</p>
          <p>Confidence: {signal.confidence}</p>
        </div>
      )}
    </div>
  );
}
