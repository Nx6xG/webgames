import type { RpsState, RpsPick, RpsMode } from 'shared';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

const PICKS: RpsPick[] = ['rock', 'paper', 'scissors'];

const BEATS: Record<RpsPick, RpsPick> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

const COUNTER: Record<RpsPick, RpsPick> = {
  rock: 'paper',
  paper: 'scissors',
  scissors: 'rock',
};

// ── State creation ──────────────────────────────────────────────────────────

export function createInitialState(
  mode: RpsMode,
  bestOf: number,
): RpsState {
  const winsNeeded = mode === 'showdown' ? 1 : Math.ceil(bestOf / 2);
  return {
    mode,
    players: [
      { id: 'human' },
      { id: 'bot' },
    ],
    scores: [0, 0],
    round: 1,
    bestOf: mode === 'showdown' ? 0 : bestOf,
    winsNeeded,
    pendingPick0: null,
    pendingPick1: null,
    hasPicked: [false, false],
    picks: [null, null],
    lastRoundResult: null,
    currentTurn: 'human',
    status: 'ongoing',
  };
}

// ── Round resolution ────────────────────────────────────────────────────────

function resolveRound(p0: RpsPick, p1: RpsPick): 'p0_wins' | 'p1_wins' | 'draw' {
  if (p0 === p1) return 'draw';
  return BEATS[p0] === p1 ? 'p0_wins' : 'p1_wins';
}

export function applyPick(state: RpsState, pick: RpsPick, playerId: string): RpsState {
  if (state.status !== 'ongoing') return state;

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx < 0) return state;
  if (state.hasPicked[playerIdx]) return state;

  const next = { ...state };

  // Store the pick
  if (playerIdx === 0) {
    next.pendingPick0 = pick;
  } else {
    next.pendingPick1 = pick;
  }
  next.hasPicked = [...state.hasPicked] as [boolean, boolean];
  next.hasPicked[playerIdx] = true;

  // If only one player picked, wait for the other
  if (!next.hasPicked[0] || !next.hasPicked[1]) {
    return next;
  }

  // Both picked — resolve round
  const p0pick = next.pendingPick0!;
  const p1pick = next.pendingPick1!;
  const result = resolveRound(p0pick, p1pick);

  next.picks = [p0pick, p1pick];
  next.lastRoundResult = result;
  next.lastRound = { p0Pick: p0pick, p1Pick: p1pick, result };

  // Update scores
  next.scores = [...state.scores] as [number, number];
  if (result === 'p0_wins') next.scores[0]++;
  if (result === 'p1_wins') next.scores[1]++;

  // Check win conditions
  if (next.mode === 'showdown') {
    if (result !== 'draw') {
      next.status = 'win';
      next.winner = result === 'p0_wins' ? 'human' : 'bot';
    }
  } else {
    // Best of
    if (next.scores[0] >= next.winsNeeded) {
      next.status = 'win';
      next.winner = 'human';
    } else if (next.scores[1] >= next.winsNeeded) {
      next.status = 'win';
      next.winner = 'bot';
    } else if (next.round >= next.bestOf) {
      // All rounds exhausted
      if (next.scores[0] > next.scores[1]) {
        next.status = 'win';
        next.winner = 'human';
      } else if (next.scores[1] > next.scores[0]) {
        next.status = 'win';
        next.winner = 'bot';
      } else {
        next.status = 'draw';
      }
    }
  }

  // Reset for next round if ongoing
  if (next.status === 'ongoing') {
    next.round = state.round + 1;
    next.hasPicked = [false, false];
    next.pendingPick0 = null;
    next.pendingPick1 = null;
  }

  return next;
}

// ── Bot AI ──────────────────────────────────────────────────────────────────

export function getBotPick(
  difficulty: BotDifficulty,
  playerHistory: RpsPick[],
): RpsPick {
  switch (difficulty) {
    case 'easy':
      return PICKS[Math.floor(Math.random() * 3)];

    case 'medium': {
      // Counter the player's last pick 60% of the time
      if (playerHistory.length > 0 && Math.random() < 0.6) {
        const lastPick = playerHistory[playerHistory.length - 1];
        return COUNTER[lastPick];
      }
      return PICKS[Math.floor(Math.random() * 3)];
    }

    case 'hard': {
      // Frequency analysis: counter the player's most common pick
      if (playerHistory.length >= 2) {
        const freq: Record<RpsPick, number> = { rock: 0, paper: 0, scissors: 0 };
        // Weight recent picks more heavily
        for (let i = 0; i < playerHistory.length; i++) {
          const weight = 1 + i * 0.5; // newer picks weighted more
          freq[playerHistory[i]] += weight;
        }
        const mostCommon = PICKS.reduce((a, b) => (freq[a] >= freq[b] ? a : b));
        // 75% counter most common, 25% random
        if (Math.random() < 0.75) {
          return COUNTER[mostCommon];
        }
      }
      return PICKS[Math.floor(Math.random() * 3)];
    }

    default:
      return PICKS[Math.floor(Math.random() * 3)];
  }
}
