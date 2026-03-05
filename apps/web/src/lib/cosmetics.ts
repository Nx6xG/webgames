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

export type CosmeticSlot = 'frame' | 'head' | 'portal' | 'aura' | 'banner' | 'cardColor' | 'badge';
export type CosmeticRarity = 'common' | 'epic' | 'rare' | 'legendary';

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
}

export const COSMETICS_REGISTRY: CosmeticDef[] = [
  // ── Frames ──────────────────────────────────────────────────────────────────
  { id: 'bronze', slot: 'frame', rarity: 'epic',  labelKey: 'frame.bronze', emoji: '◆',  requiredAchievement: 'general.play_10', unlockHintKey: 'frame.unlock.bronze' },
  { id: 'silver', slot: 'frame', rarity: 'epic',  labelKey: 'frame.silver', emoji: '◈',  requiredAchievement: 'general.win_10',  unlockHintKey: 'frame.unlock.silver' },
  { id: 'gold',   slot: 'frame', rarity: 'rare',      labelKey: 'frame.gold',   emoji: '✦',  requiredAchievement: 'chess.win_3',     unlockHintKey: 'frame.unlock.gold' },
  { id: 'fire',   slot: 'frame', rarity: 'legendary', labelKey: 'frame.fire',   emoji: '🔥', requiredAchievement: 'battleship.win_3', unlockHintKey: 'frame.unlock.fire' },

  // ── Heads ───────────────────────────────────────────────────────────────────
  { id: 'crown',      slot: 'head', rarity: 'rare',      labelKey: 'cosmetic.head.crown',      emoji: '👑', requiredAchievement: 'general.win_10',    unlockHintKey: 'cosmetic.unlock.crown' },
  { id: 'cap',        slot: 'head', rarity: 'epic',   labelKey: 'cosmetic.head.cap',        emoji: '🧢', requiredAchievement: 'general.play_10',   unlockHintKey: 'cosmetic.unlock.cap' },
  { id: 'wizard_hat', slot: 'head', rarity: 'legendary',  labelKey: 'cosmetic.head.wizard_hat', emoji: '🧙', requiredAchievement: 'sudoku.win_5',      unlockHintKey: 'cosmetic.unlock.wizard_hat' },
  { id: 'top_hat',    slot: 'head', rarity: 'epic',   labelKey: 'cosmetic.head.top_hat',    emoji: '🎩', requiredAchievement: 'liarsbar.win_3',    unlockHintKey: 'cosmetic.unlock.top_hat' },

  // ── Portals ─────────────────────────────────────────────────────────────────
  { id: 'void',   slot: 'portal', rarity: 'rare',      labelKey: 'cosmetic.portal.void',   emoji: '🕳️', requiredAchievement: 'general.first_win',      unlockHintKey: 'cosmetic.unlock.void' },
  { id: 'nebula', slot: 'portal', rarity: 'legendary', labelKey: 'cosmetic.portal.nebula', emoji: '🌌',  requiredAchievement: 'chess.win_3',            unlockHintKey: 'cosmetic.unlock.nebula' },

  // ── Auras ───────────────────────────────────────────────────────────────────
  { id: 'softGlow', slot: 'aura', rarity: 'common',    labelKey: 'cosmetic.aura.softGlow', emoji: '✨', requiredAchievement: 'general.first_game',     unlockHintKey: 'cosmetic.unlock.softGlow' },
  { id: 'electric', slot: 'aura', rarity: 'rare',      labelKey: 'cosmetic.aura.electric', emoji: '⚡', requiredAchievement: 'tictactoe.win_5',        unlockHintKey: 'cosmetic.unlock.electric' },
  { id: 'shadow',   slot: 'aura', rarity: 'legendary', labelKey: 'cosmetic.aura.shadow',   emoji: '🌑', requiredAchievement: 'liarsbar.win_3',         unlockHintKey: 'cosmetic.unlock.shadow' },

  // ── Banners ─────────────────────────────────────────────────────────────────
  { id: 'sunset', slot: 'banner', rarity: 'common',    labelKey: 'cosmetic.banner.sunset', emoji: '🌅' },
  { id: 'ocean',  slot: 'banner', rarity: 'common',    labelKey: 'cosmetic.banner.ocean',  emoji: '🌊' },
  { id: 'forest', slot: 'banner', rarity: 'epic',      labelKey: 'cosmetic.banner.forest', emoji: '🌲', requiredAchievement: 'general.play_10',   unlockHintKey: 'cosmetic.unlock.forest' },
  { id: 'aurora', slot: 'banner', rarity: 'rare',      labelKey: 'cosmetic.banner.aurora', emoji: '🌌', requiredAchievement: 'general.win_10',    unlockHintKey: 'cosmetic.unlock.aurora' },
  { id: 'lava',   slot: 'banner', rarity: 'rare',      labelKey: 'cosmetic.banner.lava',   emoji: '🌋', requiredAchievement: 'battleship.win_3', unlockHintKey: 'cosmetic.unlock.lava' },
  { id: 'neon',   slot: 'banner', rarity: 'legendary', labelKey: 'cosmetic.banner.neon',   emoji: '💜', requiredAchievement: 'chess.win_3',      unlockHintKey: 'cosmetic.unlock.neon' },

  // ── Card Colors ────────────────────────────────────────────────────────────
  { id: 'card-purple', slot: 'cardColor', rarity: 'common',    labelKey: 'cosmetic.card.purple', emoji: '💜' },
  { id: 'card-blue',   slot: 'cardColor', rarity: 'common',    labelKey: 'cosmetic.card.blue',   emoji: '💙' },
  { id: 'card-red',    slot: 'cardColor', rarity: 'common',    labelKey: 'cosmetic.card.red',    emoji: '❤️' },
  { id: 'card-gold',   slot: 'cardColor', rarity: 'epic',      labelKey: 'cosmetic.card.gold',   emoji: '💛', requiredAchievement: 'general.win_10', unlockHintKey: 'cosmetic.unlock.card_gold' },

  // ── Badges ──────────────────────────────────────────────────────────────────
  { id: 'badge_ttt',        slot: 'badge', rarity: 'common',    labelKey: 'cosmetic.badge.ttt',        emoji: '✖️', requiredAchievement: 'tictactoe.first_win',  unlockHintKey: 'cosmetic.unlock.badge_ttt',        descriptionKey: 'cosmetic.badge.ttt.desc' },
  { id: 'badge_c4',         slot: 'badge', rarity: 'common',    labelKey: 'cosmetic.badge.c4',         emoji: '🔴', requiredAchievement: 'connect4.first_win',   unlockHintKey: 'cosmetic.unlock.badge_c4',         descriptionKey: 'cosmetic.badge.c4.desc' },
  { id: 'badge_rps',        slot: 'badge', rarity: 'common',    labelKey: 'cosmetic.badge.rps',        emoji: '✊', requiredAchievement: 'rps.first_win',        unlockHintKey: 'cosmetic.unlock.badge_rps',        descriptionKey: 'cosmetic.badge.rps.desc' },
  { id: 'badge_chess',      slot: 'badge', rarity: 'epic',      labelKey: 'cosmetic.badge.chess',      emoji: '♟️', requiredAchievement: 'chess.first_win',      unlockHintKey: 'cosmetic.unlock.badge_chess',      descriptionKey: 'cosmetic.badge.chess.desc' },
  { id: 'badge_battleship', slot: 'badge', rarity: 'epic',      labelKey: 'cosmetic.badge.battleship', emoji: '🚢', requiredAchievement: 'battleship.first_win', unlockHintKey: 'cosmetic.unlock.badge_battleship', descriptionKey: 'cosmetic.badge.battleship.desc' },
  { id: 'badge_liar',       slot: 'badge', rarity: 'epic',      labelKey: 'cosmetic.badge.liar',       emoji: '🃏', requiredAchievement: 'liarsbar.first_win',   unlockHintKey: 'cosmetic.unlock.badge_liar',       descriptionKey: 'cosmetic.badge.liar.desc' },
  { id: 'badge_veteran',    slot: 'badge', rarity: 'rare',      labelKey: 'cosmetic.badge.veteran',    emoji: '🏅', requiredAchievement: 'general.win_10',       unlockHintKey: 'cosmetic.unlock.badge_veteran',    descriptionKey: 'cosmetic.badge.veteran.desc' },
  { id: 'badge_snake',      slot: 'badge', rarity: 'common',    labelKey: 'cosmetic.badge.snake',      emoji: '🐍', requiredAchievement: 'snake.play_5',         unlockHintKey: 'cosmetic.unlock.badge_snake',      descriptionKey: 'cosmetic.badge.snake.desc' },
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
