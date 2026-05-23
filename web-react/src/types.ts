export interface CardSchema {
  id: string;
  cardType: 'color' | 'wild';
  color: string;
  value: string;
  chosenColor: string;
}

export interface PlayerSchema {
  sessionId: string;
  seatIndex: number;
  name: string;
  isBot: boolean;
  connected: boolean;
  hand: CardSchema[];
  handCount: number;
}

export interface ChatMessageSchema {
  sender: string;
  text: string;
  timestamp: number;
}
