import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";
import type { ActionBubble } from "./PlayerStrip";
import { sfx } from "../audio/sfx";
import { AVATAR_SYMBOLS, AVATAR_THEMES } from "../tableConfig";
import { cardLabel, isPlayable, localPlayer, parsePlayerName, statePlayers } from "../gameHelpers";
import { updateStats } from "../stats";
import { useDialogFocus } from "../hooks/useDialogFocus";
import { getHandLayout, getTutorialCards } from "./tableRoomModel";
import { getCloseTutorialSnapshot } from "./tableRoomOverlayFlow";
import { readStorage, writeStorage } from "../storage";
import {
  buildActionCallout,
  buildGuidanceState,
  buildMeSummary,
  buildRosterEntries,
  getActivePlayerThemeColor,
  getSpotlightPos,
  isTutorialCompleteFlagSet,
  sortHand,
} from "./tableRoomControllerLogic";
import type { CardSchema, Toast, UnoColor, UnoState } from "../gameTypes";

export interface TableRoomControllerProps {
  room: Room<UnoState> | null;
  state: UnoState | null;
  onLeave: () => void;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
  showToast: (message: string, kind?: Toast["kind"]) => void;
  disconnected: boolean;
}

interface CardFlight {
  id: string;
  card: CardSchema | null;
  isBack: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  rotation: number;
  animating: boolean;
}

interface TurnBanner {
  name: string;
  emoji: string;
  themeColor: string;
}

interface ParticleData {
  id: string;
  x: number;
  y: number;
  emoji: string;
  tx: string;
  ty: string;
  tr: string;
}

export function useTableRoomController(props: TableRoomControllerProps) {
  const { room, state, showToast } = props;
  const me = localPlayer(room, state);
  const players = statePlayers(state);
  const discardPile = state?.discardPile ?? [];
  const topCard = discardPile[discardPile.length - 1] ?? null;

  const [sortBy, setSortBy] = useState<"none" | "color" | "value">("color");
  const hand = sortHand(me?.hand ?? [], sortBy);

  const [wildFor, setWildFor] = useState<CardSchema | null>(null);
  const [chatText, setChatText] = useState("");
  const currentPlayer = players.find((player) => player.seatIndex === state?.currentPlayer);
  const currentPlayerLabel = currentPlayer ? parsePlayerName(currentPlayer.name).name : "Waiting";
  const activePlayerThemeColor = useMemo(() => getActivePlayerThemeColor(currentPlayer), [currentPlayer]);
  const meSummary = buildMeSummary(me, state?.spectatorCount ?? 0);
  const rosterEntries = buildRosterEntries(players, me?.sessionId, state?.currentPlayer);
  const isMyTurn = !!me && me.seatIndex === state?.currentPlayer && state?.winner === -1;
  const spotlightPos = useMemo(
    () =>
      getSpotlightPos({
        isMyTurn,
        players,
        meSessionId: me?.sessionId,
        currentPlayerSeat: state?.currentPlayer,
      }),
    [isMyTurn, players, me?.sessionId, state?.currentPlayer],
  );

  const hasOneCardWarning = useMemo(
    () => players.some((p) => (p.handCount ?? p.hand?.length ?? 0) === 1),
    [players],
  );
  const roomCode = room?.roomId ?? "Room";
  const tableReady = Boolean(topCard);

  const [ping, setPing] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(() => {
    return isTutorialCompleteFlagSet({ getItem: (key) => readStorage(key) }) ? -1 : 0;
  });
  const [cardAlert, setCardAlert] = useState<string | null>(null);
  const [particles, setParticles] = useState<ParticleData[]>([]);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number>(-1);
  const [flights, setFlights] = useState<CardFlight[]>([]);
  const [actionBubbles, setActionBubbles] = useState<ActionBubble[]>([]);
  const [turnBanner, setTurnBanner] = useState<TurnBanner | null>(null);
  const [skippedSeatIndex, setSkippedSeatIndex] = useState<number>(-1);
  const [showReverseSweep, setShowReverseSweep] = useState<boolean>(false);
  const [botEmotions, setBotEmotions] = useState<Record<number, string>>({});
  const [shockwaves, setShockwaves] = useState<{ id: string; color: string }[]>([]);
  const [cardBackTheme, setCardBackTheme] = useState<string>(() => {
    return readStorage("uno_card_back_skin") || "classic";
  });

  const prevCurrentPlayer = useRef<number>(-1);
  const prevDiscardPile = useRef<CardSchema[]>([]);
  const prevPlayersHandCounts = useRef<Record<number, number>>({});
  const activeTimers = useRef<Set<number>>(new Set());
  const activeAnimationFrames = useRef<Set<number>>(new Set());

  const handScrollRef = useRef<HTMLDivElement | null>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const rulesDialogRef = useRef<HTMLDivElement | null>(null);
  const wildDialogRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesCount = state?.chatMessages?.length ?? 0;
  const lastChatCount = useRef(0);
  const lastIsMyTurn = useRef(false);
  const matchStartTime = useRef<number | null>(null);
  const lastDiscardCount = useRef(0);
  const lastHandCount = useRef(0);
  const lastWinner = useRef(-1);
  const lastUno = useRef(-1);
  const lastPending = useRef(0);
  const localPlayerCardsPlayed = useRef(0);

  const clearTrackedTimer = useCallback((timerId: number) => {
    window.clearTimeout(timerId);
    window.clearInterval(timerId);
    activeTimers.current.delete(timerId);
  }, []);

  const clearTrackedAnimationFrame = useCallback((frameId: number) => {
    window.cancelAnimationFrame(frameId);
    activeAnimationFrames.current.delete(frameId);
  }, []);

  const trackTimeout = useCallback((handler: () => void, delay: number) => {
    const timerId = window.setTimeout(() => {
      activeTimers.current.delete(timerId);
      handler();
    }, delay);
    activeTimers.current.add(timerId);
    return timerId;
  }, []);

  const trackInterval = useCallback((handler: () => void, delay: number) => {
    const timerId = window.setInterval(handler, delay);
    activeTimers.current.add(timerId);
    return timerId;
  }, []);

  const trackAnimationFrame = useCallback((handler: () => void) => {
    const frameId = window.requestAnimationFrame(() => {
      activeAnimationFrames.current.delete(frameId);
      handler();
    });
    activeAnimationFrames.current.add(frameId);
    return frameId;
  }, []);

  useDialogFocus(showRules, rulesDialogRef);
  useDialogFocus(Boolean(wildFor), wildDialogRef);

  useEffect(() => {
    return () => {
      activeTimers.current.forEach((timerId) => clearTrackedTimer(timerId));
      activeTimers.current.clear();
      activeAnimationFrames.current.forEach((frameId) => clearTrackedAnimationFrame(frameId));
      activeAnimationFrames.current.clear();
    };
  }, [clearTrackedAnimationFrame, clearTrackedTimer]);

  const triggerFlight = useCallback(
    (card: CardSchema | null, isBack: boolean, startElId: string, endElId: string) => {
      const startEl = document.getElementById(startElId);
      const endEl = document.getElementById(endElId);
      if (!startEl || !endEl) return;

      const startRect = startEl.getBoundingClientRect();
      const endRect = endEl.getBoundingClientRect();

      const startX = startRect.left + startRect.width / 2;
      const startY = startRect.top + startRect.height / 2;
      const endX = endRect.left + endRect.width / 2;
      const endY = endRect.top + endRect.height / 2;

      const flightId = `flight-${Date.now()}-${Math.random()}`;
      const newFlight: CardFlight = {
        id: flightId,
        card,
        isBack,
        startX,
        startY,
        endX,
        endY,
        rotation: Math.random() * 90 - 45,
        animating: false,
      };

      setFlights((prev) => [...prev, newFlight]);

      const flightDuration = 600;
      const startTime = Date.now();
      const trailInterval = trackInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= flightDuration) {
          clearTrackedTimer(trailInterval);
          return;
        }
        const t = elapsed / flightDuration;
        const easeT = 1 - Math.pow(1 - t, 3);
        const currX = startX + (endX - startX) * easeT;
        const currY = startY + (endY - startY) * easeT;

        const sparkles = ["✨", "🌟", "💫", "⭐"];
        const emoji = sparkles[Math.floor(Math.random() * sparkles.length)];
        const sparkId = `trail-${Date.now()}-${Math.random()}`;

        setParticles((prev) => [
          ...prev,
          {
            id: sparkId,
            x: currX,
            y: currY,
            emoji,
            tx: `${(Math.random() - 0.5) * 20}px`,
            ty: `${(Math.random() - 0.5) * 20}px`,
            tr: `${(Math.random() - 0.5) * 180}deg`,
          },
        ]);

        trackTimeout(() => {
          setParticles((prev) => prev.filter((p) => p.id !== sparkId));
        }, 550);
      }, 45);

      trackAnimationFrame(() => {
        trackTimeout(() => {
          setFlights((prev) => prev.map((f) => (f.id === flightId ? { ...f, animating: true } : f)));
        }, 20);
      });

      trackTimeout(() => {
        setFlights((prev) => prev.filter((f) => f.id !== flightId));
      }, 650);
    },
    [clearTrackedAnimationFrame, clearTrackedTimer, trackAnimationFrame, trackInterval, trackTimeout],
  );

  const triggerBotEmotion = useCallback((seatIndex: number, emoji: string, duration = 2000) => {
    setBotEmotions((prev) => ({ ...prev, [seatIndex]: emoji }));
    trackTimeout(() => {
      setBotEmotions((prev) => {
        const next = { ...prev };
        delete next[seatIndex];
        return next;
      });
    }, duration);
  }, [trackTimeout]);

  const triggerParticles = (x: number, y: number, count = 20, isWild = false) => {
    const emojis = isWild
      ? ["🟥", "🟦", "🟩", "🟨", "✨", "💥", "🌈", "⭐"]
      : ["✨", "🔥", "🎉", "🌟", "💥", "🃏"];
    const newParticles: ParticleData[] = [];
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = isWild ? 80 + Math.random() * 160 : 60 + Math.random() * 120;
      const tx = `${Math.cos(angle) * distance}px`;
      const ty = `${Math.sin(angle) * distance}px`;
      const tr = `${-180 + Math.random() * 360}deg`;
      newParticles.push({
        id: `particle-${Date.now()}-${Math.random()}-${i}`,
        x,
        y,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        tx,
        ty,
        tr,
      });
    }
    const newParticleIds = new Set(newParticles.map((p) => p.id));
    setParticles((prev) => [...prev, ...newParticles]);
    trackTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticleIds.has(p.id)));
    }, 1200);
  };

  const playCard = useCallback(
    (card: CardSchema, color?: UnoColor) => {
      if (!room) return;
      if (card.cardType === "wild" && !color) {
        setWildFor(card);
        return;
      }
      room.send("play_card", { cardId: card.id, chosenColor: color });
      setWildFor(null);
      setSelectedCardIdx(-1);
    },
    [room],
  );

  const handleUnplayableTap = useCallback(
    (card: CardSchema) => {
      showToast(`Cannot play ${cardLabel(card)} — doesn't match the discard pile.`, "warning");
    },
    [showToast],
  );

  useEffect(() => {
    if (!room) return;
    let lastPingTime = 0;
    const handlePong = () => {
      setPing(Date.now() - lastPingTime);
    };

    const cleanupPong = room.onMessage("pong", handlePong);
    const interval = trackInterval(() => {
      lastPingTime = Date.now();
      room.send("ping");
    }, 3000);

    lastPingTime = Date.now();
    room.send("ping");

    return () => {
      clearTrackedTimer(interval);
      cleanupPong();
    };
  }, [room, clearTrackedTimer, trackInterval]);

  useEffect(() => {
    if (!state) return;

    const playersSnapshot = players;
    const currentDiscard = state.discardPile?.length ?? 0;
    const prevDiscard = prevDiscardPile.current;
    const prevSeat = prevCurrentPlayer.current;
    const currentSeat = state.currentPlayer ?? -1;

    if (currentSeat !== -1 && currentSeat !== prevSeat && state.winner === -1) {
      const activePlayer = playersSnapshot.find((p) => p.seatIndex === currentSeat);
      if (activePlayer) {
        const av = parsePlayerName(activePlayer.name);
        const themeInfo = AVATAR_THEMES.find((t) => t.id === av.theme);
        const emoji = AVATAR_SYMBOLS.find((s) => s.id === av.symbol)?.emoji || "🐯";
        setTurnBanner({
          name: activePlayer.sessionId === room?.sessionId ? "Your Turn" : av.name,
          emoji,
          themeColor: themeInfo ? themeInfo.primary : "var(--gold)",
        });
        trackTimeout(() => setTurnBanner(null), 1200);

        const direction = state.direction ?? 1;
        const totalPlayers = playersSnapshot.length;
        if (prevSeat !== -1 && totalPlayers > 1) {
          const expectedNext = (prevSeat + direction + totalPlayers) % totalPlayers;
          if (expectedNext !== currentSeat) {
            setSkippedSeatIndex(expectedNext);
            trackTimeout(() => setSkippedSeatIndex(-1), 1500);

            const skippedPlayer = playersSnapshot.find((p) => p.seatIndex === expectedNext);
            if (skippedPlayer && skippedPlayer.isBot) {
              triggerBotEmotion(expectedNext, "😱", 2000);
            }
          }
        }
      }
    }

    if (currentDiscard > lastDiscardCount.current && lastDiscardCount.current > 0) {
      sfx.playPluck();

      const top = state.discardPile?.[state.discardPile.length - 1];
      const isWild = top?.cardType === "wild";

      triggerParticles(window.innerWidth / 2, window.innerHeight / 2 - 50, isWild ? 35 : 15, isWild);

      if (me && me.seatIndex === state.currentPlayer) {
        localPlayerCardsPlayed.current += 1;
      }

      if (top) {
        if (top.cardType === "color") {
          if (top.value === "skip") setCardAlert("SKIP!");
          else if (top.value === "reverse") setCardAlert("REVERSE!");
          else if (top.value === "draw2") setCardAlert("+2 DRAW!");
        } else if (top.cardType === "wild") {
          if (top.value === "wild_draw4") setCardAlert("+4 DRAW!");
          else setCardAlert("WILD PLAY!");
        }

        trackTimeout(() => {
          const swColor = top.chosenColor || top.color || "gold";
          const swId = `shockwave-${Date.now()}-${Math.random()}`;
          setShockwaves((prev) => [...prev, { id: swId, color: swColor }]);
          trackTimeout(() => {
            setShockwaves((prev) => prev.filter((sw) => sw.id !== swId));
          }, 800);
        }, 350);

        if (prevSeat !== -1) {
          const playedPlayer = playersSnapshot.find((p) => p.seatIndex === prevSeat);
          if (playedPlayer) {
            const startElId =
              playedPlayer.sessionId === room?.sessionId ? "hand-dock" : `player-pill-${prevSeat}`;
            trackTimeout(() => {
              triggerFlight(top, false, startElId, "discard-pile-anchor");
            }, 50);

            const av = parsePlayerName(playedPlayer.name);
            const themeInfo = AVATAR_THEMES.find((t) => t.id === av.theme);
            const bubbleId = `bubble-${Date.now()}-${Math.random()}`;
            const bubbleText =
              top.cardType === "wild"
                ? top.value === "wild_draw4"
                  ? "Wild +4"
                  : "Wild"
                : cardLabel(top);

            setActionBubbles((prev) => [
              ...prev,
              {
                id: bubbleId,
                seatIndex: prevSeat,
                text: bubbleText,
                themeColor: themeInfo ? themeInfo.primary : "var(--gold)",
              },
            ]);
            trackTimeout(() => {
              setActionBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
            }, 1800);

            if (playedPlayer.isBot) {
              const isAction =
                top.cardType === "wild" ||
                top.value === "skip" ||
                top.value === "reverse" ||
                top.value === "draw2";
              const emotion = isAction ? (top.value === "wild_draw4" ? "😈" : "😎") : "😀";
              triggerBotEmotion(prevSeat, emotion, 2200);
            }
          }
        }

        if (top.cardType === "color" && top.value === "reverse") {
          setShowReverseSweep(true);
          trackTimeout(() => setShowReverseSweep(false), 1500);
          const boardEl = document.querySelector(".table-board");
          if (boardEl) {
            boardEl.classList.add("camera-shake");
            trackTimeout(() => boardEl.classList.remove("camera-shake"), 600);
          }
        }
      }
    }
    lastDiscardCount.current = currentDiscard;

    if (state.phase === "playing" && prevDiscard.length > 0) {
      playersSnapshot.forEach((player) => {
        const prevHandCount = prevPlayersHandCounts.current[player.seatIndex] ?? 0;
        const newHandCount = player.handCount ?? player.hand?.length ?? 0;
        if (newHandCount > prevHandCount) {
          const drawDiff = newHandCount - prevHandCount;
          const targetElId =
            player.sessionId === room?.sessionId ? "hand-dock" : `player-pill-${player.seatIndex}`;

          for (let i = 0; i < drawDiff; i += 1) {
            trackTimeout(() => {
              triggerFlight(null, true, "draw-pile-anchor", targetElId);
            }, i * 120);
          }

          if (drawDiff >= 2) {
            const targetEl = document.getElementById(targetElId);
            if (targetEl) {
              const rect = targetEl.getBoundingClientRect();
              const tx = rect.left + rect.width / 2;
              const ty = rect.top + rect.height / 2;
              const fireEmojis = ["🔥", "💥", "⚡", "😈"];
              const fireList: ParticleData[] = [];
              for (let i = 0; i < 15; i += 1) {
                const sparkId = `fire-${Date.now()}-${Math.random()}-${i}`;
                fireList.push({
                  id: sparkId,
                  x: tx,
                  y: ty,
                  emoji: fireEmojis[Math.floor(Math.random() * fireEmojis.length)],
                  tx: `${(Math.random() - 0.5) * 120}px`,
                  ty: `${(Math.random() - 0.5) * 120}px`,
                  tr: `${(Math.random() - 0.5) * 360}deg`,
                });
              }
              setParticles((prev) => [...prev, ...fireList]);
              trackTimeout(() => {
                const ids = new Set(fireList.map((p) => p.id));
                setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
              }, 1200);
            }

            if (player.isBot) {
              triggerBotEmotion(player.seatIndex, "😡", 2500);
            }
          }
        }
      });
    }

    playersSnapshot.forEach((p) => {
      if (p.isBot) {
        const cardCount = p.handCount ?? p.hand?.length ?? 0;
        if (cardCount === 1) {
          setBotEmotions((prev) => ({ ...prev, [p.seatIndex]: "😰" }));
        } else if (cardCount === 2) {
          setBotEmotions((prev) => ({ ...prev, [p.seatIndex]: "😬" }));
        }
      }
    });

    const currentUno = state.unoCaller ?? -1;
    if (currentUno !== -1 && lastUno.current === -1) {
      const uPlayer = playersSnapshot.find((p) => p.seatIndex === currentUno);
      if (uPlayer) {
        setCardAlert(`⚠️ ${parsePlayerName(uPlayer.name).name} HAS 1 CARD!`);
        sfx.playChime();
        triggerParticles(window.innerWidth / 2, window.innerHeight / 2, 25);
      }
    } else if (currentUno === -1 && lastUno.current !== -1) {
      const uPlayer = playersSnapshot.find((p) => p.seatIndex === lastUno.current);
      if (uPlayer) {
        setCardAlert(`🎉 ${parsePlayerName(uPlayer.name).name} CALLED UNO!`);
        sfx.playChime();
        triggerParticles(window.innerWidth / 2, window.innerHeight / 2, 35);
      }
    }
    lastUno.current = currentUno;

    const currentPending = state.pendingDraw ?? 0;
    if (currentPending > lastPending.current && currentPending > 0) {
      setCardAlert(`🔥 +${currentPending} DRAW STACKED!`);
      sfx.playPluck();
      triggerParticles(window.innerWidth / 2, window.innerHeight / 2, 20);
    }
    lastPending.current = currentPending;

    const currentWinner = state.winner ?? -1;
    if (currentWinner !== -1 && lastWinner.current === -1) {
      sfx.playChime();

      if (me) {
        const win = me.seatIndex === currentWinner;
        const botKills = win
          ? playersSnapshot.filter((p) => p.sessionId !== me.sessionId && p.isBot).length
          : 0;
        const winnerPlayer = playersSnapshot.find((p) => p.seatIndex === currentWinner);
        const winnerName = winnerPlayer ? winnerPlayer.name : "Winner";
        const durationSec = matchStartTime.current ? (Date.now() - matchStartTime.current) / 1000 : 0;
        const opponentNames = playersSnapshot
          .filter((p) => p.sessionId !== me.sessionId)
          .map((p) => p.name);

        updateStats(
          win,
          localPlayerCardsPlayed.current,
          botKills,
          winnerName,
          durationSec,
          opponentNames,
        );
      }

      triggerParticles(window.innerWidth / 2, window.innerHeight / 2, 40);
    }
    lastWinner.current = currentWinner;

    const currentHand = me?.hand?.length ?? 0;
    if (currentHand > lastHandCount.current && lastHandCount.current > 0) {
      sfx.playSwish();
    }
    lastHandCount.current = currentHand;

    prevCurrentPlayer.current = currentSeat;
    prevDiscardPile.current = state.discardPile ? [...state.discardPile] : [];

    const counts: Record<number, number> = {};
    playersSnapshot.forEach((p) => {
      counts[p.seatIndex] = p.handCount ?? p.hand?.length ?? 0;
    });
    prevPlayersHandCounts.current = counts;
  }, [state, me?.hand?.length, me, players, room, triggerBotEmotion, triggerFlight]);

  useEffect(() => {
    if (cardAlert) {
      const timer = trackTimeout(() => setCardAlert(null), 1600);
      return () => clearTrackedTimer(timer);
    }
  }, [cardAlert, clearTrackedTimer, trackTimeout]);

  useEffect(() => {
    setSelectedCardIdx(-1);
  }, [state?.currentPlayer, state?.phase]);

  useEffect(() => {
    if (isMyTurn && !lastIsMyTurn.current) {
      sfx.playTurnAlert();
    }
    lastIsMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  useEffect(() => {
    if (chatLogRef.current && chatMessagesCount > lastChatCount.current) {
      chatLogRef.current.scrollTo({
        top: chatLogRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    lastChatCount.current = chatMessagesCount;
  }, [chatMessagesCount]);

  useEffect(() => {
    let unlocked = false;

    const handleUnlock = () => {
      if (unlocked) return;
      sfx.startAmbientSoundscape(cardBackTheme);
      unlocked = true;
      document.removeEventListener("click", handleUnlock);
      document.removeEventListener("touchstart", handleUnlock);
    };

    document.addEventListener("click", handleUnlock);
    document.addEventListener("touchstart", handleUnlock);

    sfx.startAmbientSoundscape(cardBackTheme);

    return () => {
      document.removeEventListener("click", handleUnlock);
      document.removeEventListener("touchstart", handleUnlock);
      sfx.stopAmbientSoundscape();
    };
  }, [cardBackTheme]);

  useEffect(() => {
    if (!isMyTurn || !state?.turnDeadline) return;

    let heartbeatInterval: number;

    const checkHeartbeat = () => {
      const remaining = (state.turnDeadline || 0) - Date.now();
      if (remaining > 0 && remaining < 2500) {
        sfx.playHeartbeat();
      }
    };

    checkHeartbeat();
    heartbeatInterval = trackInterval(checkHeartbeat, 1000);

    return () => {
      clearTrackedTimer(heartbeatInterval);
    };
  }, [isMyTurn, state?.turnDeadline, clearTrackedTimer, trackInterval]);

  useEffect(() => {
    if (state?.phase === "playing" && matchStartTime.current === null) {
      matchStartTime.current = Date.now();
    } else if (state?.phase !== "playing") {
      matchStartTime.current = null;
    }
  }, [state?.phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;

      const key = event.key.toLowerCase();
      if (showRules) {
        if (event.key === "Escape") {
          setShowRules(false);
        }
        return;
      }
      if (wildFor) {
        if (key === "r") {
          playCard(wildFor, "red");
        } else if (key === "y") {
          playCard(wildFor, "yellow");
        } else if (key === "g") {
          playCard(wildFor, "green");
        } else if (key === "b") {
          playCard(wildFor, "blue");
        } else if (event.key === "Escape") {
          setWildFor(null);
        }
        return;
      }

      if (key === "arrowleft") {
        setSelectedCardIdx((prev) => Math.max(0, prev - 1));
      } else if (key === "arrowright") {
        setSelectedCardIdx((prev) => Math.min(hand.length - 1, prev + 1));
      } else if (event.key === " " || event.key === "Enter") {
        if (selectedCardIdx >= 0 && selectedCardIdx < hand.length) {
          const card = hand[selectedCardIdx];
          if (isMyTurn && isPlayable(card, state)) {
            playCard(card);
          }
        }
      } else if (key === "d") {
        if (isMyTurn && tableReady) {
          room?.send("draw_card");
        }
      } else if (key === "u") {
        if (state?.unoCaller === me?.seatIndex) {
          room?.send("uno");
        }
      } else if (key === "c") {
        event.preventDefault();
        const chatInput = document.querySelector(".chat-panel input") as HTMLInputElement | null;
        chatInput?.focus();
      } else if (key === "?") {
        setShowRules((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hand, selectedCardIdx, isMyTurn, state, me, playCard, room, tableReady, showRules, wildFor]);

  const scrollHand = (direction: "left" | "right") => {
    if (!handScrollRef.current) return;
    const amount = 200 * (direction === "left" ? -1 : 1);
    handScrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  const handCount = hand.length;
  const { handMid, dynamicFanAngle, dynamicFanOffset, dynamicMarginValue } = getHandLayout(handCount);

  const hasPlayableCards = useMemo(() => {
    return hand.some((card) => isPlayable(card, state));
  }, [hand, state]);

  const pendingDraw = state?.pendingDraw ?? 0;
  const mustCallUno = state?.unoCaller === me?.seatIndex;
  const shouldDrawHint = isMyTurn && !hasPlayableCards && tableReady;

  const selectedCard =
    selectedCardIdx >= 0 && selectedCardIdx < hand.length ? hand[selectedCardIdx] : null;
  const isSelectedPlayable = selectedCard ? isPlayable(selectedCard, state, hand) : false;

  const { guidanceText, guidanceStatus } = useMemo(
    () =>
      buildGuidanceState({
        mustCallUno,
        isMyTurn,
        pendingDraw,
        hasPlayableCards,
        selectedCard,
        isSelectedPlayable,
      }),
    [mustCallUno, isMyTurn, pendingDraw, hasPlayableCards, selectedCard, isSelectedPlayable],
  );

  const actionCallout = useMemo(
    () =>
      buildActionCallout({
        mustCallUno,
        isMyTurn,
        pendingDraw,
        hasPlayableCards,
      }),
    [mustCallUno, isMyTurn, pendingDraw, hasPlayableCards],
  );

  const tutorialCards = getTutorialCards();
  const tutorial = tutorialStep >= 0 ? tutorialCards[tutorialStep] : null;
  const closeTutorial = () => {
    writeStorage("uno_tutorial_complete", "true");
    setTutorialStep(
      getCloseTutorialSnapshot({
        showRules,
        tutorialStep,
        wildFor,
        cardAlert,
        turnBanner,
        showReverseSweep,
      }).tutorialStep,
    );
  };

  return {
    me,
    players,
    discardPile,
    topCard,
    sortBy,
    setSortBy,
    wildFor,
    setWildFor,
    chatText,
    setChatText,
    currentPlayerLabel,
    activePlayerThemeColor,
    meSummary,
    rosterEntries,
    isMyTurn,
    spotlightPos,
    hasOneCardWarning,
    roomCode,
    tableReady,
    ping,
    showRules,
    setShowRules,
    tutorialStep,
    setTutorialStep,
    cardAlert,
    particles,
    selectedCardIdx,
    setSelectedCardIdx,
    flights,
    actionBubbles,
    turnBanner,
    skippedSeatIndex,
    showReverseSweep,
    botEmotions,
    shockwaves,
    cardBackTheme,
    setCardBackTheme,
    handScrollRef,
    chatLogRef,
    rulesDialogRef,
    wildDialogRef,
    hand,
    handCount,
    handMid,
    dynamicFanAngle,
    dynamicFanOffset,
    dynamicMarginValue,
    hasPlayableCards,
    actionCallout,
    pendingDraw,
    mustCallUno,
    shouldDrawHint,
    guidanceText,
    guidanceStatus,
    tutorial,
    tutorialCards,
    closeTutorial,
    playCard,
    handleUnplayableTap,
    scrollHand,
  };
}
