// ── Nexus Clash — Shared Types & Constants ─────────────────────────────────

// ── Tags ────────────────────────────────────────────────────────────────────

export type NcTag = 'divine' | 'arcane' | 'beast' | 'mech' | 'undead' | 'nature' | 'shadow' | 'noble';

// ── Rarities ────────────────────────────────────────────────────────────────

export type NcRarity = 'common' | 'rare' | 'epic' | 'legendary';

// ── Abilities ───────────────────────────────────────────────────────────────

export type NcTrigger = 'on_reveal' | 'ongoing' | 'on_destroy' | 'on_ally_played';

export type NcEffectType =
  | 'buff_allies'
  | 'buff_self'
  | 'debuff_enemies'
  | 'push_bonus'
  | 'move_to_lane'
  | 'destroy_weakest_enemy'
  | 'copy_strongest_ally_power'
  | 'shield'
  | 'drain'
  | 'double_push_if'
  | 'power_per_tag'
  | 'swap_lane_positions'
  | 'draw_card'
  | 'mana_boost'
  | 'heal_allies'
  | 'destroy_strongest_enemy';

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
  | 'tag_bonus_divine'
  | 'tag_bonus_mech'
  | 'tag_bonus_beast';

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
  | { type: 'breakthrough'; laneIndex: number; winner: 0 | 1 };

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

export type NexusClashAction = NcPlaceCardAction | NcUndoPlaceAction | NcConfirmAction | NcMulliganAction;

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
}

// ── Constants ───────────────────────────────────────────────────────────────

export type NcBotDifficulty = 'easy' | 'medium' | 'hard';
export const NC_BOT_TOKEN_PREFIX = 'nc-bot-';
export function isNcBotToken(token: string): boolean {
  return token.startsWith(NC_BOT_TOKEN_PREFIX);
}

export const NC_DECK_SIZE = 12;
export const NC_MAX_COPIES = 1;
export const NC_START_HAND = 4;
export const NC_DRAW_PER_ROUND = 1;
export const NC_START_MANA = 3;
export const NC_MAX_MANA = 8;
export const NC_MANA_PER_ROUND = 1;
export const NC_LANES = 3;
export const NC_PUSH_PER_POWER = 10;
export const NC_BREAKTHROUGH_THRESHOLD = 100;
export const NC_BREAKTHROUGHS_TO_WIN = 2;
export const NC_MAX_ROUNDS = 7;
export const NC_TURN_TIME_MS = 30_000;

// ── Pack Constants ──────────────────────────────────────────────────────────

export const NC_STANDARD_PACK_COST = 100; // coins
export const NC_PREMIUM_PACK_COST = 50;   // gems
export const NC_CARDS_PER_PACK = 3;

export const NC_STANDARD_RATES: Record<NcRarity, number> = {
  common: 0.70,
  rare: 0.25,
  epic: 0.045,
  legendary: 0.005,
};

export const NC_PREMIUM_RATES: Record<NcRarity, number> = {
  common: 0,
  rare: 0.40,
  epic: 0.45,
  legendary: 0.15,
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
  'tag_bonus_divine',
  'tag_bonus_mech',
  'tag_bonus_beast',
];

// ── Card Definitions — Set "Origins" ────────────────────────────────────────

export const NC_CARDS: NcCardDef[] = [
  // ── Commons ──
  { id: 'schildbot', nameKey: 'nc.card.schildbot', cost: 2, power: 2, tags: ['mech'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'shield', value: 2 } },
  { id: 'aufklaerer', nameKey: 'nc.card.aufklaerer', cost: 1, power: 2, tags: ['mech', 'shadow'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'move_to_lane', laneTarget: 'strongest' } },
  { id: 'skelett_horde', nameKey: 'nc.card.skelett_horde', cost: 1, power: 1, tags: ['undead'], rarity: 'common', ability: { trigger: 'on_ally_played', effect: 'buff_self', value: 1 } },
  { id: 'druidin', nameKey: 'nc.card.druidin', cost: 2, power: 2, tags: ['nature', 'arcane'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 1 } },
  { id: 'hermes', nameKey: 'nc.card.hermes', cost: 2, power: 2, tags: ['divine', 'shadow'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'move_to_lane', laneTarget: 'weakest' } },
  { id: 'verzauberin', nameKey: 'nc.card.verzauberin', cost: 2, power: 2, tags: ['arcane', 'nature'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'swap_lane_positions' } },
  { id: 'hydra', nameKey: 'nc.card.hydra', cost: 3, power: 3, tags: ['beast', 'undead'], rarity: 'common', ability: { trigger: 'on_ally_played', effect: 'buff_self', value: 1 } },
  { id: 'leerenmagier', nameKey: 'nc.card.leerenmagier', cost: 3, power: 3, tags: ['arcane', 'shadow'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'debuff_enemies', value: 1 } },
  { id: 'assassine', nameKey: 'nc.card.assassine', cost: 3, power: 3, tags: ['shadow'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'destroy_weakest_enemy' } },
  { id: 'paladin', nameKey: 'nc.card.paladin', cost: 3, power: 4, tags: ['noble', 'divine'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'shield', value: 1 } },
  { id: 'waldlaeufer', nameKey: 'nc.card.waldlaeufer', cost: 2, power: 3, tags: ['nature', 'beast'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 1, tagFilter: 'beast' } },
  { id: 'geisterjunge', nameKey: 'nc.card.geisterjunge', cost: 1, power: 2, tags: ['undead', 'shadow'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'debuff_enemies', value: 1 } },
  // ── Rares ──
  { id: 'apollo', nameKey: 'nc.card.apollo', cost: 3, power: 4, tags: ['divine', 'nature'], rarity: 'rare', ability: { trigger: 'ongoing', effect: 'power_per_tag', value: 1, tagFilter: 'divine' } },
  { id: 'greif', nameKey: 'nc.card.greif', cost: 3, power: 4, tags: ['beast', 'noble'], rarity: 'rare', ability: { trigger: 'ongoing', effect: 'double_push_if', conditionCount: 2, conditionTag: 'beast' } },
  { id: 'energiekern', nameKey: 'nc.card.energiekern', cost: 2, power: 2, tags: ['mech', 'arcane'], rarity: 'rare', ability: { trigger: 'ongoing', effect: 'push_bonus', value: 2 } },
  { id: 'athena', nameKey: 'nc.card.athena', cost: 4, power: 5, tags: ['divine', 'arcane'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 1 } },
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
  { id: 'nebelkrieger', nameKey: 'nc.card.nebelkrieger', cost: 2, power: 3, tags: ['shadow', 'undead'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'debuff_enemies', value: 1 } },
  { id: 'lichtbringer', nameKey: 'nc.card.lichtbringer', cost: 2, power: 2, tags: ['divine', 'arcane'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'mana_boost', value: 1 } },
  { id: 'wurzelgolem', nameKey: 'nc.card.wurzelgolem', cost: 3, power: 4, tags: ['nature', 'mech'], rarity: 'common', ability: { trigger: 'on_reveal', effect: 'push_bonus', value: 1 } },
  // ── New Rares ──
  { id: 'frostriese', nameKey: 'nc.card.frostriese', cost: 4, power: 5, tags: ['beast', 'nature'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'debuff_enemies', value: 2 } },
  { id: 'zeitweber', nameKey: 'nc.card.zeitweber', cost: 3, power: 3, tags: ['arcane', 'shadow'], rarity: 'rare', ability: { trigger: 'on_reveal', effect: 'draw_card', value: 1 } },
  { id: 'koenigsgarde', nameKey: 'nc.card.koenigsgarde', cost: 4, power: 6, tags: ['noble', 'mech'], rarity: 'rare', ability: { trigger: 'on_ally_played', effect: 'shield', value: 1 } },
  // ── New Epics ──
  { id: 'valkyria', nameKey: 'nc.card.valkyria', cost: 5, power: 6, tags: ['divine', 'beast'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'mana_boost', value: 2 } },
  { id: 'schattenjaeger', nameKey: 'nc.card.schattenjaeger', cost: 4, power: 5, tags: ['shadow', 'mech'], rarity: 'epic', ability: { trigger: 'on_reveal', effect: 'destroy_strongest_enemy' } },
  { id: 'weltenbaum', nameKey: 'nc.card.weltenbaum', cost: 5, power: 7, tags: ['nature', 'arcane'], rarity: 'epic', ability: { trigger: 'ongoing', effect: 'power_per_tag', value: 1, tagFilter: 'nature' } },
  // ── New Legendaries ──
  { id: 'odin', nameKey: 'nc.card.odin', cost: 7, power: 10, tags: ['divine', 'noble'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'buff_allies', value: 3 } },
  { id: 'mechanicus', nameKey: 'nc.card.mechanicus', cost: 6, power: 8, tags: ['mech', 'arcane'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'draw_card', value: 2 } },
  { id: 'nyx', nameKey: 'nc.card.nyx', cost: 7, power: 9, tags: ['shadow', 'undead'], rarity: 'legendary', ability: { trigger: 'on_reveal', effect: 'destroy_strongest_enemy' } },
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

/** Starter card ids (12 commons) */
export const NC_STARTER_CARDS: string[] = NC_CARDS.filter(c => c.rarity === 'common').map(c => c.id);

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
  };
}
