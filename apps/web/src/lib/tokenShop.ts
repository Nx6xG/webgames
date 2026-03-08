import type { CosmeticSlot, CosmeticRarity } from '@/lib/cosmetics';
import type { PlayerProgression } from '@/lib/progression';
import { loadProgression, saveProgression } from '@/lib/progression';
import { loadUnlockedCosmetics, saveUnlockedCosmetics } from '@/lib/achievements/store';

export interface ShopItem {
  id: string;
  slot: CosmeticSlot;
  rarity: CosmeticRarity;
  price: number;
  labelKey: string;
  emoji: string;
}

/** Shop-exclusive cosmetics (not unlockable via achievements). */
export const SHOP_ITEMS: ShopItem[] = [
  { id: 'shop_frame_crystal', slot: 'frame',     rarity: 'rare',      price: 3,  labelKey: 'shop.item.crystalFrame',   emoji: '💠' },
  { id: 'shop_frame_plasma',  slot: 'frame',     rarity: 'legendary', price: 5,  labelKey: 'shop.item.plasmaFrame',    emoji: '🟣' },
  { id: 'shop_aura_golden',   slot: 'aura',      rarity: 'rare',      price: 3,  labelKey: 'shop.item.goldenAura',     emoji: '🌟' },
  { id: 'shop_aura_rainbow',  slot: 'aura',      rarity: 'legendary', price: 6,  labelKey: 'shop.item.rainbowAura',    emoji: '🌈' },
  { id: 'shop_banner_galaxy', slot: 'banner',    rarity: 'rare',      price: 2,  labelKey: 'shop.item.galaxyBanner',   emoji: '🪐' },
  { id: 'shop_banner_storm',  slot: 'banner',    rarity: 'epic',      price: 3,  labelKey: 'shop.item.stormBanner',    emoji: '⛈️' },
  { id: 'shop_badge_vip',     slot: 'badge',     rarity: 'legendary', price: 5,  labelKey: 'shop.item.vipBadge',       emoji: '💎' },
  { id: 'shop_head_halo',     slot: 'head',      rarity: 'rare',      price: 4,  labelKey: 'shop.item.halo',           emoji: '😇' },
  { id: 'shop_card_hologram', slot: 'cardColor', rarity: 'legendary', price: 5,  labelKey: 'shop.item.hologramCard',   emoji: '✴️' },
  { id: 'shop_portal_rift',   slot: 'portal',    rarity: 'epic',      price: 3,  labelKey: 'shop.item.riftPortal',     emoji: '🌀' },
];

/** Check if a shop item is owned. */
export function isShopItemOwned(item: ShopItem): boolean {
  const unlocked = loadUnlockedCosmetics();
  return (unlocked[item.slot] ?? []).includes(item.id);
}

/** Purchase a shop item. Returns true if successful. */
export function purchaseShopItem(
  item: ShopItem,
  onProgressionUpdated?: (prog: PlayerProgression) => void,
): boolean {
  if (isShopItemOwned(item)) return false;

  const prog = loadProgression();
  if (prog.tokens < item.price) return false;

  // Deduct tokens
  prog.tokens -= item.price;
  saveProgression(prog);
  onProgressionUpdated?.(prog);

  // Grant cosmetic
  const unlocked = loadUnlockedCosmetics();
  const list = unlocked[item.slot] ?? [];
  if (!list.includes(item.id)) {
    list.push(item.id);
    unlocked[item.slot] = list;
    saveUnlockedCosmetics(unlocked);
  }

  return true;
}
