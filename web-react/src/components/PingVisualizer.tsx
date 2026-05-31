function PingVisualizer({ ping }: { ping: number | null }) {
  if (ping === null) return null;
  const status = ping < 100 ? "excellent" : ping < 250 ? "good" : "poor";
  return (
    <div className={`ping-indicator ${status}`} title={`WebSocket latency RTT: ${ping}ms`}>
      <div className="ping-bars">
        <div className="ping-bar" />
        <div className="ping-bar" />
        <div className="ping-bar" />
      </div>
      <span>{ping}ms ping</span>
    </div>
  );
}

export { PingVisualizer };
