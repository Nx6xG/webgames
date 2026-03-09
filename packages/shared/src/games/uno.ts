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
  matchScore: number;
}

export type UnoPhase = 'lobby' | 'playing' | 'round_end' | 'match_end';

export interface UnoRuleConfig {
  targetScore?: number;
  stackDraw2?: boolean;
  stackDraw4?: boolean;
  allowDraw2OnDraw4?: boolean;
  allowDraw4OnDraw2?: boolean;
  playDrawnCardImmediately?: boolean;
}

/** @deprecated Use UnoRuleConfig instead */
export type UnoEngineConfig = UnoRuleConfig;

export const UNO_TARGET_SCORES = [100, 200, 300, 500] as const;
export const UNO_DEFAULT_TARGET = 200;

export const UNO_DEFAULT_RULES: Required<UnoRuleConfig> = {
  targetScore: UNO_DEFAULT_TARGET,
  stackDraw2: true,
  stackDraw4: false,
  allowDraw2OnDraw4: false,
  allowDraw4OnDraw2: false,
  playDrawnCardImmediately: true,
};

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
  matchTargetScore: number;      // from config, default 200
  roundNumber: number;           // starts at 1
  roundWinner: string | null;    // token of round winner
  roundPoints: number;           // points earned this round
  rules: Required<UnoRuleConfig>;  // active house rules for this match
  drawnCardId: number | null;    // id of the just-drawn card (playDrawnCardImmediately window)
  pendingDrawSource: 'draw2' | 'wild4' | null; // what caused the pending draw stack
}

export type UnoAction =
  | { type: 'UNO_START' }
  | { type: 'UNO_PLAY_CARD'; cardId: number; chosenColor?: UnoColor }
  | { type: 'UNO_DRAW_CARD' }
  | { type: 'UNO_CALL_UNO' }
  | { type: 'UNO_NEXT_ROUND' };

export const UNO_HAND_SIZE = 7;
export const UNO_PENALTY_CARDS = 2;
