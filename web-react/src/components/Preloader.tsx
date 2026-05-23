import { createContext, useContext, useMemo, useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { CardUVs, getCardUVs } from '../cards/cardAtlas';

const CARDS_PATH = `${import.meta.env.BASE_URL}cards/`;
const ATLAS_URL = import.meta.env.DEV
  ? `${CARDS_PATH}atlas.webp?v=${Date.now()}`
  : `${CARDS_PATH}atlas.webp`;

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

    return {
      atlas,
      getUVs: getCardUVs,
    };
  }, [atlas]);

  useEffect(() => {
    return () => atlas.dispose();
  }, [atlas]);

  return <TextureContext.Provider value={contextValue}>{children}</TextureContext.Provider>;
}
