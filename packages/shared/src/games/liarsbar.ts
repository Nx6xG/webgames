// ── Liar's Deck — shared types and pure game logic ───────────────────────────

// ── Cards ────────────────────────────────────────────────────────────────────

export type CardRank = 'A' | 'K' | 'Q' | 'J';

export interface Card {
  /** Unique id so cards can be referenced without ambiguity. */
  id: number;
  rank: CardRank;
}

export const ALL_RANKS: CardRank[] = ['A', 'K', 'Q', 'J'];
export const DECK_SIZE = 16; // 4 ranks × 4 suits
export const HAND_SIZE = 5;
export const STARTING_LIVES = 3;

// ── Mode ──────────────────────────────────────────────────────────────────────

export type LdMode = 'classic' | 'roulette';

export interface LdRouletteState {
  /** Current chamber position (0-5). */
  cylinderPos: number;
  /** Which chamber has the bullet (0-5). Server-authoritative, stripped from clients. */
  bulletPos: number;
}

/** Result of the last penalty resolution, shown briefly in UI. */
export interface LdLastPenalty {
  /** Player who received the penalty. */
  playerIndex: number;
  /** Whether the revolver fired (roulette only). Undefined in classic mode. */
  fired?: boolean;
  /** Why the penalty occurred. */
  reason: 'failed_call' | 'caught_lie';
}

// ── State ────────────────────────────────────────────────────────────────────

export type LbPhase =
  /** Waiting for host to start the game. */
  | 'lobby'
  /** Active player must play 1-3 cards. */
  | 'turn'
  /** Next player may call or pass. */
  | 'await_call'
  /** Game over — one player remains. */
  | 'ended';

export interface LbPlayer {
  /** Player token UUID. */
  id: string;
  lives: number;
  /** Number of cards in hand (visible to all). Actual cards are in `hands`. */
  handCount: number;
  eliminated: boolean;
}

/** Tracks the immediately previous play — a call always targets only this. */
export interface LbLastClaim {
  /** Index of the player who made the claim. */
  claimantIndex: number;
  /** Player token of the claimant. */
  claimantId: string;
  /** Number of cards played (1–3). */
  count: number;
  /** The actual cards played (server-authoritative, stripped from clients). */
  cards: Card[];
}

/** Result of the last call, shown to all players briefly. */
export interface LbReveal {
  /** Player who played the cards. */
  playerId: string;
  /** Player who called. */
  callerId: string;
  /** The revealed cards. */
  cards: Card[];
  /** True if ALL revealed cards were Kings. */
  allKings: boolean;
  /** The player who lost a life as a result. */
  loserId: string;
}

export interface LiarsBarState {
  players: LbPlayer[];

  /**
   * Per-player hands. Indexed by player position in `players` array.
   * Server-authoritative — must be stripped/projected before sending to clients.
   */
  hands: Card[][];

  /** Draw pile. */
  deck: Card[];

  /** Discard pile (called cards go here after reveal). */
  discard: Card[];

  /** Cards currently played face-down on the table (not yet revealed or discarded). */
  pile: Card[];

  /** Who played the current pile (needed for call resolution). */
  pilePlayerId: string | null;

  phase: LbPhase;

  /**
   * Token of the player whose turn it is (to play cards or whose play is being challenged).
   * Required by the server sanity guard — must always be a player token UUID.
   */
  currentTurn: string;

  /** Index in `players` of the active player. */
  turnIndex: number;

  /** The next player (potential caller) during await_call phase. */
  pendingCallerId: string | null;

  /** The immediately previous play — a call targets only this claim. Null if no play yet this round. */
  lastClaim: LbLastClaim | null;

  /** Result of the most recent call, if any. Cleared on next turn. */
  lastReveal: LbReveal | null;

  /** Winner's player id (set when phase === 'ended'). */
  winner: string | null;

  /** Mirror of game lifecycle for server compatibility ('ongoing' | 'win'). */
  status: 'ongoing' | 'win' | 'draw';

  /** Monotonic counter for unique card ids across reshuffles. */
  nextCardId: number;

  // ── Mode fields ──────────────────────────────────────────────────────────────

  /** Game mode: classic (3 lives, deterministic) or roulette (1 life, revolver). */
  mode: LdMode;

  /** Maximum lives per player (3 for classic, 1 for roulette). */
  maxLives: number;

  /** Seeded RNG state (uint32). Used for deterministic randomness. */
  rngSeed: number;

  /** Revolver state — only present in roulette mode. */
  roulette?: LdRouletteState;

  /** Last penalty result — shown in UI, cleared on next normal action. */
  lastPenalty?: LdLastPenalty;
}

// ── Actions ──────────────────────────────────────────────────────────────────

export interface LbPlayAction {
  type: 'lb_play';
  /** Card ids from the player's hand (1–3 cards). */
  cardIds: number[];
}

export interface LbCallAction {
  type: 'lb_call';
}

export interface LbPassAction {
  type: 'lb_pass';
}

export interface LbStartAction {
  type: 'lb_start';
}

export type LiarsBarAction = LbPlayAction | LbCallAction | LbPassAction | LbStartAction;

// ── Seeded RNG (xorshift32) ──────────────────────────────────────────────────

/** Advance a uint32 seed via xorshift32. Returns [nextSeed, value 0..1). */
function xorshift32(seed: number): [number, number] {
  let s = seed | 0;
  // Ensure non-zero
  if (s === 0) s = 1;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  s = s >>> 0; // force unsigned
  return [s, s / 0x100000000];
}

/** Return a random int in [0, max) using seeded RNG. Returns [nextSeed, value]. */
function seededRandInt(seed: number, max: number): [number, number] {
  const [next, frac] = xorshift32(seed);
  return [next, Math.floor(frac * max)];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle using seeded RNG (returns new array + next seed). */
function seededShuffle<T>(arr: T[], seed: number): { result: T[]; seed: number } {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    let j: number;
    [s, j] = seededRandInt(s, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return { result: a, seed: s };
}

/** Fisher-Yates shuffle (returns new array). Uses Math.random — only for non-game-critical operations. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Penalty resolution ───────────────────────────────────────────────────────

interface PenaltyResult {
  players: LbPlayer[];
  roulette?: LdRouletteState;
  rngSeed: number;
  lastPenalty: LdLastPenalty;
}

/**
 * Resolve a penalty for a player. In classic mode, deducts a life.
 * In roulette mode, pulls the trigger (1/6 chance to fire).
 */
function resolvePenalty(
  state: LiarsBarState,
  loserIdx: number,
  reason: LdLastPenalty['reason'],
): PenaltyResult {
  if (state.mode === 'classic') {
    const newPlayers = state.players.map((p, i) => {
      if (i !== loserIdx) return { ...p };
      const newLives = p.lives - 1;
      return { ...p, lives: newLives, eliminated: newLives <= 0 };
    });
    return {
      players: newPlayers,
      rngSeed: state.rngSeed,
      lastPenalty: { playerIndex: loserIdx, reason },
    };
  }

  // Roulette mode
  const roul = state.roulette!;
  const newCylinderPos = (roul.cylinderPos + 1) % 6;
  const fired = newCylinderPos === roul.bulletPos;

  const newPlayers = state.players.map((p, i) => {
    if (i !== loserIdx) return { ...p };
    if (fired) return { ...p, lives: 0, eliminated: true };
    return { ...p }; // survived — still 1 life
  });

  let newRoulette: LdRouletteState = { ...roul, cylinderPos: newCylinderPos };
  let newSeed = state.rngSeed;

  // If fired, re-initialize cylinder for next round (new random bullet position)
  if (fired) {
    let bp: number;
    [newSeed, bp] = seededRandInt(newSeed, 6);
    newRoulette = { cylinderPos: 0, bulletPos: bp };
  }

  return {
    players: newPlayers,
    roulette: newRoulette,
    rngSeed: newSeed,
    lastPenalty: { playerIndex: loserIdx, fired, reason },
  };
}

/** Build a fresh 16-card deck with unique ids starting from `startId`. */
export function buildDeck(startId: number): { deck: Card[]; nextId: number } {
  const cards: Card[] = [];
  let id = startId;
  for (const rank of ALL_RANKS) {
    for (let s = 0; s < 4; s++) {
      cards.push({ id, rank });
      id++;
    }
  }
  return { deck: shuffle(cards), nextId: id };
}

/** Find the next alive player index after `fromIndex` (wrapping). */
export function nextAliveIndex(players: LbPlayer[], fromIndex: number): number {
  const n = players.length;
  for (let i = 1; i < n; i++) {
    const idx = (fromIndex + i) % n;
    if (!players[idx].eliminated) return idx;
  }
  return fromIndex; // only this player is alive (shouldn't happen mid-game)
}

/** Count players still alive. */
function aliveCount(players: LbPlayer[]): number {
  return players.filter(p => !p.eliminated).length;
}

/** Deal cards from deck to a player's hand until they have HAND_SIZE cards. */
function refillHand(
  hand: Card[],
  deck: Card[],
  discard: Card[],
  nextCardId: number,
): { hand: Card[]; deck: Card[]; discard: Card[]; nextCardId: number } {
  let d = [...deck];
  let disc = [...discard];
  let nid = nextCardId;
  const h = [...hand];

  while (h.length < HAND_SIZE) {
    if (d.length === 0) {
      // Reshuffle discard into deck
      if (disc.length === 0) {
        // No cards anywhere — build a fresh deck
        const fresh = buildDeck(nid);
        d = fresh.deck;
        nid = fresh.nextId;
      } else {
        d = shuffle(disc);
        disc = [];
      }
    }
    h.push(d.shift()!);
  }

  return { hand: h, deck: d, discard: disc, nextCardId: nid };
}

// ── Initial state factory ────────────────────────────────────────────────────

/**
 * Create a lobby-phase state. No cards are dealt — that happens when
 * the host sends `lb_start`.
 */
export function createInitialState(
  playerIds: string[],
  _startingPlayerIndex: number,
  config?: unknown,
): LiarsBarState {
  const cfg = (config && typeof config === 'object' && 'mode' in config)
    ? config as { mode?: LdMode }
    : {};
  const mode: LdMode = cfg.mode === 'roulette' ? 'roulette' : 'classic';
  const maxLives = mode === 'roulette' ? 1 : STARTING_LIVES;

  // Seed from current time — only used at game creation, deterministic thereafter
  const rngSeed = (Date.now() & 0xFFFFFFFF) >>> 0 || 1;

  const players: LbPlayer[] = playerIds.map((id) => ({
    id,
    lives: maxLives,
    handCount: 0,
    eliminated: false,
  }));

  return {
    players,
    hands: playerIds.map(() => []),
    deck: [],
    discard: [],
    pile: [],
    pilePlayerId: null,
    phase: 'lobby',
    currentTurn: playerIds[0], // host token — satisfies sanity guard
    turnIndex: 0,
    pendingCallerId: null,
    lastClaim: null,
    lastReveal: null,
    winner: null,
    status: 'ongoing',
    nextCardId: 0,
    mode,
    maxLives,
    rngSeed,
    roulette: mode === 'roulette' ? { cylinderPos: 0, bulletPos: 0 } : undefined,
  };
}

/**
 * Deal cards and transition from lobby → turn phase.
 * Only called via lb_start action (host-only).
 */
function dealAndStart(state: LiarsBarState): LiarsBarState {
  const { deck: initialDeck, nextId } = buildDeck(0);
  let deck = initialDeck;
  let nid = nextId;

  const hands: Card[][] = [];
  for (let i = 0; i < state.players.length; i++) {
    const hand: Card[] = [];
    for (let c = 0; c < HAND_SIZE && deck.length > 0; c++) {
      hand.push(deck.shift()!);
    }
    if (hand.length < HAND_SIZE) {
      const refilled = refillHand(hand, deck, [], nid);
      hands.push(refilled.hand);
      deck = refilled.deck;
      nid = refilled.nextCardId;
    } else {
      hands.push(hand);
    }
  }

  let seed = state.rngSeed;
  let startIdx: number;
  [seed, startIdx] = seededRandInt(seed, state.players.length);

  // For roulette: pick random bullet position
  let roulette = state.roulette;
  if (state.mode === 'roulette') {
    let bp: number;
    [seed, bp] = seededRandInt(seed, 6);
    roulette = { cylinderPos: 0, bulletPos: bp };
  }

  return {
    ...state,
    hands,
    deck,
    discard: [],
    pile: [],
    pilePlayerId: null,
    phase: 'turn',
    currentTurn: state.players[startIdx].id,
    turnIndex: startIdx,
    pendingCallerId: null,
    lastClaim: null,
    lastReveal: null,
    winner: null,
    status: 'ongoing',
    nextCardId: nid,
    rngSeed: seed,
    roulette,
    lastPenalty: undefined,
    players: state.players.map((p) => ({
      ...p,
      lives: state.maxLives,
      handCount: HAND_SIZE,
      eliminated: false,
    })),
  };
}

// ── Reducer ──────────────────────────────────────────────────────────────────

export function applyAction(
  state: LiarsBarState,
  action: LiarsBarAction,
  actingPlayerId: string,
): LiarsBarState {
  if (state.phase === 'ended') {
    throw new Error('GAME_OVER: Game is already finished');
  }

  switch (action.type) {
    case 'lb_start': return handleStart(state, actingPlayerId);
    case 'lb_play': return handlePlay(state, action, actingPlayerId);
    case 'lb_call': return handleCall(state, actingPlayerId);
    case 'lb_pass': return handlePass(state, actingPlayerId);
    default: throw new Error('INVALID_ACTION: Unknown action type');
  }
}

// ── Start game (host only) ───────────────────────────────────────────────────

function handleStart(
  state: LiarsBarState,
  actingPlayerId: string,
): LiarsBarState {
  if (state.phase !== 'lobby') {
    throw new Error('INVALID_ACTION: Game already started');
  }
  // Only the host (player 0) can start
  if (actingPlayerId !== state.players[0]?.id) {
    throw new Error('INVALID_ACTION: Only the host can start the game');
  }
  if (state.players.length < 2) {
    throw new Error('INVALID_ACTION: Need at least 2 players to start');
  }
  return dealAndStart(state);
}

// ── Play cards ───────────────────────────────────────────────────────────────

function handlePlay(
  state: LiarsBarState,
  action: LbPlayAction,
  actingPlayerId: string,
): LiarsBarState {
  if (state.phase !== 'turn') {
    throw new Error('INVALID_ACTION: Not in turn phase');
  }
  if (actingPlayerId !== state.currentTurn) {
    throw new Error('NOT_YOUR_TURN: Wait for your turn');
  }

  const { cardIds } = action;
  if (cardIds.length < 1 || cardIds.length > 3) {
    throw new Error('INVALID_ACTION: Must play 1–3 cards');
  }

  const pIdx = state.turnIndex;
  const hand = [...state.hands[pIdx]];

  // Validate all card ids exist in hand
  const uniqueIds = new Set(cardIds);
  if (uniqueIds.size !== cardIds.length) {
    throw new Error('INVALID_ACTION: Duplicate card ids');
  }
  for (const cid of cardIds) {
    if (!hand.some(c => c.id === cid)) {
      throw new Error('INVALID_ACTION: Card not in hand');
    }
  }

  // Remove cards from hand, add to pile
  const playedCards = hand.filter(c => uniqueIds.has(c.id));
  const remainingHand = hand.filter(c => !uniqueIds.has(c.id));

  const newHands = state.hands.map((h, i) => i === pIdx ? remainingHand : [...h]);
  const newPlayers = state.players.map((p, i) =>
    i === pIdx ? { ...p, handCount: remainingHand.length } : { ...p }
  );

  const nextIdx = nextAliveIndex(state.players, pIdx);
  const callerId = state.players[nextIdx].id;

  return {
    ...state,
    hands: newHands,
    players: newPlayers,
    pile: [...state.pile, ...playedCards],
    pilePlayerId: actingPlayerId,
    phase: 'await_call',
    currentTurn: callerId, // sanity guard: set to the player who can act next
    pendingCallerId: callerId,
    lastClaim: {
      claimantIndex: pIdx,
      claimantId: actingPlayerId,
      count: playedCards.length,
      cards: [...playedCards],
    },
    lastReveal: null,
    lastPenalty: undefined,
  };
}

// ── Call (challenge) ─────────────────────────────────────────────────────────

function handleCall(
  state: LiarsBarState,
  actingPlayerId: string,
): LiarsBarState {
  if (state.phase !== 'await_call') {
    throw new Error('INVALID_ACTION: No play to challenge');
  }
  if (actingPlayerId !== state.pendingCallerId) {
    throw new Error('NOT_YOUR_TURN: Only the next player can call');
  }
  if (!state.lastClaim) {
    throw new Error('INVALID_ACTION: No claim to challenge');
  }

  // A call targets ONLY the immediately previous play (lastClaim)
  const claim = state.lastClaim;
  const claimedCards = claim.cards;
  const allKings = claimedCards.every(c => c.rank === 'K');
  const playerId = claim.claimantId;
  const callerId = actingPlayerId;

  // Determine who loses a life
  const loserId = allKings ? callerId : playerId;
  const loserIdx = state.players.findIndex(p => p.id === loserId);
  const reason: LdLastPenalty['reason'] = allKings ? 'failed_call' : 'caught_lie';

  const penalty = resolvePenalty(state, loserIdx, reason);
  let newPlayers = penalty.players;

  // Discard the entire pile (all accumulated cards this round)
  const newDiscard = [...state.discard, ...state.pile];

  const reveal: LbReveal = {
    playerId,
    callerId,
    cards: [...claimedCards],
    allKings,
    loserId,
  };

  // Check win condition
  const alive = aliveCount(newPlayers);
  if (alive <= 1) {
    const winnerId = newPlayers.find(p => !p.eliminated)?.id ?? playerId;
    return {
      ...state,
      players: newPlayers,
      pile: [],
      pilePlayerId: null,
      discard: newDiscard,
      phase: 'ended',
      currentTurn: winnerId,
      pendingCallerId: null,
      lastClaim: null,
      lastReveal: reveal,
      winner: winnerId,
      status: 'win',
      rngSeed: penalty.rngSeed,
      roulette: penalty.roulette ?? state.roulette,
      lastPenalty: penalty.lastPenalty,
    };
  }

  // Refill hands for players who are empty
  let deck = [...state.deck];
  let discard = newDiscard;
  let nid = state.nextCardId;
  const newHands = state.hands.map((h) => [...h]);

  for (let i = 0; i < newPlayers.length; i++) {
    if (newPlayers[i].eliminated) continue;
    if (newHands[i].length === 0) {
      const refilled = refillHand(newHands[i], deck, discard, nid);
      newHands[i] = refilled.hand;
      deck = refilled.deck;
      discard = refilled.discard;
      nid = refilled.nextCardId;
      newPlayers = newPlayers.map((p, j) =>
        j === i ? { ...p, handCount: newHands[i].length } : p
      );
    }
  }

  // Next turn: the player after the active player (the one who played the pile)
  const activeIdx = state.turnIndex;
  const nextIdx = nextAliveIndex(newPlayers, activeIdx);

  return {
    ...state,
    players: newPlayers,
    hands: newHands,
    deck,
    discard,
    pile: [],
    pilePlayerId: null,
    phase: 'turn',
    currentTurn: newPlayers[nextIdx].id,
    turnIndex: nextIdx,
    pendingCallerId: null,
    lastClaim: null,
    lastReveal: reveal,
    nextCardId: nid,
    rngSeed: penalty.rngSeed,
    roulette: penalty.roulette ?? state.roulette,
    lastPenalty: penalty.lastPenalty,
  };
}

// ── Pass (decline call) ──────────────────────────────────────────────────────

function handlePass(
  state: LiarsBarState,
  actingPlayerId: string,
): LiarsBarState {
  if (state.phase !== 'await_call') {
    throw new Error('INVALID_ACTION: No play to pass on');
  }
  if (actingPlayerId !== state.pendingCallerId) {
    throw new Error('NOT_YOUR_TURN: Only the next player can pass');
  }

  // Caller passes — turn goes to them (they become active player)
  const callerIdx = state.players.findIndex(p => p.id === actingPlayerId);

  // Refill hand if the pile player's hand is empty
  let deck = [...state.deck];
  let discard = [...state.discard];
  let nid = state.nextCardId;
  const newHands = state.hands.map(h => [...h]);
  let newPlayers = state.players.map(p => ({ ...p }));

  const prevActiveIdx = state.turnIndex;
  if (newHands[prevActiveIdx].length === 0 && !newPlayers[prevActiveIdx].eliminated) {
    const refilled = refillHand(newHands[prevActiveIdx], deck, discard, nid);
    newHands[prevActiveIdx] = refilled.hand;
    deck = refilled.deck;
    discard = refilled.discard;
    nid = refilled.nextCardId;
    newPlayers = newPlayers.map((p, i) =>
      i === prevActiveIdx ? { ...p, handCount: newHands[prevActiveIdx].length } : p
    );
  }

  return {
    ...state,
    players: newPlayers,
    hands: newHands,
    deck,
    discard,
    phase: 'turn',
    currentTurn: actingPlayerId,
    turnIndex: callerIdx,
    pendingCallerId: null,
    lastReveal: null,
    nextCardId: nid,
  };
}
