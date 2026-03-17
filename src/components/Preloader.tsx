import { createContext, useContext, useMemo } from 'react';
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

const ALL_URLS = ALL_IDS.map(id => `${CARDS_PATH}${id}.png`);

// Context holds a map from textureId → THREE.Texture
const TextureContext = createContext<Map<string, THREE.Texture>>(new Map());

export function useCardTexture(textureId: string): THREE.Texture {
  const map = useContext(TextureContext);
  return map.get(textureId)!;
}

/** Loads all card textures during Suspense, then provides them via context. */
export function TextureProvider({ children }: { children: React.ReactNode }) {
  const textures = useLoader(THREE.TextureLoader, ALL_URLS);

  // Build lookup map once — stable reference, no re-renders for consumers
  const map = useMemo(() => {
    const m = new Map<string, THREE.Texture>();
    ALL_IDS.forEach((id, i) => {
      const tex = textures[i];
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      m.set(id, tex);
    });
    return m;
  }, [textures]);

  return (
    <TextureContext.Provider value={map}>
      {children}
    </TextureContext.Provider>
  );
}
