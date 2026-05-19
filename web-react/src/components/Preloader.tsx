import { createContext, useContext, useMemo, useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';

const CARDS_PATH = `${import.meta.env.BASE_URL}cards/`;
const COLORS = ['red', 'blue', 'green', 'yellow'] as const;
const NUMBERS = ['0','1','2','3','4','5','6','7','8','9'] as const;
const ACTIONS = ['skip', 'reverse', 'draw2'] as const;

// All unique card texture filenames (without path/extension)
const ALL_IDS: string[] = [];
for (const color of COLORS) {
  for (const n of NUMBERS) ALL_IDS.push(`${color}_${n}`);
  for (const a of ACTIONS) ALL_IDS.push(`${color}_${a}`);
}
ALL_IDS.push('wild');
ALL_IDS.push('wild_draw4');
ALL_IDS.push('back');

const ATLAS_URL = import.meta.env.DEV
  ? `${CARDS_PATH}atlas.webp?v=${Date.now()}`
  : `${CARDS_PATH}atlas.webp`;
const COLS = 10;
const ROWS = 6;

export interface CardUVs {
  u: number;
  v: number;
  w: number;
  h: number;
}

interface TextureContextValue {
  atlas: THREE.Texture;
  getUVs: (_: string) => CardUVs;
}

const TextureContext = createContext<TextureContextValue | null>(null);

export function useCardAtlas() {
  const ctx = useContext(TextureContext);
  if (!ctx) throw new Error('useCardAtlas must be used within TextureProvider');
  return ctx;
}

/** Loads the card texture atlas and provides UV mapping. */
export function TextureProvider({ children }: { children: React.ReactNode }) {
  const atlas = useLoader(THREE.TextureLoader, ATLAS_URL);

  const contextValue = useMemo(() => {
    atlas.minFilter = THREE.LinearFilter;
    atlas.magFilter = THREE.LinearFilter;
    atlas.flipY = false;

    const uvMap = new Map<string, CardUVs>();
    ALL_IDS.forEach((id, i) => {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      uvMap.set(id, {
        u: col / COLS,
        v: 1 - (row + 1) / ROWS,
        w: 1 / COLS,
        h: 1 / ROWS,
      });
    });

    return {
      atlas,
      getUVs: (id: string) => uvMap.get(id) || uvMap.get('back')!,
    };
  }, [atlas]);

  useEffect(() => {
    return () => atlas.dispose();
  }, [atlas]);

  return (
    <TextureContext.Provider value={contextValue}>
      {children}
    </TextureContext.Provider>
  );
}
