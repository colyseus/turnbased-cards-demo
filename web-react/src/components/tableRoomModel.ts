import type { CardSchema, UnoColor } from "../gameTypes";

export const colors: UnoColor[] = ["red", "yellow", "green", "blue"];

export const RULE_CARD_EXAMPLES: Array<{ card: CardSchema; title: string; text: string }> = [
  {
    card: { id: "rule-skip", cardType: "color", color: "red", value: "skip" },
    title: "Skip",
    text: "The next player loses their turn.",
  },
  {
    card: { id: "rule-reverse", cardType: "color", color: "yellow", value: "reverse" },
    title: "Reverse",
    text: "Play order changes direction.",
  },
  {
    card: { id: "rule-draw2", cardType: "color", color: "blue", value: "draw2" },
    title: "Draw 2",
    text: "The next player draws 2 and loses their turn.",
  },
  {
    card: { id: "rule-wild", cardType: "wild", color: "wild", value: "wild" },
    title: "Wild",
    text: "Play anytime, then choose the active color.",
  },
  {
    card: { id: "rule-wild-draw4", cardType: "wild", color: "wild", value: "wild_draw4" },
    title: "Wild Draw 4",
    text: "Choose a color and add 4 cards. If you had a matching color, the next player can challenge you.",
  },
];

export const TUTORIAL_CARDS = [
  {
    eyebrow: "Step 1 of 3",
    title: "Match the discard",
    text: "Look at the face-up card in the center. Play a card with the same color or symbol. Wild cards match anything.",
    target: "The face-up card sets the match",
  },
  {
    eyebrow: "Step 2 of 3",
    title: "Draw when stuck",
    text: "No matching card? Tap the face-down deck. It glows when drawing is your best move.",
    target: "Tap the deck to draw one card",
  },
  {
    eyebrow: "Step 3 of 3",
    title: "Play from your hand",
    text: "Playable cards glow below the table. Tap once to inspect and again to play. When prompted at one card, tap UNO.",
    target: "Your playable cards glow",
  },
] as const;

export interface HandLayout {
  handMid: number;
  dynamicFanAngle: number;
  dynamicFanOffset: number;
  dynamicMarginValue: string;
}

export function getHandLayout(handCount: number): HandLayout {
  const handMid = (handCount - 1) / 2;
  const dynamicFanAngle = handCount > 8 ? Math.max(1.2, 40 / handCount) : 5;
  const dynamicFanOffset = handCount > 8 ? Math.max(0.8, 32 / handCount) : 4;
  const dynamicMarginValue = handCount <= 4 ? "10px" : `${Math.max(-56, -12 - handCount * 4)}px`;
  return { handMid, dynamicFanAngle, dynamicFanOffset, dynamicMarginValue };
}

export function getTutorialCards() {
  return TUTORIAL_CARDS;
}
