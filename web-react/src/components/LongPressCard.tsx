const COLS = 10;
const ROWS = 6;

// This must match the order in Preloader.tsx
const COLORS = ['red', 'blue', 'green', 'yellow'] as const;
const NUMBERS = ['0','1','2','3','4','5','6','7','8','9'] as const;
const ACTIONS = ['skip', 'reverse', 'draw2'] as const;
const ALL_IDS: string[] = [];
for (const color of COLORS) {
  for (const n of NUMBERS) ALL_IDS.push(`${color}_${n}`);
  for (const a of ACTIONS) ALL_IDS.push(`${color}_${a}`);
}
ALL_IDS.push('wild');
ALL_IDS.push('wild_draw4');
ALL_IDS.push('back');

interface LongPressCardProps {
  textureId: string;
  onClose: () => void;
}

export function LongPressCard({ textureId, onClose }: LongPressCardProps) {
  const index = Math.max(0, ALL_IDS.indexOf(textureId));
  const row = Math.floor(index / COLS);
  const col = index % COLS;

  const x = (col * 100) / (COLS - 1);
  const y = (row * 100) / (ROWS - 1);

  return (
    <div className="long-press-overlay" onClick={onClose}>
      <div className="long-press-card">
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundImage: "url('/cards/atlas.webp')",
            backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
            backgroundPosition: `${x}% ${y}%`,
            borderRadius: 8,
          }}
        />
      </div>
      <p className="long-press-hint">Tap to close</p>
    </div>
  );
}
