import type { ReactNode } from "react";

interface TableShellProps {
  children: ReactNode;
}

export function TableShell({ children }: TableShellProps) {
  return <main className="game-shell">{children}</main>;
}
