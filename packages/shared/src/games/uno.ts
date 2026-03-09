export type UnoColor = 'red' | 'yellow' | 'green' | 'blue';
export type UnoCardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface UnoCard {
  id: number;
  type: UnoCardType;
  color: UnoColor | null;       // null for wild/wild4
  value: number | null;          // 0-9 for number cards
}

export interface UnoPlayer {
  token: string;
  nickname: string;
  handCount: number;
  calledUno: boolean;
}

export type UnoPhase = 'lobby' | 'playing' | 'finished';

export interface UnoState {
  phase: UnoPhase;
  players: UnoPlayer[];
  playerIds: string[];
  currentTurn: string;           // player token UUID (required by server sanity guard)
  turnIndex: number;
  direction: 1 | -1;
  hands: UnoCard[][];            // server-only (projected away)
  drawPile: UnoCard[];           // server-only
  discardPile: UnoCard[];        // server-only
  topCard: UnoCard;              // always visible
  chosenColor: UnoColor | null;  // active color after wild
  pendingDraw: number;           // stacked +2/+4
  status: 'ongoing' | 'win' | 'draw';
  winner: string | null;
  lastAction: string | null;     // UI feedback text
  nextCardId: number;            // server-only monotonic ID
  mustDraw: boolean;             // player has no playable card and must draw
}

export type UnoAction =
  | { type: 'UNO_START' }
  | { type: 'UNO_PLAY_CARD'; cardId: number; chosenColor?: UnoColor }
  | { type: 'UNO_DRAW_CARD' }
  | { type: 'UNO_CALL_UNO' };

export const UNO_HAND_SIZE = 7;
export const UNO_PENALTY_CARDS = 2;
