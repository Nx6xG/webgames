// ── Nexus Clash — Shared Types & Constants ─────────────────────────────────

// ── Tags ────────────────────────────────────────────────────────────────────

export type NcTag = 'divine' | 'arcane' | 'beast' | 'mech' | 'undead' | 'nature' | 'shadow' | 'noble' | 'spell' | 'dragon' | 'demon' | 'relic';

// ── Rarities ────────────────────────────────────────────────────────────────

export type NcRarity = 'common' | 'rare' | 'epic' | 'legendary';

// ── Abilities ───────────────────────────────────────────────────────────────

export type NcTrigger = 'on_reveal' | 'ongoing' | 'on_destroy' | 'on_ally_played';

export type NcEffectType =
  | 'buff_allies'
  | 'buff_self'
  | 'buff_self_per_enemy'
  | 'debuff_enemies'
  | 'debuff_strongest_enemy'
  | 'push_bonus'
  | 'move_to_lane'
  | 'destroy_weakest_enemy'
  | 'destroy_strongest_enemy'
  | 'destroy_random_enemy'
  | 'copy_strongest_ally_power'
  | 'shield'
  | 'shield_allies'
  | 'drain'
  | 'double_push_if'
  | 'power_per_tag'
  | 'swap_lane_positions'
  | 'draw_card'
  | 'mana_boost'
  | 'heal_allies'
  | 'return_to_hand'
  | 'tug_shift';

export interface NcAbility {
  trigger: NcTrigger;
  effect: NcEffectType;
  value?: number;
  /** Optional tag filter for buff/debuff effects */
  tagFilter?: NcTag;
  /** For move_to_lane: 'strongest' | 'weakest' | 'random' */
  laneTarget?: 'strongest' | 'weakest' | 'random';
  /** For double_push_if: minimum count of tag in lane */
  conditionCount?: number;
  /** For double_push_if: which tag to count */
  conditionTag?: NcTag;
}

// ── Card Definition ─────────────────────────────────────────────────────────

export interface NcCardDef {
  id: string;
  nameKey: string;
  cost: number;
  power: number;
  tags: NcTag[];
  rarity: NcRarity;
  ability: NcAbility;
}

// ── Card Instance (in-game, with mutable power) ─────────────────────────────

export interface NcCardInstance {
  /** Unique instance id (for tracking on board) */
  uid: number;
  /** Reference to card definition id */
  cardId: string;
  /** Current power (may differ from base due to buffs/debuffs) */
  power: number;
  /** Base power from card definition */
  basePower: number;
  /** Owner player index (0 or 1) */
  owner: 0 | 1;
  /** Shield rounds remaining (0 = no shield) */
  shieldRounds: number;
  /** Was this card played this round? (for push calculation) */
  playedThisRound: boolean;
}

// ── Lane ────────────────────────────────────────────────────────────────────

export type NcLaneModifier =
  | 'cost_reduction'
  | 'double_first'
  | 'indestructible'
  | 'inverted_power'
  | 'power_surge'
  | 'mana_drain'
  | 'fortified'
  | 'echo'
  | 'volatile'
  | 'silent'
  | 'accelerate'
  | 'siphon';

export interface NcLane {
  /** Tug-of-war value: -100 to +100. Positive = player 0 advantage */
  tugValue: number;
  /** Cards on this lane per player: [p0Cards, p1Cards] */
  cards: [NcCardInstance[], NcCardInstance[]];
  /** Lane modifier for this game */
  modifier: NcLaneModifier;
  /** Is this lane locked (breakthrough achieved)? */
  locked: boolean;
  /** Who achieved breakthrough? null if not locked */
  breakthroughWinner: 0 | 1 | null;
}

// ── Pending Play (secret until reveal) ──────────────────────────────────────

export interface NcPendingPlay {
  cardUid: number;
  cardId: string;
  laneIndex: 0 | 1 | 2;
}

// ── Game Phase ──────────────────────────────────────────────────────────────

export type NcPhase = 'mulligan' | 'placing' | 'revealing' | 'finished';

// ── Resolve Log Entry (for animation) ───────────────────────────────────────

export type NcResolveEvent =
  | { type: 'card_revealed'; laneIndex: number; cardUid: number; owner: 0 | 1; cardId: string }
  | { type: 'ability_triggered'; cardUid: number; trigger: NcTrigger; effect: NcEffectType; value?: number }
  | { type: 'card_destroyed'; laneIndex: number; cardUid: number; owner: 0 | 1 }
  | { type: 'card_moved'; cardUid: number; fromLane: number; toLane: number }
  | { type: 'push_calculated'; laneIndex: number; p0Push: number; p1Push: number; delta: number }
  | { type: 'breakthrough'; laneIndex: number; winner: 0 | 1 }
  | { type: 'ability_fizzled'; cardUid: number; reason: 'no_target' | 'shielded' | 'indestructible' }
  | { type: 'deck_recycled'; owner: 0 | 1; cardsRecycled: number }
  | { type: 'modifier_rotated'; laneIndex: number; oldModifier: NcLaneModifier; newModifier: NcLaneModifier };

// ── Game State ──────────────────────────────────────────────────────────────

export interface NexusClashState {
  playerIds: [string, string];
  /** Current round (1-7) */
  round: number;
  /** Max rounds */
  maxRounds: number;
  /** Current phase */
  phase: NcPhase;
  /** 3 lanes */
  lanes: [NcLane, NcLane, NcLane];
  /** Player hands: [p0Hand, p1Hand] — card definition ids */
  hands: [string[], string[]];
  /** Player decks: [p0Deck, p1Deck] — card definition ids, top = index 0 */
  decks: [string[], string[]];
  /** Discard pile per player (played cards go here for reshuffle when deck is empty) */
  discardPiles: [string[], string[]];
  /** Current mana per player */
  mana: [number, number];
  /** Max mana per player (increases each round) */
  maxMana: [number, number];
  /** Pending plays per player (hidden until reveal) */
  pendingPlays: [NcPendingPlay[], NcPendingPlay[]];
  /** Has each player confirmed this round? */
  confirmed: [boolean, boolean];
  /** Breakthroughs per player */
  breakthroughs: [number, number];
  /** Next card instance uid counter */
  nextUid: number;
  /** Resolve log for the last round (for animation playback) */
  resolveLog: NcResolveEvent[];
  /** Game status */
  status: 'ongoing' | 'win' | 'draw';
  /** Winner player id (if status === 'win') */
  winner?: string;
  /** Required by server sanity guard */
  currentTurn: string;
  /** Timer deadline (unix ms) for current round */
  turnDeadline?: number;
  /** Temporary mana boost for next round per player */
  manaBoost: [number, number];
  /** Bot difficulty (null if no bot) */
  botDifficulty?: NcBotDifficulty;
  /** Mulligan decisions: [p0, p1], null = not yet decided */
  mulliganDecisions: [('keep' | 'redraw' | null), ('keep' | 'redraw' | null)];
  /** History of states per round for replay */
  history: Array<{
    round: number;
    lanes: [NcLane, NcLane, NcLane];
    mana: [number, number];
    plays: [NcPendingPlay[], NcPendingPlay[]];
  }>;
}

// ── Actions ─────────────────────────────────────────────────────────────────

export interface NcPlaceCardAction {
  type: 'nc_place';
  /** Card id from hand */
  cardId: string;
  /** Which lane to place on (0, 1, 2) */
  laneIndex: 0 | 1 | 2;
}

export interface NcUndoPlaceAction {
  type: 'nc_undo';
  /** Uid of the pending card to return to hand */
  cardUid: number;
}

export interface NcConfirmAction {
  type: 'nc_confirm';
}

export interface NcMulliganAction {
  type: 'nc_mulligan';
  /** Whether to keep current hand or redraw */
  decision: 'keep' | 'redraw';
}

export type NcEmoteId = 'gg' | 'wow' | 'thanks' | 'oops' | 'strong' | 'no';

export interface NcEmoteAction {
  type: 'nc_emote';
  emoteId: NcEmoteId;
}

export type NexusClashAction = NcPlaceCardAction | NcUndoPlaceAction | NcConfirmAction | NcMulliganAction | NcEmoteAction;

// ── Progression Types ───────────────────────────────────────────────────────

export interface NcPlayerCollection {
  /** cardId → count owned */
  cards: Record<string, number>;
}

export interface NcCurrencies {
  coins: number;
  gems: number;
  shards: number;
}

export type NcPackType = 'standard' | 'premium';

export interface NcPackResult {
  cards: Array<{ cardId: string; rarity: NcRarity; isDuplicate: boolean; refundCoins: number }>;
}

// ── Quests ───────────────────────────────────────────────────────────────────

export type NcQuestType = 'daily' | 'weekly';

export type NcQuestGoal =
  | 'play_matches'
  | 'win_matches'
  | 'place_cards'
  | 'achieve_breakthrough'
  | 'play_tag_cards'
  | 'destroy_enemy_cards'
  | 'win_fast'
  | 'play_unique_cards';

export interface NcQuest {
  id: string;
  type: NcQuestType;
  goalType: NcQuestGoal;
  /** e.g. 'beast' for play_tag_cards */
  goalParam?: string;
  targetCount: number;
  currentCount: number;
  reward: { coins?: number; gems?: number };
  /** When this quest was generated (ISO date string) */
  generatedAt: string;
  completed: boolean;
}

// ── Match History ───────────────────────────────────────────────────────────

export interface NcMatchRecord {
  /** ISO date string */
  date: string;
  /** Won/lost/draw */
  result: 'win' | 'loss' | 'draw';
  /** Opponent name or 'Bot' */
  opponent: string;
  /** Player breakthroughs */
  myBreakthroughs: number;
  /** Opponent breakthroughs */
  oppBreakthroughs: number;
  /** Rounds played */
  rounds: number;
  /** Cards played by player */
  cardsPlayed: number;
  /** Deck used */
  deckName: string;
}

export const NC_MAX_MATCH_HISTORY = 50;

// ── Battle Pass ─────────────────────────────────────────────────────────────

export interface NcBpReward {
  type: 'coins' | 'gems' | 'shards' | 'card' | 'pack';
  amount?: number;
  cardId?: string;
}

export interface NcBattlePassTier {
  level: number;
  xpRequired: number;
  freeReward: NcBpReward;
  paidReward: NcBpReward;
}

export interface NcBattlePassState {
  seasonId: string;
  xp: number;
  isPremium: boolean;
  claimedFree: number[];
  claimedPaid: number[];
}

export const NC_BP_SEASON_ID = 'season_1';
export const NC_BP_PREMIUM_COST = 100; // gems
export const NC_BP_WIN_XP = 30;
export const NC_BP_LOSS_XP = 15;
export const NC_BP_QUEST_XP = 20;

/** Exclusive Battle Pass cards (not in NC_CARDS — only obtainable through the pass) */
export const NC_BP_FREE_EPIC_ID = 'nexuswächter';
export const NC_BP_PAID_LEGENDARY_ID = 'chronokaiser';

export const NC_BP_TIERS: NcBattlePassTier[] = [
  { level: 1,  xpRequired: 0,    freeReward: { type: 'coins', amount: 50 },   paidReward: { type: 'coins', amount: 100 } },
  { level: 2,  xpRequired: 100,  freeReward: { type: 'shards', amount: 5 },   paidReward: { type: 'gems', amount: 10 } },
  { level: 3,  xpRequired: 250,  freeReward: { type: 'coins', amount: 75 },   paidReward: { type: 'pack' } },
  { level: 4,  xpRequired: 450,  freeReward: { type: 'pack' },                paidReward: { type: 'coins', amount: 150 } },
  { level: 5,  xpRequired: 700,  freeReward: { type: 'gems', amount: 5 },     paidReward: { type: 'shards', amount: 15 } },
  { level: 6,  xpRequired: 1000, freeReward: { type: 'coins', amount: 100 },  paidReward: { type: 'pack' } },
  { level: 7,  xpRequired: 1350, freeReward: { type: 'shards', amount: 10 },  paidReward: { type: 'gems', amount: 15 } },
  { level: 8,  xpRequired: 1750, freeReward: { type: 'pack' },                paidReward: { type: 'coins', amount: 200 } },
  { level: 9,  xpRequired: 2200, freeReward: { type: 'coins', amount: 125 },  paidReward: { type: 'pack' } },
  { level: 10, xpRequired: 2700, freeReward: { type: 'gems', amount: 10 },    paidReward: { type: 'shards', amount: 25 } },
  { level: 11, xpRequired: 3250, freeReward: { type: 'shards', amount: 15 },  paidReward: { type: 'pack' } },
  { level: 12, xpRequired: 3850, freeReward: { type: 'coins', amount: 150 },  paidReward: { type: 'gems', amount: 20 } },
  { level: 13, xpRequired: 4500, freeReward: { type: 'pack' },                paidReward: { type: 'coins', amount: 250 } },
  { level: 14, xpRequired: 5200, freeReward: { type: 'gems', amount: 10 },    paidReward: { type: 'pack' } },
  { level: 15, xpRequired: 5950, freeReward: { type: 'coins', amount: 175 },  paidReward: { type: 'shards', amount: 30 } },
  { level: 16, xpRequired: 6750, freeReward: { type: 'shards', amount: 20 },  paidReward: { type: 'pack' } },
  { level: 17, xpRequired: 7600, freeReward: { type: 'pack' },                paidReward: { type: 'gems', amount: 25 } },
  { level: 18, xpRequired: 8500, freeReward: { type: 'coins', amount: 200 },  paidReward: { type: 'pack' } },
  { level: 19, xpRequired: 9450, freeReward: { type: 'gems', amount: 15 },    paidReward: { type: 'shards', amount: 40 } },
  { level: 20, xpRequired: 10500, freeReward: { type: 'card', cardId: 'nexuswächter' }, paidReward: { type: 'card', cardId: 'chronokaiser' } },
];

export function getNcBpTier(xp: number): number {
  for (let i = NC_BP_TIERS.length - 1; i >= 0; i--) {
    if (xp >= NC_BP_TIERS[i].xpRequired) return NC_BP_TIERS[i].level;
  }
  return 1;
}

export function createDefaultBattlePass(): NcBattlePassState {
  return { seasonId: NC_BP_SEASON_ID, xp: 0, isPremium: false, claimedFree: [], claimedPaid: [] };
}

// ── Deck Slots ──────────────────────────────────────────────────────────────

export interface NcDeckSlot {
  id: string;
  name: string;
  /** Array of card definition ids (12 unique cards, max 1 copy each) */
  cards: string[];
}

// ── Player Profile (persisted in Supabase) ──────────────────────────────────

export interface NcPlayerProfile {
  collection: NcPlayerCollection;
  currencies: NcCurrencies;
  decks: NcDeckSlot[];
  /** Currently selected deck id */
  selectedDeckId: string;
  quests: NcQuest[];
  /** Last daily quest reset date (ISO date) */
  lastDailyReset: string;
  /** Last weekly quest reset date (ISO date) */
  lastWeeklyReset: string;
  /** Last daily login reward claimed (ISO date) */
  lastLoginReward: string;
  /** Current login streak day (1-7, resets after 7) */
  loginDay: number;
  /** Total matches played */
  matchesPlayed: number;
  /** Total wins */
  wins: number;
  /** Match history (most recent first, max 50) */
  matchHistory: NcMatchRecord[];
  /** Battle Pass state */
  battlePass?: NcBattlePassState;
  /** Favorite card IDs */
  favorites?: string[];
  /** Ranked ladder state */
  ranked?: NcRankedState;
}

// ── Ranked Ladder ─────────────────────────────────────────────────────────

export type NcRankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';

export interface NcRankDef {
  tier: NcRankTier;
  division: number; // 3=lowest, 1=highest within tier; master has 0
  minPoints: number;
  maxPoints: number; // exclusive (next rank starts here)
}

export interface NcRankedState {
  points: number;
  peakPoints: number;
  /** Season identifier e.g. "2026-03" */
  seasonId: string;
  /** Total ranked wins this season */
  seasonWins: number;
  /** Total ranked losses this season */
  seasonLosses: number;
}

export interface NcRankReward {
  coins: number;
  gems: number;
  packs?: { type: 'standard' | 'premium'; count: number };
}

// Points per rank bracket
export const NC_RANK_DEFS: NcRankDef[] = [
  { tier: 'bronze',   division: 3, minPoints: 0,    maxPoints: 100  },
  { tier: 'bronze',   division: 2, minPoints: 100,  maxPoints: 200  },
  { tier: 'bronze',   division: 1, minPoints: 200,  maxPoints: 300  },
  { tier: 'silver',   division: 3, minPoints: 300,  maxPoints: 450  },
  { tier: 'silver',   division: 2, minPoints: 450,  maxPoints: 600  },
  { tier: 'silver',   division: 1, minPoints: 600,  maxPoints: 750  },
  { tier: 'gold',     division: 3, minPoints: 750,  maxPoints: 950  },
  { tier: 'gold',     division: 2, minPoints: 950,  maxPoints: 1150 },
  { tier: 'gold',     division: 1, minPoints: 1150, maxPoints: 1350 },
  { tier: 'platinum', division: 3, minPoints: 1350, maxPoints: 1600 },
  { tier: 'platinum', division: 2, minPoints: 1600, maxPoints: 1850 },
  { tier: 'platinum', division: 1, minPoints: 1850, maxPoints: 2100 },
  { tier: 'diamond',  division: 3, minPoints: 2100, maxPoints: 2400 },
  { tier: 'diamond',  division: 2, minPoints: 2400, maxPoints: 2700 },
  { tier: 'diamond',  division: 1, minPoints: 2700, maxPoints: 3000 },
  { tier: 'master',   division: 0, minPoints: 3000, maxPoints: 99999 },
];

export const NC_RANK_WIN_POINTS = 30;
export const NC_RANK_LOSS_POINTS = 15;

/** Get the rank definition for a given point total */
export function getNcRank(points: number): NcRankDef {
  for (let i = NC_RANK_DEFS.length - 1; i >= 0; i--) {
    if (points >= NC_RANK_DEFS[i].minPoints) return NC_RANK_DEFS[i];
  }
  return NC_RANK_DEFS[0];
}

/** Get rank display label e.g. "Gold II" */
export function getNcRankLabel(rank: NcRankDef): string {
  if (rank.tier === 'master') return 'Master';
  const roman = ['', 'I', 'II', 'III'];
  return `${rank.tier.charAt(0).toUpperCase() + rank.tier.slice(1)} ${roman[rank.division]}`;
}

/** Monthly reset rewards based on peak rank */
export const NC_RANK_REWARDS: Record<NcRankTier, NcRankReward> = {
  bronze:   { coins: 50,   gems: 0  },
  silver:   { coins: 100,  gems: 5  },
  gold:     { coins: 200,  gems: 15 },
  platinum: { coins: 400,  gems: 30, packs: { type: 'standard', count: 2 } },
  diamond:  { coins: 700,  gems: 50, packs: { type: 'premium', count: 1 } },
  master:   { coins: 1000, gems: 80, packs: { type: 'premium', count: 2 } },
};

/** Get current season id (YYYY-MM) */
export function getNcCurrentSeason(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** @deprecated kept for compat — difficulty is now randomized per round */
export type NcBotDifficulty = 'easy' | 'medium' | 'hard';
export const NC_BOT_TOKEN_PREFIX = 'nc-bot-';
export function isNcBotToken(token: string): boolean {
  return token.startsWith(NC_BOT_TOKEN_PREFIX);
}

export const NC_DECK_SIZE = 12;
export const NC_MAX_COPIES = 1;
export const NC_START_HAND = 4;
export const NC_DRAW_PER_ROUND = 2;
export const NC_START_MANA = 3;
export const NC_MAX_MANA = 8;
export const NC_MANA_PER_ROUND = 1;
export const NC_LANES = 3;
export const NC_PUSH_PER_POWER = 6;
export const NC_ONGOING_PUSH_RATIO = 0.5;
export const NC_DESTROY_TUG_REFUND = 0.5;
export const NC_BREAKTHROUGH_THRESHOLD = 150;
export const NC_BREAKTHROUGHS_TO_WIN = 2;
export const NC_MAX_ROUNDS = 7;
export const NC_TURN_TIME_MS = 30_000;
export const NC_MIN_HAND_SIZE = 3;

// ── Tag Synergy System ───────────────────────────────────────────────────────
/** Power bonus per friendly card in the same lane that shares at least 1 tag */
export const NC_RESONANCE_BONUS = 1;
/** Minimum cards of the same tag in a lane to activate dominance */
export const NC_DOMINANCE_THRESHOLD = 3;
/** Flat power bonus to all cards of the dominant tag */
export const NC_DOMINANCE_BONUS = 2;

// ── Pack Constants ──────────────────────────────────────────────────────────

export const NC_STANDARD_PACK_COST = 100; // coins
export const NC_PREMIUM_PACK_COST = 50;   // gems
export const NC_CARDS_PER_PACK = 3;

export const NC_STANDARD_RATES: Record<NcRarity, number> = {
  common: 0.78,
  rare: 0.17,
  epic: 0.04,
  legendary: 0.01,
};

export const NC_PREMIUM_RATES: Record<NcRarity, number> = {
  common: 0,
  rare: 0.70,
  epic: 0.24,
  legendary: 0.06,
};

/** Shard refund when opening a duplicate card */
export const NC_DUPLICATE_SHARDS: Record<NcRarity, number> = {
  common: 5,
  rare: 15,
  epic: 40,
  legendary: 100,
};

/** Shard cost to buy a specific card in the shard shop */
export const NC_SHARD_PRICES: Record<NcRarity, number> = {
  common: 20,
  rare: 60,
  epic: 160,
  legendary: 400,
};

/** @deprecated Use NC_DUPLICATE_SHARDS instead */
export const NC_DUPLICATE_REFUND: Record<NcRarity, number> = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 100,
};

// ── Reward Constants ────────────────────────────────────────────────────────

export const NC_WIN_COINS = 30;
export const NC_LOSS_COINS = 10;
export const NC_DAILY_QUEST_COINS = 50;
export const NC_WEEKLY_QUEST_GEMS = 20;
export const NC_STARTER_COINS = 300;
/** Deterministic daily reward for any day number (1-based, infinite). */
export function getNcDailyReward(day: number): { coins: number; shards: number; gems?: number } {
  // Cycle patterns every 7 days with slight variation
  const cycle = ((day - 1) % 7);          // 0-6
  const week = Math.floor((day - 1) / 7); // which week we're in
  // Base coins: 15-30, varies by day-in-cycle
  const coinPattern = [15, 20, 15, 25, 20, 25, 35];
  const coins = coinPattern[cycle] + Math.min(week, 5); // tiny weekly bonus, caps at +5
  // Shards: most days 0, some days 2-5
  const shardPattern = [0, 0, 2, 0, 3, 0, 5];
  const shards = shardPattern[cycle];
  // Gems: only every 7th day
  const gems = cycle === 6 ? 5 : undefined;
  return gems !== undefined ? { coins, shards, gems } : { coins, shards };
}

// ── Lane Modifier Definitions ───────────────────────────────────────────────

export const NC_LANE_MODIFIERS: NcLaneModifier[] = [
  'cost_reduction',
  'double_first',
  'indestructible',
  'inverted_power',
  'power_surge',
  'mana_drain',
  'fortified',
  'echo',
  'volatile',
  'silent',
  'accelerate',
  'siphon',
];

/** Round at which lane modifiers rotate (0 = no rotation) */
export const NC_MODIFIER_ROTATION_ROUND = 4;

// ── Card Definitions — Set "Origins" ────────────────────────────────────────

export const NC_CARDS: NcCardDef[] = [
  // ── Commons ──
  { id: 'schildbot', nameKey: 'nc.card.schildbot', cost: 2, power: 2, tags: ['mech'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'shield', value: 2 } },
  { id: 'aufklaerer', nameKey: 'nc.card.aufklaerer', cost: 1, power: 2, tags: ['mech', 'shadow'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'move_to_lane', laneTarget: 'strongest' } },
  { id: 'skelett_horde', nameKey: 'nc.card.skelett_horde', cost: 1, power: 1, tags: ['undead'], rarity: 'common', ability: { trigger: 'on_ally_played', effect: 'buff_self', value: 1 } },
  { id: 'druidin', nameKey: 'nc.card.druidin', cost: 2, power: 2, tags: ['nature', 'arcane'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 1 } },
  { id: 'hermes', nameKey: 'nc.card.hermes', cost: 2, power: 2, tags: ['divine', 'shadow'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'move_to_lane', laneTarget: 'weakest' } },
  { id: 'verzauberin', nameKey: 'nc.card.verzauberin', cost: 2, power: 2, tags: ['arcane', 'nature'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'swap_lane_positions' } },
  { id: 'hydra', nameKey: 'nc.card.hydra', cost: 3, power: 3, tags: ['beast', 'undead'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'buff_self_per_enemy', value: 1 } },
  { id: 'leerenmagier', nameKey: 'nc.card.leerenmagier', cost: 3, power: 3, tags: ['arcane', 'shadow'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'debuff_enemies', value: 1 } },
  { id: 'assassine', nameKey: 'nc.card.assassine', cost: 3, power: 3, tags: ['shadow'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'destroy_weakest_enemy' } },
  { id: 'paladin', nameKey: 'nc.card.paladin', cost: 3, power: 3, tags: ['noble', 'divine'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'shield_allies', value: 1 } },
  { id: 'waldlaeufer', nameKey: 'nc.card.waldlaeufer', cost: 2, power: 3, tags: ['nature', 'beast'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 1, tagFilter: 'beast' } },
  { id: 'geisterjunge', nameKey: 'nc.card.geisterjunge', cost: 1, power: 2, tags: ['undead', 'shadow'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'return_to_hand', laneTarget: 'weakest' } },
  // ── Rares ──
  { id: 'apollo', nameKey: 'nc.card.apollo', cost: 3, power: 4, tags: ['divine', 'nature'], rarity: 'rare', ability: { trigger: 'ongoing', effect: 'power_per_tag', value: 1, tagFilter: 'divine' } },
  { id: 'greif', nameKey: 'nc.card.greif', cost: 3, power: 4, tags: ['beast', 'noble'], rarity: 'rare', ability: { trigger: 'ongoing', effect: 'double_push_if', conditionTag: 'beast', conditionCount: 2 } },
  { id: 'energiekern', nameKey: 'nc.card.energiekern', cost: 2, power: 2, tags: ['mech', 'arcane'], rarity: 'rare', ability: { trigger: 'ongoing', effect: 'push_bonus', value: 2 } },
  { id: 'athena', nameKey: 'nc.card.athena', cost: 4, power: 4, tags: ['divine', 'arcane'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 2 } },
  { id: 'phoenix', nameKey: 'nc.card.phoenix', cost: 4, power: 4, tags: ['beast', 'arcane'], rarity: 'rare', ability: { trigger: 'on_destroy', effect: 'buff_self', value: -1 } }, // special: respawn with 3 power
  { id: 'erzmagier', nameKey: 'nc.card.erzmagier', cost: 4, power: 3, tags: ['arcane'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'copy_strongest_ally_power' } },
  { id: 'kriegsherr', nameKey: 'nc.card.kriegsherr', cost: 4, power: 5, tags: ['noble'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'push_bonus', value: 3 } },
  { id: 'seelendieb', nameKey: 'nc.card.seelendieb', cost: 4, power: 5, tags: ['shadow', 'undead'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'drain', value: 2 } },
  // ── Epics ──
  { id: 'treant', nameKey: 'nc.card.treant', cost: 4, power: 6, tags: ['nature'], rarity: 'epic', ability: { trigger: 'ongoing', effect: 'power_per_tag', value: 1, tagFilter: 'nature' } },
  { id: 'lichkoenig', nameKey: 'nc.card.lichkoenig', cost: 5, power: 6, tags: ['undead', 'arcane'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 2, tagFilter: 'undead' } },
  { id: 'zeus', nameKey: 'nc.card.zeus', cost: 5, power: 7, tags: ['divine', 'noble'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 2, tagFilter: 'divine' } },
  { id: 'fenrir', nameKey: 'nc.card.fenrir', cost: 6, power: 7, tags: ['beast', 'shadow'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'destroy_weakest_enemy' } },
  // ── Legendaries ──
  { id: 'titan_mk3', nameKey: 'nc.card.titan_mk3', cost: 6, power: 9, tags: ['mech'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 2, tagFilter: 'mech' } },
  // ── New Commons ──
  { id: 'nebelkrieger', nameKey: 'nc.card.nebelkrieger', cost: 2, power: 3, tags: ['shadow', 'undead'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'debuff_strongest_enemy', value: 2 } },
  { id: 'lichtbringer', nameKey: 'nc.card.lichtbringer', cost: 2, power: 2, tags: ['divine', 'arcane'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'mana_boost', value: 1 } },
  { id: 'wurzelgolem', nameKey: 'nc.card.wurzelgolem', cost: 3, power: 4, tags: ['nature', 'mech'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'push_bonus', value: 1 } },
  // ── New Rares ──
  { id: 'frostriese', nameKey: 'nc.card.frostriese', cost: 4, power: 5, tags: ['beast', 'nature'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'debuff_enemies', value: 2 } },
  { id: 'zeitweber', nameKey: 'nc.card.zeitweber', cost: 3, power: 3, tags: ['arcane', 'shadow'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'draw_card', value: 1 } },
  { id: 'koenigsgarde', nameKey: 'nc.card.koenigsgarde', cost: 4, power: 6, tags: ['noble', 'mech'], rarity: 'rare', ability: { trigger: 'on_ally_played', effect: 'shield', value: 1 } },
  // ── New Epics ──
  { id: 'valkyria', nameKey: 'nc.card.valkyria', cost: 5, power: 6, tags: ['divine', 'beast'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'mana_boost', value: 2 } },
  { id: 'schattenjaeger', nameKey: 'nc.card.schattenjaeger', cost: 4, power: 5, tags: ['shadow', 'mech'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'tug_shift', value: 4 } },
  { id: 'weltenbaum', nameKey: 'nc.card.weltenbaum', cost: 5, power: 7, tags: ['nature', 'arcane'], rarity: 'epic', ability: { trigger: 'ongoing', effect: 'power_per_tag', value: 1, tagFilter: 'arcane' } },
  // ── New Legendaries ──
  { id: 'odin', nameKey: 'nc.card.odin', cost: 7, power: 10, tags: ['divine', 'noble'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 3 } },
  { id: 'mechanicus', nameKey: 'nc.card.mechanicus', cost: 6, power: 8, tags: ['mech', 'arcane'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'draw_card', value: 2 } },
  { id: 'nyx', nameKey: 'nc.card.nyx', cost: 7, power: 9, tags: ['shadow', 'undead'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'destroy_strongest_enemy' } },
  // ── Zaubersprüche (Spells) ──
  { id: 'feuersturm', nameKey: 'nc.card.feuersturm', cost: 2, power: 1, tags: ['spell', 'arcane'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'tug_shift', value: 2 } },
  { id: 'eisschild', nameKey: 'nc.card.eisschild', cost: 2, power: 2, tags: ['spell', 'nature'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'shield_allies', value: 2 } },
  { id: 'blitzschlag', nameKey: 'nc.card.blitzschlag', cost: 1, power: 2, tags: ['spell', 'divine'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'destroy_random_enemy' } },
  { id: 'seelenbrand', nameKey: 'nc.card.seelenbrand', cost: 3, power: 2, tags: ['spell', 'shadow'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'drain', value: 3 } },
  { id: 'dimensionsriss', nameKey: 'nc.card.dimensionsriss', cost: 3, power: 3, tags: ['spell', 'arcane'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'move_to_lane', laneTarget: 'random' } },
  { id: 'zeitstillstand', nameKey: 'nc.card.zeitstillstand', cost: 4, power: 3, tags: ['spell', 'arcane'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'return_to_hand', laneTarget: 'strongest' } },
  { id: 'arkanexplosion', nameKey: 'nc.card.arkanexplosion', cost: 5, power: 3, tags: ['spell', 'arcane'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'debuff_enemies', value: 3 } },
  { id: 'weltensturm', nameKey: 'nc.card.weltensturm', cost: 5, power: 4, tags: ['spell', 'nature'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 2, tagFilter: 'nature' } },
  { id: 'goetterdaemmerung', nameKey: 'nc.card.goetterdaemmerung', cost: 7, power: 5, tags: ['spell', 'divine'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'debuff_enemies', value: 4 } },
  // ── Drachen (Dragons) ──
  { id: 'jungdrache', nameKey: 'nc.card.jungdrache', cost: 2, power: 3, tags: ['dragon', 'beast'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 1, tagFilter: 'dragon' } },
  { id: 'drachenschuppe', nameKey: 'nc.card.drachenschuppe', cost: 2, power: 2, tags: ['dragon', 'nature'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'tug_shift', value: 1 } },
  { id: 'feuerodem', nameKey: 'nc.card.feuerodem', cost: 3, power: 3, tags: ['dragon', 'arcane'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'debuff_strongest_enemy', value: 1 } },
  { id: 'sturmdrache', nameKey: 'nc.card.sturmdrache', cost: 4, power: 5, tags: ['dragon', 'divine'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'tug_shift', value: 3 } },
  { id: 'drachenhort', nameKey: 'nc.card.drachenhort', cost: 3, power: 4, tags: ['dragon', 'noble'], rarity: 'rare', ability: { trigger: 'ongoing', effect: 'power_per_tag', value: 1, tagFilter: 'dragon' } },
  { id: 'uralter_wyrm', nameKey: 'nc.card.uralter_wyrm', cost: 6, power: 8, tags: ['dragon'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 2, tagFilter: 'dragon' } },
  { id: 'bahamut', nameKey: 'nc.card.bahamut', cost: 7, power: 10, tags: ['dragon', 'divine'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 3, tagFilter: 'dragon' } },
  // ── Dämonen (Demons) ──
  { id: 'imp', nameKey: 'nc.card.imp', cost: 1, power: 2, tags: ['demon', 'shadow'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'debuff_enemies', value: 1 } },
  { id: 'hoellenhund', nameKey: 'nc.card.hoellenhund', cost: 2, power: 3, tags: ['demon', 'beast'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'drain', value: 1 } },
  { id: 'schattendaemon', nameKey: 'nc.card.schattendaemon', cost: 3, power: 3, tags: ['demon', 'shadow'], rarity: 'common', ability: { trigger: 'on_ally_played', effect: 'debuff_enemies', value: 1 } },
  { id: 'sukubus', nameKey: 'nc.card.sukubus', cost: 3, power: 4, tags: ['demon', 'arcane'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'return_to_hand', laneTarget: 'random' } },
  { id: 'hoellenfuerst', nameKey: 'nc.card.hoellenfuerst', cost: 4, power: 5, tags: ['demon', 'noble'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 1, tagFilter: 'demon' } },
  { id: 'erzdaemon', nameKey: 'nc.card.erzdaemon', cost: 5, power: 7, tags: ['demon', 'shadow'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'debuff_strongest_enemy', value: 4 } },
  { id: 'abaddon', nameKey: 'nc.card.abaddon', cost: 7, power: 9, tags: ['demon'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'debuff_strongest_enemy', value: 5 } },
  // ── Relikte (Relics) ──
  { id: 'runenstein', nameKey: 'nc.card.runenstein', cost: 1, power: 1, tags: ['relic', 'arcane'], rarity: 'common', ability: { trigger: 'ongoing', effect: 'push_bonus', value: 1 } },
  { id: 'schutztalisman', nameKey: 'nc.card.schutztalisman', cost: 2, power: 2, tags: ['relic', 'divine'], rarity: 'common', ability: { trigger: 'on_destroy', effect: 'buff_allies', value: 1 } },
  { id: 'kriegshorn', nameKey: 'nc.card.kriegshorn', cost: 2, power: 2, tags: ['relic', 'noble'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'push_bonus', value: 2 } },
  { id: 'seelengefaess', nameKey: 'nc.card.seelengefaess', cost: 3, power: 3, tags: ['relic', 'shadow'], rarity: 'rare', ability: { trigger: 'on_destroy', effect: 'drain', value: 2 } },
  { id: 'machtkrone', nameKey: 'nc.card.machtkrone', cost: 4, power: 4, tags: ['relic', 'noble'], rarity: 'rare', ability: { trigger: 'ongoing', effect: 'power_per_tag', value: 1, tagFilter: 'relic' } },
  { id: 'schicksalsklinge', nameKey: 'nc.card.schicksalsklinge', cost: 5, power: 5, tags: ['relic', 'mech'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'drain', value: 4 } },
  { id: 'weltenamboss', nameKey: 'nc.card.weltenamboss', cost: 6, power: 7, tags: ['relic', 'mech'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 2, tagFilter: 'relic' } },
  // ── Battle Pass Exclusives ──
  { id: 'nexuswächter', nameKey: 'nc.card.nexuswaechter', cost: 5, power: 6, tags: ['divine', 'arcane'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'shield', value: 3 } },
  { id: 'chronokaiser', nameKey: 'nc.card.chronokaiser', cost: 7, power: 9, tags: ['arcane', 'noble'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'draw_card', value: 3 } },
];

/** Card lookup map by id */
export const NC_CARD_MAP: Record<string, NcCardDef> = {};
for (const card of NC_CARDS) {
  NC_CARD_MAP[card.id] = card;
}

/** Cards grouped by rarity */
export const NC_CARDS_BY_RARITY: Record<NcRarity, NcCardDef[]> = {
  common: NC_CARDS.filter(c => c.rarity === 'common'),
  rare: NC_CARDS.filter(c => c.rarity === 'rare'),
  epic: NC_CARDS.filter(c => c.rarity === 'epic'),
  legendary: NC_CARDS.filter(c => c.rarity === 'legendary'),
};

/** Hand-picked 12 starter cards — balanced curve, diverse mechanics & rarities */
export const NC_STARTER_CARDS: string[] = [
  // 1-cost (3)
  'aufklaerer',     // common — lane movement
  'imp',            // common — debuff enemies
  'runenstein',     // common — ongoing push bonus
  // 2-cost (5)
  'schildbot',      // common — shield
  'druidin',        // common — buff allies
  'nebelkrieger',   // common — debuff strongest
  'kriegshorn',     // common — push bonus
  'greif',          // rare — double push if beasts
  // 3-cost (3)
  'hydra',          // common — scales with enemies
  'assassine',      // common — destroy weakest
  'paladin',        // common — shield allies
  // 4-cost (1)
  'phoenix',        // epic — respawn on destroy
];

/** Create a default new player profile */
export function createDefaultNcProfile(): NcPlayerProfile {
  const collection: Record<string, number> = {};
  for (const id of NC_STARTER_CARDS) {
    collection[id] = 1; // collected = permanent
  }
  const defaultDeck: NcDeckSlot = {
    id: 'default',
    name: 'Starter',
    cards: NC_STARTER_CARDS.slice(0, NC_DECK_SIZE), // 12 unique commons = full starter deck
  };
  return {
    collection: { cards: collection },
    currencies: { coins: NC_STARTER_COINS, gems: 0, shards: 0 },
    decks: [defaultDeck],
    selectedDeckId: 'default',
    quests: [],
    lastDailyReset: '',
    lastWeeklyReset: '',
    lastLoginReward: '',
    loginDay: 0,
    matchesPlayed: 0,
    wins: 0,
    matchHistory: [],
  };
}

// ── Deck Code (Import/Export) ──────────────────────────────────────────────

const NC_DECK_CODE_PREFIX = 'NC1:';
const NC_DECK_CODE_SEP = '.';

/** Encode a deck to a shareable string code */
export function encodeDeckCode(cards: string[]): string {
  const sorted = [...cards].sort();
  return NC_DECK_CODE_PREFIX + sorted.join(NC_DECK_CODE_SEP);
}

/** Decode a deck code string, returns card IDs or null if invalid */
export function decodeDeckCode(code: string): string[] | null {
  if (!code.startsWith(NC_DECK_CODE_PREFIX)) return null;
  try {
    const payload = code.slice(NC_DECK_CODE_PREFIX.length);
    const ids = payload.split(NC_DECK_CODE_SEP).filter(Boolean);
    if (ids.length === 0 || ids.length > NC_DECK_SIZE) return null;
    for (const id of ids) {
      if (!NC_CARD_MAP[id]) return null;
    }
    return ids;
  } catch {
    return null;
  }
}
