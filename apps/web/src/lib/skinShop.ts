import { loadGameProgress, saveGameProgress } from './cloudSync';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SkinDef {
  id: string;
  price: number;          // 0 = free (default skin)
  nameKey: string;        // i18n key for display name
  colors: Record<string, string>;  // game-specific color map
  requireAll?: boolean;   // must own all other skins first
}

export interface SkinProgress {
  wallet: number;
  owned: string[];
  activeSkin: string;
}

// ── Storage ──────────────────────────────────────────────────────────────────

export function loadSkinProgress(gameId: string): SkinProgress {
  const data = loadGameProgress();
  const raw = data[gameId] as SkinProgress | undefined;
  if (raw && typeof raw === 'object' && 'wallet' in raw) {
    return {
      wallet: raw.wallet ?? 0,
      owned: Array.isArray(raw.owned) ? raw.owned : [getDefaultSkinId(raw)],
      activeSkin: raw.activeSkin ?? '',
    };
  }
  return { wallet: 0, owned: [], activeSkin: '' };
}

export function saveSkinProgress(gameId: string, progress: SkinProgress): void {
  const data = loadGameProgress();
  data[gameId] = progress;
  saveGameProgress(data);
}

function getDefaultSkinId(raw: SkinProgress): string {
  return raw.activeSkin || '';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function canBuySkin(
  skins: SkinDef[],
  skinId: string,
  progress: SkinProgress,
): boolean {
  const skin = skins.find((s) => s.id === skinId);
  if (!skin || skin.price === 0) return false;
  if (progress.owned.includes(skinId)) return false;
  if (progress.wallet < skin.price) return false;
  if (skin.requireAll) {
    const othersOwned = skins
      .filter((s) => s.id !== skinId)
      .every((s) => s.price === 0 || progress.owned.includes(s.id));
    if (!othersOwned) return false;
  }
  return true;
}

export function isLocked(
  skins: SkinDef[],
  skinId: string,
  progress: SkinProgress,
): boolean {
  const skin = skins.find((s) => s.id === skinId);
  if (!skin?.requireAll) return false;
  if (progress.owned.includes(skinId)) return false;
  return !skins
    .filter((s) => s.id !== skinId)
    .every((s) => s.price === 0 || progress.owned.includes(s.id));
}

export function buySkin(
  skins: SkinDef[],
  skinId: string,
  progress: SkinProgress,
): SkinProgress | null {
  if (!canBuySkin(skins, skinId, progress)) return null;
  const skin = skins.find((s) => s.id === skinId)!;
  return {
    wallet: progress.wallet - skin.price,
    owned: [...new Set([...progress.owned, skinId])],
    activeSkin: skinId,
  };
}
