import type { ReactNode } from "react";

interface LobbyShellProps {
  children: ReactNode;
}

export function LobbyShell({ children }: LobbyShellProps) {
  return <main className="lobby-shell">{children}</main>;
}
