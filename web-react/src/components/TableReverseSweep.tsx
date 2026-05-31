interface TableReverseSweepProps {
  showReverseSweep: boolean;
  direction: number | undefined;
}

export function TableReverseSweep({ showReverseSweep, direction }: TableReverseSweepProps) {
  if (!showReverseSweep) return null;
  return (
    <div
      className={`reverse-sweep-overlay ${direction === -1 ? "ccw" : "cw"}`}
      aria-hidden="true"
    />
  );
}
