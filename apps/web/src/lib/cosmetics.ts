import type { CosmeticsSelection, CosmeticsSlots } from 'shared';

// ── Storage ──────────────────────────────────────────────────────────────────

export const COSMETICS_KEY = 'wg_cosmetics';

// Legacy individual keys (for migration)
const LEGACY_AVATAR_KEY = 'wg_avatar';
const LEGACY_NAME_COLOR_KEY = 'wg_name_color';
const LEGACY_FRAME_KEY = 'wg_avatar_frame';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Load unified cosmetics from localStorage.
 * Migrates from legacy individual keys if the unified key is missing.
 */
export function loadCosmetics(): CosmeticsSelection {
  if (!isBrowser()) return { slots: {} };

  try {
    const raw = localStorage.getItem(COSMETICS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { slots: {}, ...parsed };
    }
  } catch { /* fall through to migration */ }

  // Migration: read from legacy individual keys
  const avatarId = localStorage.getItem(LEGACY_AVATAR_KEY) || undefined;
  const nameColor = localStorage.getItem(LEGACY_NAME_COLOR_KEY) || undefined;
  const frame = localStorage.getItem(LEGACY_FRAME_KEY) || undefined;
  const cosmetics: CosmeticsSelection = {
    avatarId,
    nameColor,
    slots: { frame },
  };

  // Save unified key for future loads
  saveCosmetics(cosmetics);
  return cosmetics;
}

/**
 * Save unified cosmetics + write legacy keys for backward compatibility.
 */
export function saveCosmetics(c: CosmeticsSelection): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(COSMETICS_KEY, JSON.stringify(c));

    // Legacy keys (compat with useMultiplayer / useGlobalChat old paths)
    if (c.avatarId) localStorage.setItem(LEGACY_AVATAR_KEY, c.avatarId);
    else localStorage.removeItem(LEGACY_AVATAR_KEY);

    if (c.nameColor) localStorage.setItem(LEGACY_NAME_COLOR_KEY, c.nameColor);
    else localStorage.removeItem(LEGACY_NAME_COLOR_KEY);

    if (c.slots?.frame && c.slots.frame !== 'none') localStorage.setItem(LEGACY_FRAME_KEY, c.slots.frame);
    else localStorage.removeItem(LEGACY_FRAME_KEY);
  } catch { /* quota exceeded */ }
}

/**
 * Shallow merge with nested slots merge.
 */
export function mergeCosmetics(current: CosmeticsSelection, patch: Partial<CosmeticsSelection>): CosmeticsSelection {
  const merged: CosmeticsSelection = {
    ...current,
    ...patch,
    slots: { ...current.slots, ...patch.slots },
  };
  // badges is top-level array — override entirely when present in patch
  if (patch.badges !== undefined) merged.badges = patch.badges;
  return merged;
}

// ── Cosmetics Registry ──────────────────────────────────────────────────────

export type CosmeticSlot = 'frame' | 'head' | 'portal' | 'aura' | 'banner' | 'cardColor' | 'badge' | 'title';
export type CosmeticRarity = 'common' | 'epic' | 'rare' | 'legendary';

export interface CosmeticAnchor {
  top?: string;
  left?: string;
  scale?: number;
  rotate?: string;
}

/** Cosmetic set grouping — items from the same set share a thematic identity */
export type CosmeticSet = 'inferno' | 'royal' | 'neon' | 'shadow' | 'frost' | 'ocean' | 'nature';

export interface CosmeticDef {
  id: string;
  slot: CosmeticSlot;
  rarity: CosmeticRarity;
  labelKey: string;
  emoji: string;
  requiredAchievement?: string;
  /** i18n key describing how to unlock this cosmetic */
  unlockHintKey?: string;
  /** i18n key with a short description / purpose of this cosmetic */
  descriptionKey?: string;
  /** Fine-tune head cosmetic positioning */
  anchor?: CosmeticAnchor;
  /** Thematic set this cosmetic belongs to */
  set?: CosmeticSet;
}

export const COSMETIC_SET_LABELS: Record<CosmeticSet, { labelKey: string; color: string }> = {
  inferno: { labelKey: 'cosmetic.set.inferno', color: 'text-orange-400' },
  royal:   { labelKey: 'cosmetic.set.royal',   color: 'text-amber-400' },
  neon:    { labelKey: 'cosmetic.set.neon',     color: 'text-fuchsia-400' },
  shadow:  { labelKey: 'cosmetic.set.shadow',   color: 'text-purple-400' },
  frost:   { labelKey: 'cosmetic.set.frost',    color: 'text-cyan-400' },
  ocean:   { labelKey: 'cosmetic.set.ocean',    color: 'text-blue-400' },
  nature:  { labelKey: 'cosmetic.set.nature',   color: 'text-emerald-400' },
};

export const COSMETICS_REGISTRY: CosmeticDef[] = [
  // ── Frames ──────────────────────────────────────────────────────────────────
  { id: 'bronze', slot: 'frame', rarity: 'epic',  labelKey: 'frame.bronze', emoji: '◆',  requiredAchievement: 'general.play_10', unlockHintKey: 'frame.unlock.bronze' },
  { id: 'silver', slot: 'frame', rarity: 'epic',  labelKey: 'frame.silver', emoji: '◈',  requiredAchievement: 'general.win_10',  unlockHintKey: 'frame.unlock.silver' },
  { id: 'gold',   slot: 'frame', rarity: 'rare',      labelKey: 'frame.gold',   emoji: '✦',  requiredAchievement: 'chess.win_3',     unlockHintKey: 'frame.unlock.gold', set: 'royal' },
  { id: 'fire',   slot: 'frame', rarity: 'legendary', labelKey: 'frame.fire',   emoji: '🔥', requiredAchievement: 'battleship.win_3', unlockHintKey: 'frame.unlock.fire', set: 'inferno' },

  // ── Heads ───────────────────────────────────────────────────────────────────
  { id: 'crown',      slot: 'head', rarity: 'rare',      labelKey: 'cosmetic.head.crown',      emoji: '👑', requiredAchievement: 'general.win_10',    unlockHintKey: 'cosmetic.unlock.crown',      anchor: { top: '-30%', scale: 1.1 }, set: 'royal' },
  { id: 'cap',        slot: 'head', rarity: 'epic',      labelKey: 'cosmetic.head.cap',        emoji: '🧢', requiredAchievement: 'general.play_10',   unlockHintKey: 'cosmetic.unlock.cap',        anchor: { top: '-22%', rotate: '-10deg' } },
  { id: 'wizard_hat', slot: 'head', rarity: 'legendary', labelKey: 'cosmetic.head.wizard_hat', emoji: '🔮', requiredAchievement: 'sudoku.win_5',      unlockHintKey: 'cosmetic.unlock.wizard_hat', anchor: { top: '-32%', scale: 1.05 } },
  { id: 'top_hat',    slot: 'head', rarity: 'epic',      labelKey: 'cosmetic.head.top_hat',    emoji: '🎩', requiredAchievement: 'liarsbar.win_3',    unlockHintKey: 'cosmetic.unlock.top_hat',    anchor: { top: '-34%', scale: 1.05 } },

  // ── Portals ─────────────────────────────────────────────────────────────────
  { id: 'void',   slot: 'portal', rarity: 'rare',      labelKey: 'cosmetic.portal.void',   emoji: '🕳️', requiredAchievement: 'general.first_win',      unlockHintKey: 'cosmetic.unlock.void' },
  { id: 'nebula', slot: 'portal', rarity: 'legendary', labelKey: 'cosmetic.portal.nebula', emoji: '🌌',  requiredAchievement: 'chess.win_3',            unlockHintKey: 'cosmetic.unlock.nebula' },

  // ── Auras ───────────────────────────────────────────────────────────────────
  { id: 'softGlow', slot: 'aura', rarity: 'common',    labelKey: 'cosmetic.aura.softGlow', emoji: '✨', requiredAchievement: 'general.first_game',     unlockHintKey: 'cosmetic.unlock.softGlow' },
  { id: 'electric', slot: 'aura', rarity: 'rare',      labelKey: 'cosmetic.aura.electric', emoji: '⚡', requiredAchievement: 'tictactoe.win_5',        unlockHintKey: 'cosmetic.unlock.electric' },
  { id: 'shadow',   slot: 'aura', rarity: 'legendary', labelKey: 'cosmetic.aura.shadow',   emoji: '🌑', requiredAchievement: 'liarsbar.win_3',         unlockHintKey: 'cosmetic.unlock.shadow', set: 'shadow' },

  // ── Banners ─────────────────────────────────────────────────────────────────
  { id: 'sunset', slot: 'banner', rarity: 'common',    labelKey: 'cosmetic.banner.sunset', emoji: '🌅' },
  { id: 'ocean',  slot: 'banner', rarity: 'common',    labelKey: 'cosmetic.banner.ocean',  emoji: '🌊', set: 'ocean' },
  { id: 'forest', slot: 'banner', rarity: 'epic',      labelKey: 'cosmetic.banner.forest', emoji: '🌲', requiredAchievement: 'general.play_10',   unlockHintKey: 'cosmetic.unlock.forest', set: 'nature' },
  { id: 'aurora', slot: 'banner', rarity: 'rare',      labelKey: 'cosmetic.banner.aurora', emoji: '🌌', requiredAchievement: 'general.win_10',    unlockHintKey: 'cosmetic.unlock.aurora', set: 'frost' },
  { id: 'lava',   slot: 'banner', rarity: 'rare',      labelKey: 'cosmetic.banner.lava',   emoji: '🌋', requiredAchievement: 'battleship.win_3', unlockHintKey: 'cosmetic.unlock.lava', set: 'inferno' },
  { id: 'neon',   slot: 'banner', rarity: 'legendary', labelKey: 'cosmetic.banner.neon',   emoji: '💜', requiredAchievement: 'chess.win_3',      unlockHintKey: 'cosmetic.unlock.neon', set: 'neon' },

  // ── Card Colors ────────────────────────────────────────────────────────────
  { id: 'card-purple', slot: 'cardColor', rarity: 'common',    labelKey: 'cosmetic.card.purple', emoji: '💜' },
  { id: 'card-blue',   slot: 'cardColor', rarity: 'common',    labelKey: 'cosmetic.card.blue',   emoji: '💙' },
  { id: 'card-red',    slot: 'cardColor', rarity: 'common',    labelKey: 'cosmetic.card.red',    emoji: '❤️' },
  { id: 'card-gold',   slot: 'cardColor', rarity: 'epic',      labelKey: 'cosmetic.card.gold',   emoji: '💛', requiredAchievement: 'general.win_10', unlockHintKey: 'cosmetic.unlock.card_gold', set: 'royal' },

  // ── Badges ──────────────────────────────────────────────────────────────────
  { id: 'badge_ttt',        slot: 'badge', rarity: 'common',    labelKey: 'cosmetic.badge.ttt',        emoji: '✖️', requiredAchievement: 'tictactoe.first_win',  unlockHintKey: 'cosmetic.unlock.badge_ttt',        descriptionKey: 'cosmetic.badge.ttt.desc' },
  { id: 'badge_c4',         slot: 'badge', rarity: 'common',    labelKey: 'cosmetic.badge.c4',         emoji: '🔴', requiredAchievement: 'connect4.first_win',   unlockHintKey: 'cosmetic.unlock.badge_c4',         descriptionKey: 'cosmetic.badge.c4.desc' },
  { id: 'badge_rps',        slot: 'badge', rarity: 'common',    labelKey: 'cosmetic.badge.rps',        emoji: '✊', requiredAchievement: 'rps.first_win',        unlockHintKey: 'cosmetic.unlock.badge_rps',        descriptionKey: 'cosmetic.badge.rps.desc' },
  { id: 'badge_chess',      slot: 'badge', rarity: 'epic',      labelKey: 'cosmetic.badge.chess',      emoji: '♟️', requiredAchievement: 'chess.first_win',      unlockHintKey: 'cosmetic.unlock.badge_chess',      descriptionKey: 'cosmetic.badge.chess.desc' },
  { id: 'badge_battleship', slot: 'badge', rarity: 'epic',      labelKey: 'cosmetic.badge.battleship', emoji: '🚢', requiredAchievement: 'battleship.first_win', unlockHintKey: 'cosmetic.unlock.badge_battleship', descriptionKey: 'cosmetic.badge.battleship.desc' },
  { id: 'badge_liar',       slot: 'badge', rarity: 'epic',      labelKey: 'cosmetic.badge.liar',       emoji: '🃏', requiredAchievement: 'liarsbar.first_win',   unlockHintKey: 'cosmetic.unlock.badge_liar',       descriptionKey: 'cosmetic.badge.liar.desc' },
  { id: 'badge_veteran',    slot: 'badge', rarity: 'rare',      labelKey: 'cosmetic.badge.veteran',    emoji: '🏅', requiredAchievement: 'general.win_10',       unlockHintKey: 'cosmetic.unlock.badge_veteran',    descriptionKey: 'cosmetic.badge.veteran.desc' },
  { id: 'badge_snake',      slot: 'badge', rarity: 'common',    labelKey: 'cosmetic.badge.snake',      emoji: '🐍', requiredAchievement: 'snake.play_5',         unlockHintKey: 'cosmetic.unlock.badge_snake',      descriptionKey: 'cosmetic.badge.snake.desc' },
  { id: 'badge_pong',       slot: 'badge', rarity: 'common',    labelKey: 'cosmetic.badge.pong',       emoji: '🏓', requiredAchievement: 'pong.first_win',        unlockHintKey: 'cosmetic.unlock.badge_pong',       descriptionKey: 'cosmetic.badge.pong.desc' },
  { id: 'badge_breakout',     slot: 'badge', rarity: 'common',    labelKey: 'cosmetic.badge.breakout',     emoji: '🧱', requiredAchievement: 'breakout.first_win',     unlockHintKey: 'cosmetic.unlock.badge_breakout',     descriptionKey: 'cosmetic.badge.breakout.desc' },
  { id: 'badge_minesweeper', slot: 'badge', rarity: 'common',    labelKey: 'cosmetic.badge.minesweeper', emoji: '💣', requiredAchievement: 'minesweeper.first_win', unlockHintKey: 'cosmetic.unlock.badge_minesweeper', descriptionKey: 'cosmetic.badge.minesweeper.desc' },

  // ── Premium Frames ────────────────────────────────────────────────────────
  { id: 'diamond',  slot: 'frame', rarity: 'legendary', labelKey: 'frame.diamond',  emoji: '💎', requiredAchievement: 'pong.win_5',       unlockHintKey: 'frame.unlock.diamond', set: 'frost' },
  { id: 'obsidian', slot: 'frame', rarity: 'rare',      labelKey: 'frame.obsidian', emoji: '🖤', requiredAchievement: 'liarsbar.play_5',  unlockHintKey: 'frame.unlock.obsidian', set: 'shadow' },

  // ── Premium Banners ───────────────────────────────────────────────────────
  { id: 'midnight', slot: 'banner', rarity: 'rare',      labelKey: 'cosmetic.banner.midnight', emoji: '🌙', requiredAchievement: 'tetris.play_5',   unlockHintKey: 'cosmetic.unlock.midnight', set: 'shadow' },
  { id: 'ember',    slot: 'banner', rarity: 'legendary', labelKey: 'cosmetic.banner.ember',    emoji: '🔥', requiredAchievement: 'battleship.win_3', unlockHintKey: 'cosmetic.unlock.ember', set: 'inferno' },

  // ── Premium Auras ─────────────────────────────────────────────────────────
  { id: 'frost',   slot: 'aura', rarity: 'rare',      labelKey: 'cosmetic.aura.frost',   emoji: '❄️', requiredAchievement: 'connect4.win_5',   unlockHintKey: 'cosmetic.unlock.frost', set: 'frost' },
  { id: 'crimson', slot: 'aura', rarity: 'legendary', labelKey: 'cosmetic.aura.crimson', emoji: '🩸', requiredAchievement: 'chess.win_3',      unlockHintKey: 'cosmetic.unlock.crimson', set: 'inferno' },

  // ── Titles ────────────────────────────────────────────────────────────────
  { id: 'newcomer',    slot: 'title', rarity: 'common',    labelKey: 'cosmetic.title.newcomer',    emoji: '🌱', requiredAchievement: 'general.first_game',  unlockHintKey: 'cosmetic.unlock.title.newcomer' },
  { id: 'champion',    slot: 'title', rarity: 'rare',      labelKey: 'cosmetic.title.champion',    emoji: '🏆', requiredAchievement: 'general.win_10',      unlockHintKey: 'cosmetic.unlock.title.champion' },
  { id: 'strategist',  slot: 'title', rarity: 'epic',      labelKey: 'cosmetic.title.strategist',  emoji: '🧠', requiredAchievement: 'chess.win_3',         unlockHintKey: 'cosmetic.unlock.title.strategist' },
  { id: 'veteran',     slot: 'title', rarity: 'rare',      labelKey: 'cosmetic.title.veteran',     emoji: '⚔️', requiredAchievement: 'chess.play_5',        unlockHintKey: 'cosmetic.unlock.title.veteran' },
  { id: 'legend',      slot: 'title', rarity: 'legendary', labelKey: 'cosmetic.title.legend',      emoji: '✦',  requiredAchievement: 'battleship.win_3',   unlockHintKey: 'cosmetic.unlock.title.legend', set: 'inferno' },
];

const cosmeticMap = new Map(COSMETICS_REGISTRY.map((c) => [`${c.slot}:${c.id}`, c]));

// ── Rarity display helpers (shared across UI components) ─────────────────────

export const RARITY_COLORS: Record<CosmeticRarity, string> = {
  common:    'text-zinc-400',
  epic:      'text-emerald-400',
  rare:      'text-blue-400',
  legendary: 'text-amber-400',
};

export const RARITY_BG: Record<CosmeticRarity, string> = {
  common:    'bg-zinc-800',
  epic:      'bg-emerald-950/40',
  rare:      'bg-blue-950/40',
  legendary: 'bg-amber-950/30',
};

export const RARITY_RING: Record<CosmeticRarity, string> = {
  common:    'ring-zinc-600',
  epic:      'ring-emerald-600/50',
  rare:      'ring-blue-500/50',
  legendary: 'ring-amber-500/50',
};

export function getCosmeticsBySlot(slot: CosmeticSlot): CosmeticDef[] {
  return COSMETICS_REGISTRY.filter((c) => c.slot === slot);
}

export function getCosmeticDef(id: string, slot: CosmeticSlot = 'frame'): CosmeticDef | undefined {
  return cosmeticMap.get(`${slot}:${id}`);
}

export function getCosmeticsBySet(setId: CosmeticSet): CosmeticDef[] {
  return COSMETICS_REGISTRY.filter((c) => c.set === setId);
}
