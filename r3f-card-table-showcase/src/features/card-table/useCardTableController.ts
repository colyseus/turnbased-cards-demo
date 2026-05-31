import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invalidate } from '@react-three/fiber';
import { audio } from '../../ProceduralAudio';
import { disposeCache } from '../../components/Card3D';
import { computeCardTarget, generateDeck } from './model';
import type { CardData, CardLayout, CardLocation, ToastRef } from './types';

export function useCardTableController() {
  const [cards, setCards] = useState<CardData[]>(generateDeck());
  const [isFaceDown, setIsFaceDown] = useState(false);
  const [feltTheme, setFeltTheme] = useState('theme-emerald');
  const [isMuted, setIsMuted] = useState(audio.isMuted);
  const [isShuffling, setIsShuffling] = useState(false);
  const toastRef = useRef<ToastRef>(null);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));

  const cardLayout = useMemo<CardLayout>(() => {
    if (viewportWidth <= 640) {
      return { fanWidth: 2.1, arcHeight: 0.1, maxTilt: 0.05, handY: -3.24, pileY: -0.04, pileScale: 0.5, deckX: -0.95, discardX: 0.95 };
    }

    if (viewportWidth <= 900) {
      return { fanWidth: 3.45, arcHeight: 0.16, maxTilt: 0.09, handY: -3.32, pileY: 0.02, pileScale: 0.56, deckX: -1.08, discardX: 1.08 };
    }

    return { fanWidth: 5.1, arcHeight: 0.24, maxTilt: 0.14, handY: -3.45, pileY: 0, pileScale: 0.66666, deckX: -1.2, discardX: 1.2 };
  }, [viewportWidth]);

  const showToast = useCallback((msg: string) => {
    setTimeout(() => {
      toastRef.current?.show(msg);
    }, 0);
  }, []);

  const toggleMute = useCallback(() => {
    const nextMuted = !audio.isMuted;
    audio.setMute(nextMuted);
    setIsMuted(nextMuted);
  }, []);

  const flipHand = useCallback(() => {
    audio.playTones();
    setIsFaceDown((prev) => {
      showToast(!prev ? 'Flipped hand face down' : 'Flipped hand face up');
      return !prev;
    });
    invalidate();
  }, [showToast]);

  const shuffleDeck = useCallback(() => {
    if (isShuffling) return;

    audio.playSwoosh();
    setIsShuffling(true);
    showToast('Shuffling deck...');
    invalidate();

    setTimeout(() => {
      setCards((current) => {
        const deck = current.filter((card) => card.location === 'deck');
        const hand = current.filter((card) => card.location !== 'deck');
        deck.sort(() => Math.random() - 0.5);
        deck.forEach((card, index) => {
          card.index = index;
        });
        return [...deck, ...hand];
      });
      setIsShuffling(false);
      showToast('Deck shuffled');
      invalidate();
    }, 1250);
  }, [isShuffling, showToast]);

  const drawCard = useCallback(() => {
    setCards((current) => {
      const deckCards = current.filter((card) => card.location === 'deck').sort((a, b) => b.index - a.index);
      if (deckCards.length === 0) return current;

      audio.playClick();
      const cardToDraw = deckCards[0];

      const colors = ['red', 'blue', 'green', 'yellow'];
      const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];
      let textureName = `${randomColor}_${randomNumber}`;
      if (Math.random() > 0.9) textureName = 'wild';
      if (Math.random() > 0.95) textureName = 'wild_draw4';

      showToast(`Drew card: ${randomNumber} of ${randomColor}`);
      invalidate();

      return current.map((card) => (card.id === cardToDraw.id ? { ...card, location: 'hand' as CardLocation, textureName } : card));
    });
  }, [showToast]);

  const handleCardDrop = useCallback((id: string, x: number) => {
    if (x > 1.0) {
      audio.playClick();
      setCards((current) => {
        const discardCount = current.filter((card) => card.location === 'discard').length;
        return current.map((card) => (card.id === id ? { ...card, location: 'discard' as CardLocation, index: discardCount } : card));
      });
      showToast('Played card');
      invalidate();
    }
  }, [showToast]);

  const resetTable = useCallback(() => {
    disposeCache();
    setCards(generateDeck());
    setIsFaceDown(true);
    showToast('Game table reset');
    invalidate();
  }, [showToast]);

  const handleMint = useCallback((theme: string, rank: string) => {
    const symbolMap: Record<string, string> = { hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣' };
    audio.playSwoosh();
    setCards((current) => {
      const newCard: CardData = {
        id: `minted-${Date.now()}`,
        suit: theme,
        rank: rank.substring(0, 2),
        symbol: symbolMap[theme] || '',
        location: 'hand',
        index: current.length,
      };
      return [...current, newCard];
    });
    showToast(`Minted ${rank} of ${theme}`);
    invalidate();
  }, [showToast]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    audio.setVolume(parseFloat(e.target.value));
  }, []);

  const deckCount = useMemo(() => cards.filter((card) => card.location === 'deck').length, [cards]);
  const topDeckCardId = useMemo(() => {
    const deckCards = cards.filter((card) => card.location === 'deck');
    return deckCards.length > 0 ? deckCards[deckCards.length - 1].id : null;
  }, [cards]);

  const cardTargets = useMemo(() => {
    const targets = new Map<string, ReturnType<typeof computeCardTarget>>();
    for (const card of cards) {
      targets.set(card.id, computeCardTarget(card, cards, isFaceDown, cardLayout));
    }
    return targets;
  }, [cardLayout, cards, isFaceDown]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      shuffleDeck();
    }, 10);

    return () => {
      clearTimeout(timeout);
      disposeCache();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key.toLowerCase() === 'f') flipHand();
      if (e.key.toLowerCase() === 'd') drawCard();
      if (e.key.toLowerCase() === 's') shuffleDeck();
      if (e.key.toLowerCase() === 'r') resetTable();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawCard, flipHand, resetTable, shuffleDeck]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      invalidate();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    cards,
    cardTargets,
    deckCount,
    cardLayout,
    feltTheme,
    flipHand,
    handleCardDrop,
    handleMint,
    handleVolumeChange,
    isFaceDown,
    isMuted,
    isShuffling,
    resetTable,
    setFeltTheme,
    shuffleDeck,
    toastRef,
    topDeckCardId,
    toggleMute,
    drawCard,
  };
}

export type CardTableController = ReturnType<typeof useCardTableController>;
