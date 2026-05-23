export function getVisualPosition(seatIndex: number, localSeatIndex: number): number {
  return (seatIndex - localSeatIndex + 4) % 4;
}

export function hashRotation(id: string, index: number): number {
  let h = index * 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h % 40) - 20) * (Math.PI / 180);
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
