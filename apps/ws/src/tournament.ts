import { randomUUID } from 'node:crypto';
import type { GameId } from 'shared';

// ---- Types (inline to avoid import issues before shared builds) ----

type TournamentId = string;
type TournamentStatus = 'lobby' | 'in_progress' | 'finished';
type BracketSize = 4 | 8 | 16;

interface TournamentConfig {
  gameId: GameId;
  bracketSize: BracketSize;
  gameConfig?: Record<string, unknown>;
  name: string;
  createdBy: string;
}

interface TournamentMatch {
  id: string;
  round: number;
  position: number;
  player1: string | null;
  player2: string | null;
  winner: string | null;
  roomCode: string | null;
  status: 'pending' | 'in_progress' | 'finished';
}

interface TournamentPlayer {
  token: string;
  nickname: string;
  seed: number;
}

interface TournamentState {
  id: TournamentId;
  config: TournamentConfig;
  status: TournamentStatus;
  players: TournamentPlayer[];
  matches: TournamentMatch[];
  rounds: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  champion: string | null;
}

interface TournamentListItem {
  id: TournamentId;
  name: string;
  gameId: GameId;
  status: TournamentStatus;
  bracketSize: BracketSize;
  playerCount: number;
  createdAt: number;
}

// ---- Bracket Generation ----

function generateBracket(players: TournamentPlayer[], bracketSize: BracketSize): TournamentMatch[] {
  const rounds = Math.log2(bracketSize);
  const matches: TournamentMatch[] = [];

  // Shuffle players for random seeding
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  shuffled.forEach((p, i) => { p.seed = i; });

  // Generate all matches for all rounds
  for (let round = 0; round < rounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round + 1);
    for (let pos = 0; pos < matchesInRound; pos++) {
      const match: TournamentMatch = {
        id: randomUUID(),
        round,
        position: pos,
        player1: null,
        player2: null,
        winner: null,
        roomCode: null,
        status: 'pending',
      };

      // First round: assign players (with byes for empty slots)
      if (round === 0) {
        const p1Idx = pos * 2;
        const p2Idx = pos * 2 + 1;
        match.player1 = p1Idx < shuffled.length ? shuffled[p1Idx].token : null;
        match.player2 = p2Idx < shuffled.length ? shuffled[p2Idx].token : null;

        // Handle byes: if only one player, auto-advance
        if (match.player1 && !match.player2) {
          match.winner = match.player1;
          match.status = 'finished';
        } else if (!match.player1 && match.player2) {
          match.winner = match.player2;
          match.status = 'finished';
        } else if (!match.player1 && !match.player2) {
          match.status = 'finished'; // empty match
        }
      }

      matches.push(match);
    }
  }

  // After handling byes in round 0, propagate winners to round 1
  propagateByes(matches, rounds);

  return matches;
}

function propagateByes(matches: TournamentMatch[], totalRounds: number): void {
  for (let round = 0; round < totalRounds - 1; round++) {
    const currentRoundMatches = matches.filter(m => m.round === round);
    const nextRoundMatches = matches.filter(m => m.round === round + 1);

    for (const match of currentRoundMatches) {
      if (match.status !== 'finished' || !match.winner) continue;

      const nextPos = Math.floor(match.position / 2);
      const nextMatch = nextRoundMatches.find(m => m.position === nextPos);
      if (!nextMatch) continue;

      if (match.position % 2 === 0) {
        nextMatch.player1 = match.winner;
      } else {
        nextMatch.player2 = match.winner;
      }

      // Check if this next match now has a bye (one player set, the other slot
      // also finished with a bye from its feeder match)
      if (nextMatch.player1 && nextMatch.player2) {
        // Both set — match is ready to play, leave as pending
      } else if (nextMatch.player1 || nextMatch.player2) {
        // Only one player — check if the other feeder match is also finished
        const feederPositions = [nextPos * 2, nextPos * 2 + 1];
        const feeders = currentRoundMatches.filter(m => feederPositions.includes(m.position));
        const allFeedersDone = feeders.every(f => f.status === 'finished');
        if (allFeedersDone) {
          // The other feeder had no winner (empty bye), auto-advance
          nextMatch.winner = nextMatch.player1 ?? nextMatch.player2;
          nextMatch.status = 'finished';
        }
      }
    }
  }
}

// ---- Tournament Manager ----

export class TournamentManager {
  private tournaments = new Map<TournamentId, TournamentState>();

  create(config: TournamentConfig): TournamentState {
    const id = randomUUID();
    const rounds = Math.log2(config.bracketSize);
    const tournament: TournamentState = {
      id,
      config,
      status: 'lobby',
      players: [],
      matches: [],
      rounds,
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      champion: null,
    };
    this.tournaments.set(id, tournament);
    return tournament;
  }

  get(id: TournamentId): TournamentState | undefined {
    return this.tournaments.get(id);
  }

  list(): TournamentListItem[] {
    return Array.from(this.tournaments.values())
      .filter(t => t.status !== 'finished')
      .map(t => ({
        id: t.id,
        name: t.config.name,
        gameId: t.config.gameId,
        status: t.status,
        bracketSize: t.config.bracketSize,
        playerCount: t.players.length,
        createdAt: t.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  join(tournamentId: TournamentId, token: string, nickname: string): TournamentState | string {
    const t = this.tournaments.get(tournamentId);
    if (!t) return 'TOURNAMENT_NOT_FOUND';
    if (t.status !== 'lobby') return 'TOURNAMENT_ALREADY_STARTED';
    if (t.players.length >= t.config.bracketSize) return 'TOURNAMENT_FULL';
    if (t.players.some(p => p.token === token)) return 'ALREADY_JOINED';

    t.players.push({ token, nickname, seed: t.players.length });
    return t;
  }

  leave(tournamentId: TournamentId, token: string): TournamentState | string {
    const t = this.tournaments.get(tournamentId);
    if (!t) return 'TOURNAMENT_NOT_FOUND';
    if (t.status !== 'lobby') return 'TOURNAMENT_ALREADY_STARTED';

    const idx = t.players.findIndex(p => p.token === token);
    if (idx === -1) return 'NOT_IN_TOURNAMENT';

    t.players.splice(idx, 1);

    // If creator leaves, delete tournament
    if (token === t.config.createdBy) {
      this.tournaments.delete(tournamentId);
      return 'TOURNAMENT_DELETED';
    }

    return t;
  }

  start(tournamentId: TournamentId, token: string): TournamentState | string {
    const t = this.tournaments.get(tournamentId);
    if (!t) return 'TOURNAMENT_NOT_FOUND';
    if (token !== t.config.createdBy) return 'NOT_TOURNAMENT_CREATOR';
    if (t.status !== 'lobby') return 'TOURNAMENT_ALREADY_STARTED';
    if (t.players.length < 2) return 'NOT_ENOUGH_PLAYERS';

    t.status = 'in_progress';
    t.startedAt = Date.now();
    t.matches = generateBracket(t.players, t.config.bracketSize);

    return t;
  }

  /** Called when a game room finishes. Returns matches that are now ready to start. */
  reportMatchResult(tournamentId: TournamentId, roomCode: string, winnerToken: string): {
    tournament: TournamentState;
    readyMatches: TournamentMatch[];
  } | string {
    const t = this.tournaments.get(tournamentId);
    if (!t) return 'TOURNAMENT_NOT_FOUND';

    const match = t.matches.find(m => m.roomCode === roomCode);
    if (!match) return 'MATCH_NOT_FOUND';
    if (match.status !== 'in_progress') return 'MATCH_NOT_IN_PROGRESS';

    match.winner = winnerToken;
    match.status = 'finished';

    // Advance winner to next round
    const nextRound = match.round + 1;
    if (nextRound < t.rounds) {
      const nextPos = Math.floor(match.position / 2);
      const nextMatch = t.matches.find(m => m.round === nextRound && m.position === nextPos);
      if (nextMatch) {
        if (match.position % 2 === 0) {
          nextMatch.player1 = winnerToken;
        } else {
          nextMatch.player2 = winnerToken;
        }
      }
    }

    // Check if tournament is finished (final match done)
    const finalMatch = t.matches.find(m => m.round === t.rounds - 1);
    if (finalMatch && finalMatch.status === 'finished' && finalMatch.winner) {
      t.status = 'finished';
      t.finishedAt = Date.now();
      t.champion = finalMatch.winner;
    }

    // Find matches that are ready to start (both players assigned, still pending)
    const readyMatches = t.matches.filter(m =>
      m.status === 'pending' && m.player1 && m.player2
    );

    return { tournament: t, readyMatches };
  }

  /** Get pending matches that have both players and need rooms created */
  getReadyMatches(tournamentId: TournamentId): TournamentMatch[] {
    const t = this.tournaments.get(tournamentId);
    if (!t) return [];
    return t.matches.filter(m => m.status === 'pending' && m.player1 && m.player2);
  }

  /** Mark a match as in_progress with a room code */
  startMatch(tournamentId: TournamentId, matchId: string, roomCode: string): void {
    const t = this.tournaments.get(tournamentId);
    if (!t) return;
    const match = t.matches.find(m => m.id === matchId);
    if (!match) return;
    match.roomCode = roomCode;
    match.status = 'in_progress';
  }

  /** Cleanup finished tournaments older than 1 hour */
  cleanup(): void {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [id, t] of this.tournaments) {
      if (t.status === 'finished' && t.finishedAt && t.finishedAt < cutoff) {
        this.tournaments.delete(id);
      }
    }
  }
}
