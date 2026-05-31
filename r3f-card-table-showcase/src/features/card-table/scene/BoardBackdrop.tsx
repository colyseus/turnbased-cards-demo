import React from 'react';

interface BoardBackdropProps {
  feltTheme: string;
  children: React.ReactNode;
}

export function BoardBackdrop({ feltTheme, children }: BoardBackdropProps) {
  return (
    <div className={`game-board ${feltTheme}`} id="game-board" style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <div className="felt-base" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
        <div className="felt-texture" />
        <div className="felt-gradient" />
        <div className="felt-decorations" />
      </div>

      <div className="table-rail top" style={{ zIndex: 1 }} />
      <div className="table-rail bottom" style={{ zIndex: 1 }} />
      <div className="table-rail left" style={{ zIndex: 1 }} />
      <div className="table-rail right" style={{ zIndex: 1 }} />

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', zIndex: 2, pointerEvents: 'none' }}>
        <div className="player-hand-container" id="player-hand" style={{ width: '544px', height: '200px', marginBottom: '24px', pointerEvents: 'auto' }} />
      </div>

      {children}
    </div>
  );
}
