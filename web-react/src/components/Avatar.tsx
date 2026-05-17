import { useMemo } from "react";

const AVATAR_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#e67e22", "#34495e",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const { bg, initials } = useMemo(() => {
    const idx = hashName(name) % AVATAR_COLORS.length;
    const parts = name.trim().split(/\s+/);
    const ini = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
    return { bg: AVATAR_COLORS[idx], initials: ini };
  }, [name]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        color: "#fff",
        textShadow: "0 1px 3px rgba(0,0,0,0.4)",
        flexShrink: 0,
        fontFamily: "Inter, system-ui, sans-serif",
        letterSpacing: "0.02em",
      }}
      title={name}
    >
      {initials}
    </div>
  );
}
