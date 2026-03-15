import type { GameId } from './registry';

export type TournamentId = string; // UUID

export type TournamentStatus = 'lobby' | 'in_progress' | 'finished';

export type BracketSize = 4 | 8 | 16;

export interface TournamentConfig {
  gameId: GameId;
  bracketSize: BracketSize;
  gameConfig?: Record<string, unknown>;
  name: string;
  createdBy: string; // playerToken
}

export interface TournamentMatch {
  id: string;
  round: number;          // 0-indexed (0 = first round)
  position: number;       // position within the round (0-indexed)
  player1: string | null; // playerToken or null (bye/TBD)
  player2: string | null;
  winner: string | null;
  roomCode: string | null; // assigned when match starts
  status: 'pending' | 'in_progress' | 'finished';
}

export interface TournamentPlayer {
  token: string;
  nickname: string;
  seed: number;
}

export interface TournamentState {
  id: TournamentId;
  config: TournamentConfig;
  status: TournamentStatus;
  players: TournamentPlayer[];
  matches: TournamentMatch[];
  rounds: number;         // total rounds (log2 of bracketSize)
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  champion: string | null; // playerToken of winner
}

/** Minimal info for tournament list */
export interface TournamentListItem {
  id: TournamentId;
  name: string;
  gameId: GameId;
  status: TournamentStatus;
  bracketSize: BracketSize;
  playerCount: number;
  createdAt: number;
}
