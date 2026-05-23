import { CARD_COLS, CARD_ROWS, getCardCssBackgroundPosition } from '../cards/cardAtlas';

interface LongPressCardProps {
  textureId: string;
  onClose: () => void;
}

export function LongPressCard({ textureId, onClose }: LongPressCardProps) {
  return (
    <div className="long-press-overlay" onClick={onClose}>
      <div className="long-press-card">
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundImage: "url('/cards/atlas.webp')",
            backgroundSize: `${CARD_COLS * 100}% ${CARD_ROWS * 100}%`,
            backgroundPosition: getCardCssBackgroundPosition(textureId),
            borderRadius: 8,
          }}
        />
      </div>
      <p className="long-press-hint">Tap to close</p>
    </div>
  );
}
