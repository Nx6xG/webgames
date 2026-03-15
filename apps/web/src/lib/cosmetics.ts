import type { CosmeticsSelection, CosmeticsSlots } from 'shared';
import { isBrowser } from '@/lib/utils';

// ── Storage ──────────────────────────────────────────────────────────────────

export const COSMETICS_KEY = 'wg_cosmetics';

// Legacy individual keys (for migration)
const LEGACY_AVATAR_KEY = 'wg_avatar';
const LEGACY_NAME_COLOR_KEY = 'wg_name_color';
const LEGACY_FRAME_KEY = 'wg_avatar_frame';

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
  { id: 'bronze', slot: 'frame', rarity: 'epic',      labelKey: 'frame.bronze', emoji: '◆' },
  { id: 'silver', slot: 'frame', rarity: 'epic',      labelKey: 'frame.silver', emoji: '◈' },
  { id: 'gold',   slot: 'frame', rarity: 'rare',      labelKey: 'frame.gold',   emoji: '✦',  set: 'royal' },
  { id: 'fire',   slot: 'frame', rarity: 'legendary', labelKey: 'frame.fire',   emoji: '🔥', set: 'inferno' },

  // ── Heads ───────────────────────────────────────────────────────────────────
  { id: 'crown',      slot: 'head', rarity: 'rare',      labelKey: 'cosmetic.head.crown',      emoji: '👑', anchor: { top: '-30%', scale: 1.1 }, set: 'royal' },
  { id: 'cap',        slot: 'head', rarity: 'epic',      labelKey: 'cosmetic.head.cap',        emoji: '🧢', anchor: { top: '-22%', rotate: '-10deg' } },
  { id: 'wizard_hat', slot: 'head', rarity: 'legendary', labelKey: 'cosmetic.head.wizard_hat', emoji: '🔮', anchor: { top: '-32%', scale: 1.05 } },
  { id: 'top_hat',    slot: 'head', rarity: 'epic',      labelKey: 'cosmetic.head.top_hat',    emoji: '🎩', anchor: { top: '-34%', scale: 1.05 } },

  // ── Portals ─────────────────────────────────────────────────────────────────
  { id: 'void',   slot: 'portal', rarity: 'rare',      labelKey: 'cosmetic.portal.void',   emoji: '🕳️' },
  { id: 'nebula', slot: 'portal', rarity: 'legendary', labelKey: 'cosmetic.portal.nebula', emoji: '🌌' },

  // ── Auras ───────────────────────────────────────────────────────────────────
  { id: 'softGlow', slot: 'aura', rarity: 'common',    labelKey: 'cosmetic.aura.softGlow', emoji: '✨' },
  { id: 'electric', slot: 'aura', rarity: 'rare',      labelKey: 'cosmetic.aura.electric', emoji: '⚡' },
  { id: 'shadow',   slot: 'aura', rarity: 'legendary', labelKey: 'cosmetic.aura.shadow',   emoji: '🌑', set: 'shadow' },

  // ── Banners ─────────────────────────────────────────────────────────────────
  { id: 'sunset', slot: 'banner', rarity: 'common',    labelKey: 'cosmetic.banner.sunset', emoji: '🌅' },
  { id: 'ocean',  slot: 'banner', rarity: 'common',    labelKey: 'cosmetic.banner.ocean',  emoji: '🌊', set: 'ocean' },
  { id: 'forest', slot: 'banner', rarity: 'epic',      labelKey: 'cosmetic.banner.forest', emoji: '🌲', set: 'nature' },
  { id: 'aurora', slot: 'banner', rarity: 'rare',      labelKey: 'cosmetic.banner.aurora', emoji: '🌌', set: 'frost' },
  { id: 'lava',   slot: 'banner', rarity: 'rare',      labelKey: 'cosmetic.banner.lava',   emoji: '🌋', set: 'inferno' },
  { id: 'neon',   slot: 'banner', rarity: 'legendary', labelKey: 'cosmetic.banner.neon',   emoji: '💜', set: 'neon' },

  // ── Card Colors ────────────────────────────────────────────────────────────
  { id: 'card-purple', slot: 'cardColor', rarity: 'common', labelKey: 'cosmetic.card.purple', emoji: '💜' },
  { id: 'card-blue',   slot: 'cardColor', rarity: 'common', labelKey: 'cosmetic.card.blue',   emoji: '💙' },
  { id: 'card-red',    slot: 'cardColor', rarity: 'common', labelKey: 'cosmetic.card.red',    emoji: '❤️' },
  { id: 'card-gold',   slot: 'cardColor', rarity: 'epic',   labelKey: 'cosmetic.card.gold',   emoji: '💛', set: 'royal' },

  // ── Badges ──────────────────────────────────────────────────────────────────
  { id: 'badge_ttt',         slot: 'badge', rarity: 'common', labelKey: 'cosmetic.badge.ttt',         emoji: '✖️', descriptionKey: 'cosmetic.badge.ttt.desc' },
  { id: 'badge_c4',          slot: 'badge', rarity: 'common', labelKey: 'cosmetic.badge.c4',          emoji: '🔴', descriptionKey: 'cosmetic.badge.c4.desc' },
  { id: 'badge_rps',         slot: 'badge', rarity: 'common', labelKey: 'cosmetic.badge.rps',         emoji: '✊', descriptionKey: 'cosmetic.badge.rps.desc' },
  { id: 'badge_chess',       slot: 'badge', rarity: 'epic',   labelKey: 'cosmetic.badge.chess',       emoji: '♟️', descriptionKey: 'cosmetic.badge.chess.desc' },
  { id: 'badge_battleship',  slot: 'badge', rarity: 'epic',   labelKey: 'cosmetic.badge.battleship',  emoji: '🚢', descriptionKey: 'cosmetic.badge.battleship.desc' },
  { id: 'badge_liar',        slot: 'badge', rarity: 'epic',   labelKey: 'cosmetic.badge.liar',        emoji: '🃏', descriptionKey: 'cosmetic.badge.liar.desc' },
  { id: 'badge_veteran',     slot: 'badge', rarity: 'rare',   labelKey: 'cosmetic.badge.veteran',     emoji: '🏅', descriptionKey: 'cosmetic.badge.veteran.desc' },
  { id: 'badge_snake',       slot: 'badge', rarity: 'common', labelKey: 'cosmetic.badge.snake',       emoji: '🐍', descriptionKey: 'cosmetic.badge.snake.desc' },
  { id: 'badge_pong',        slot: 'badge', rarity: 'common', labelKey: 'cosmetic.badge.pong',        emoji: '🏓', descriptionKey: 'cosmetic.badge.pong.desc' },
  { id: 'badge_breakout',    slot: 'badge', rarity: 'common', labelKey: 'cosmetic.badge.breakout',    emoji: '🧱', descriptionKey: 'cosmetic.badge.breakout.desc' },
  { id: 'badge_minesweeper', slot: 'badge', rarity: 'common', labelKey: 'cosmetic.badge.minesweeper', emoji: '💣', descriptionKey: 'cosmetic.badge.minesweeper.desc' },

  // ── Premium Frames ────────────────────────────────────────────────────────
  { id: 'diamond',  slot: 'frame', rarity: 'legendary', labelKey: 'frame.diamond',  emoji: '💎', set: 'frost' },
  { id: 'obsidian', slot: 'frame', rarity: 'rare',      labelKey: 'frame.obsidian', emoji: '🖤', set: 'shadow' },

  // ── Premium Banners ───────────────────────────────────────────────────────
  { id: 'midnight', slot: 'banner', rarity: 'rare',      labelKey: 'cosmetic.banner.midnight', emoji: '🌙', set: 'shadow' },
  { id: 'ember',    slot: 'banner', rarity: 'legendary', labelKey: 'cosmetic.banner.ember',    emoji: '🔥', set: 'inferno' },

  // ── Premium Auras ─────────────────────────────────────────────────────────
  { id: 'frost',   slot: 'aura', rarity: 'rare',      labelKey: 'cosmetic.aura.frost',   emoji: '❄️', set: 'frost' },
  { id: 'crimson', slot: 'aura', rarity: 'legendary', labelKey: 'cosmetic.aura.crimson', emoji: '🩸', set: 'inferno' },

  // ── Titles ────────────────────────────────────────────────────────────────
  { id: 'newcomer',   slot: 'title', rarity: 'common',    labelKey: 'cosmetic.title.newcomer',   emoji: '🌱' },
  { id: 'champion',   slot: 'title', rarity: 'rare',      labelKey: 'cosmetic.title.champion',   emoji: '🏆' },
  { id: 'strategist', slot: 'title', rarity: 'epic',      labelKey: 'cosmetic.title.strategist', emoji: '🧠' },
  { id: 'veteran',    slot: 'title', rarity: 'rare',      labelKey: 'cosmetic.title.veteran',    emoji: '⚔️' },
  { id: 'legend',     slot: 'title', rarity: 'legendary', labelKey: 'cosmetic.title.legend',     emoji: '✦', set: 'inferno' },
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
