interface LongPressCardProps {
  textureId: string;
  onClose: () => void;
}

export function LongPressCard({ textureId, onClose }: LongPressCardProps) {
  return (
    <div className="long-press-overlay" onClick={onClose}>
      <div className="long-press-card">
        <img
          src={`/cards/${textureId}.png`}
          alt="Card"
          style={{ width: "100%", height: "100%", borderRadius: 8 }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <p className="long-press-hint">Tap to close</p>
    </div>
  );
}
