'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useI18n } from '@/components/providers/LanguageProvider';
import { SHOP_ITEMS, isShopItemOwned, purchaseShopItem } from '@/lib/tokenShop';
import type { ShopItem } from '@/lib/tokenShop';
import type { CosmeticSlot } from '@/lib/cosmetics';
import { useCloudSync } from '@/hooks/useCloudSync';
import { useProgression } from '@/components/providers/ProgressionProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import { loadUnlockedCosmetics } from '@/lib/achievements/store';
import { ProfileCard } from '@/components/ui/ProfileCard';
import { TokenIcon } from '@/components/ui/TokenIcon';
import type { CosmeticsSelection } from 'shared';

// ── Rarity accents — subtle, not surface fills ──────────────────────────────

const RARITY = {
  common: {
    border:     'border-zinc-800/60',
    hoverBorder:'hover:border-zinc-700/60',
    glow:       '',
    hoverGlow:  'group-hover:shadow-[0_0_16px_rgba(161,161,170,0.04)]',
    accent:     'from-transparent via-zinc-600/20 to-transparent',
    tag:        'text-zinc-500',
    dot:        'bg-zinc-500',
  },
  rare: {
    border:     'border-zinc-800/60',
    hoverBorder:'hover:border-blue-500/30',
    glow:       '',
    hoverGlow:  'group-hover:shadow-[0_0_24px_rgba(59,130,246,0.08)]',
    accent:     'from-transparent via-blue-500/25 to-transparent',
    tag:        'text-blue-400',
    dot:        'bg-blue-400',
  },
  epic: {
    border:     'border-zinc-800/60',
    hoverBorder:'hover:border-emerald-500/30',
    glow:       '',
    hoverGlow:  'group-hover:shadow-[0_0_24px_rgba(52,211,153,0.08)]',
    accent:     'from-transparent via-emerald-500/25 to-transparent',
    tag:        'text-emerald-400',
    dot:        'bg-emerald-400',
  },
  legendary: {
    border:     'border-zinc-800/60',
    hoverBorder:'hover:border-amber-500/30',
    glow:       'shadow-[0_0_20px_rgba(251,191,36,0.04)]',
    hoverGlow:  'group-hover:shadow-[0_0_36px_rgba(251,191,36,0.10)]',
    accent:     'from-transparent via-amber-400/35 to-transparent',
    tag:        'text-amber-400',
    dot:        'bg-amber-400',
  },
} as const;

type RarityKey = keyof typeof RARITY;

// ── Categories ──────────────────────────────────────────────────────────────

type CategoryFilter = 'all' | CosmeticSlot;

const CATEGORIES: { key: CategoryFilter; labelKey: string }[] = [
  { key: 'all',       labelKey: 'shop.category.all' },
  { key: 'frame',     labelKey: 'cosmetics.slot.frame' },
  { key: 'aura',      labelKey: 'cosmetics.slot.aura' },
  { key: 'banner',    labelKey: 'cosmetics.slot.banner' },
  { key: 'portal',    labelKey: 'cosmetics.slot.portal' },
  { key: 'head',      labelKey: 'cosmetics.slot.head' },
  { key: 'badge',     labelKey: 'cosmetics.slot.badge' },
  { key: 'cardColor', labelKey: 'cosmetics.slot.cardColor' },
];

const FEATURED_IDS = new Set(['shop_frame_plasma', 'shop_aura_rainbow', 'shop_card_hologram']);

// ── Preview cosmetics builder ───────────────────────────────────────────────

function buildPreviewCosmetics(base: CosmeticsSelection, item: ShopItem): CosmeticsSelection {
  if (item.slot === 'badge') {
    const currentBadges = base.badges ?? [];
    const previewBadges = currentBadges.includes(item.id)
      ? currentBadges
      : [item.id, ...currentBadges].slice(0, 3);
    return { ...base, badges: previewBadges };
  }
  return {
    ...base,
    slots: { ...base.slots, [item.slot]: item.id },
  };
}

// ── Floating preview popup ──────────────────────────────────────────────────

const POPUP_W = 240;
const POPUP_GAP = 14;

function PreviewPopup({ item, cosmetics, nickname, anchorRect, t }: {
  item: ShopItem;
  cosmetics: CosmeticsSelection;
  nickname: string;
  anchorRect: DOMRect;
  t: (k: string) => string;
}) {
  const r = RARITY[item.rarity as RarityKey];
  const previewCosmetics = useMemo(
    () => buildPreviewCosmetics(cosmetics, item),
    [cosmetics, item],
  );

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;

  let left: number;
  let top: number;

  const rightSpace = vw - anchorRect.right;
  const leftSpace = anchorRect.left;

  if (rightSpace >= POPUP_W + POPUP_GAP + 16) {
    left = anchorRect.right + POPUP_GAP;
    top = anchorRect.top + scrollY;
  } else if (leftSpace >= POPUP_W + POPUP_GAP + 16) {
    left = anchorRect.left - POPUP_W - POPUP_GAP;
    top = anchorRect.top + scrollY;
  } else {
    left = anchorRect.left + anchorRect.width / 2 - POPUP_W / 2;
    top = anchorRect.top + scrollY - 320 - POPUP_GAP;
  }

  left = Math.max(12, Math.min(left, vw - POPUP_W - 12));
  top = Math.max(scrollY + 12, top);
  const popupBottom = top - scrollY + 360;
  if (popupBottom > vh - 12) {
    top -= popupBottom - (vh - 12);
    top = Math.max(scrollY + 12, top);
  }

  return createPortal(
    <div
      className="pointer-events-none"
      style={{
        position: 'absolute',
        left,
        top,
        width: POPUP_W,
        zIndex: 9999,
        animation: 'shop-fade-up 150ms ease-out both',
      }}
    >
      <div className="rounded-2xl border border-zinc-700/40 bg-zinc-950/95 backdrop-blur-xl overflow-hidden"
        style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}
      >
        <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${r.accent}`} />
        <div className="px-3 py-2 border-b border-zinc-800/40 flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{t('shop.preview')}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
        </div>
        <div className="p-3">
          <ProfileCard nickname={nickname} cosmetics={previewCosmetics} compact />
        </div>
        <div className="px-3 pb-3">
          <p className="text-[11px] font-semibold text-zinc-300 truncate">{t(item.labelKey)}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">{t(`cosmetics.slot.${item.slot}`)}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Mobile preview modal ────────────────────────────────────────────────────

function MobilePreviewModal({ item, cosmetics, nickname, onClose, onBuy, owned, canAfford, justPurchased, t }: {
  item: ShopItem;
  cosmetics: CosmeticsSelection;
  nickname: string;
  onClose: () => void;
  onBuy: (item: ShopItem) => void;
  owned: boolean;
  canAfford: boolean;
  justPurchased: boolean;
  t: (k: string) => string;
}) {
  const r = RARITY[item.rarity as RarityKey];
  const previewCosmetics = useMemo(
    () => buildPreviewCosmetics(cosmetics, item),
    [cosmetics, item],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: 'shop-fade-up 150ms ease-out both' }}
    >
      <div
        className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-700/40 bg-zinc-950/95 backdrop-blur-xl overflow-hidden"
        style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${r.accent}`} />
        <div className="px-4 py-3 border-b border-zinc-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
            <span className={`text-xs font-semibold ${r.tag}`}>{t(`cosmetics.rarity.${item.rarity}`)}</span>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 -mr-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <ProfileCard nickname={nickname} cosmetics={previewCosmetics} />
        </div>
        <div className="px-4 pb-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-100 truncate">{t(item.labelKey)}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{t(`cosmetics.slot.${item.slot}`)}</p>
          </div>
          <div className="shrink-0">
            <BuyButton item={item} owned={owned} canAfford={canAfford} justPurchased={justPurchased} onBuy={onBuy} t={t} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Buy button ──────────────────────────────────────────────────────────────

function BuyButton({ item, owned, canAfford, justPurchased, onBuy, t, large }: {
  item: ShopItem;
  owned: boolean;
  canAfford: boolean;
  justPurchased: boolean;
  onBuy: (item: ShopItem) => void;
  t: (k: string) => string;
  large?: boolean;
}) {
  if (justPurchased) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/25 ${
        large ? 'px-5 py-2.5 text-sm' : 'px-3 py-1.5 text-xs'
      }`} style={{ animation: 'shop-pop 300ms ease-out both' }}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {t('shop.purchased')}
      </span>
    );
  }

  if (owned) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-lg text-emerald-500/60 font-medium ${
        large ? 'text-sm' : 'text-xs'
      }`}>
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        {t('shop.owned')}
      </span>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onBuy(item); }}
      disabled={!canAfford}
      className={`inline-flex items-center gap-2 rounded-lg font-bold transition-all duration-200 disabled:cursor-not-allowed ${
        large ? 'px-6 py-3 text-sm' : 'px-3.5 py-2 text-xs'
      } ${
        canAfford
          ? 'bg-zinc-100 text-zinc-900 hover:bg-white active:scale-[0.97] shadow-sm'
          : 'bg-zinc-800/40 text-zinc-600'
      }`}
    >
      <TokenIcon size={large ? 'md' : 'sm'} />
      <span className="tabular-nums">{item.price}</span>
    </button>
  );
}

// ── Featured card — visual showcase with real preview ───────────────────────

function FeaturedCard({ item, owned, canAfford, justPurchased, onBuy, cosmetics, nickname, t, onHover, onLeave, onTap }: {
  item: ShopItem;
  owned: boolean;
  canAfford: boolean;
  justPurchased: boolean;
  onBuy: (item: ShopItem) => void;
  cosmetics: CosmeticsSelection;
  nickname: string;
  t: (k: string) => string;
  onHover: (item: ShopItem, rect: DOMRect) => void;
  onLeave: () => void;
  onTap: (item: ShopItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const r = RARITY[item.rarity as RarityKey];
  const previewCosmetics = useMemo(
    () => buildPreviewCosmetics(cosmetics, item),
    [cosmetics, item],
  );

  return (
    <div
      ref={ref}
      className={`group relative rounded-2xl border overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 bg-zinc-950 ${r.border} ${r.hoverBorder} ${r.glow} ${r.hoverGlow}`}
      onMouseEnter={() => { if (ref.current) onHover(item, ref.current.getBoundingClientRect()); }}
      onMouseLeave={onLeave}
      onClick={() => onTap(item)}
    >
      {/* Rarity accent edge */}
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${r.accent}`} />

      {/* Profile card preview — the star of the card */}
      <div className="px-4 pt-5 pb-3">
        <div className="transform group-hover:scale-[1.02] transition-transform duration-300 pointer-events-none">
          <ProfileCard nickname={nickname} cosmetics={previewCosmetics} compact />
        </div>
      </div>

      {/* Footer: name, rarity, price */}
      <div className="px-5 pb-5 pt-1">
        <div className="flex items-center gap-2 mb-2.5">
          <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
          <span className={`text-[10px] font-bold uppercase tracking-wider ${r.tag}`}>
            {t(`cosmetics.rarity.${item.rarity}`)}
          </span>
          <span className="text-[10px] text-zinc-700">&middot;</span>
          <span className="text-[10px] text-zinc-600">{t(`cosmetics.slot.${item.slot}`)}</span>
        </div>

        <p className="text-sm font-bold text-zinc-100 truncate mb-4">{t(item.labelKey)}</p>

        <div className="flex items-center justify-between">
          <BuyButton item={item} owned={owned} canAfford={canAfford} justPurchased={justPurchased} onBuy={onBuy} t={t} large />
          {!owned && !justPurchased && (
            <span className="text-sm font-bold text-zinc-400 tabular-nums flex items-center gap-1.5">
              <TokenIcon size="md" />
              {item.price}
            </span>
          )}
        </div>
      </div>

      {/* Owned corner indicator */}
      {owned && !justPurchased && (
        <div className="absolute top-3 right-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center backdrop-blur-sm">
            <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Catalog item card — clean, dark, collectible ────────────────────────────

function ItemCard({ item, owned, canAfford, justPurchased, onBuy, t, onHover, onLeave, onTap }: {
  item: ShopItem;
  owned: boolean;
  canAfford: boolean;
  justPurchased: boolean;
  onBuy: (item: ShopItem) => void;
  t: (k: string) => string;
  onHover: (item: ShopItem, rect: DOMRect) => void;
  onLeave: () => void;
  onTap: (item: ShopItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const r = RARITY[item.rarity as RarityKey];

  return (
    <div
      ref={ref}
      className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 bg-zinc-950 ${
        owned
          ? 'border-zinc-800/40 opacity-75 hover:opacity-100'
          : canAfford
            ? `${r.border} ${r.hoverBorder} ${r.glow} ${r.hoverGlow}`
            : 'border-zinc-800/30 opacity-50'
      }`}
      onMouseEnter={() => { if (ref.current) onHover(item, ref.current.getBoundingClientRect()); }}
      onMouseLeave={onLeave}
      onClick={() => onTap(item)}
    >
      {/* Rarity accent — top edge only */}
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${r.accent} transition-opacity duration-200 ${
        owned ? 'opacity-20' : 'opacity-40 group-hover:opacity-100'
      }`} />

      {/* Emoji showcase — dark neutral surface */}
      <div className="relative h-20 flex items-center justify-center bg-zinc-900/80">
        <span className="text-3xl select-none group-hover:scale-110 transition-transform duration-200">
          {item.emoji}
        </span>

        {/* Owned indicator */}
        {owned && !justPurchased && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3.5 pb-3.5 pt-3">
        {/* Rarity indicator */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`w-1 h-1 rounded-full ${r.dot}`} />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${r.tag}`}>
            {t(`cosmetics.rarity.${item.rarity}`)}
          </span>
        </div>

        {/* Name */}
        <p className={`text-[13px] font-bold truncate mb-3 ${owned ? 'text-zinc-500' : 'text-zinc-200'}`}>
          {t(item.labelKey)}
        </p>

        {/* Price / action — compact row */}
        <div className="flex items-center justify-between">
          <BuyButton item={item} owned={owned} canAfford={canAfford} justPurchased={justPurchased} onBuy={onBuy} t={t} />
          {!owned && !justPurchased && canAfford && (
            <span className="text-[11px] font-bold text-zinc-500 tabular-nums flex items-center gap-1">
              <TokenIcon size="xs" />
              {item.price}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Touch detection ─────────────────────────────────────────────────────────

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);
  return isTouch;
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function ShopPage() {
  const { t } = useI18n();
  const cloudSync = useCloudSync();
  const { progression, setProgression } = useProgression();
  const { nickname, cosmetics } = useNickname();
  const tokens = progression.tokens;
  const isTouch = useIsTouchDevice();
  const [ownedIds, setOwnedIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const item of SHOP_ITEMS) {
      if (isShopItemOwned(item)) s.add(item.id);
    }
    return s;
  });
  const [purchasedId, setPurchasedId] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryFilter>('all');

  const [hoverItem, setHoverItem] = useState<ShopItem | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mobileItem, setMobileItem] = useState<ShopItem | null>(null);

  const featured = useMemo(() => SHOP_ITEMS.filter((i) => FEATURED_IDS.has(i.id)), []);
  const filtered = useMemo(
    () => category === 'all' ? SHOP_ITEMS : SHOP_ITEMS.filter((i) => i.slot === category),
    [category],
  );

  const handleBuy = useCallback((item: ShopItem) => {
    if (ownedIds.has(item.id) || tokens < item.price) return;
    const ok = purchaseShopItem(item, setProgression);
    if (!ok) return;
    setOwnedIds((prev) => new Set([...prev, item.id]));
    setPurchasedId(item.id);
    setTimeout(() => setPurchasedId(null), 2000);
    if (cloudSync.isActive) {
      cloudSync.syncUnlockedCosmetics(loadUnlockedCosmetics());
    }
  }, [ownedIds, tokens, cloudSync, setProgression]);

  const handleHover = useCallback((item: ShopItem, rect: DOMRect) => {
    if (isTouch) return;
    clearTimeout(hoverTimeoutRef.current);
    setHoverItem(item);
    setHoverRect(rect);
  }, [isTouch]);

  const handleLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoverItem(null);
      setHoverRect(null);
    }, 80);
  }, []);

  const handleTap = useCallback((item: ShopItem) => {
    if (!isTouch) return;
    setMobileItem(item);
  }, [isTouch]);

  const ownedCount = ownedIds.size;
  const totalCount = SHOP_ITEMS.length;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">

      {/* ═══ HERO ═══ */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/80 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/[0.03] rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-12">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-12">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('nav.home')}
          </Link>

          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-medium mb-3">Cosmetics</p>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-2 text-zinc-100">
                {t('shop.title')}
              </h1>
              <p className="text-sm text-zinc-500">{t('shop.subtitle')}</p>
            </div>

            {/* Token balance */}
            <div className="flex items-center gap-3.5 px-5 py-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/50">
              <TokenIcon size="lg" />
              <div>
                <p className="text-3xl font-black text-zinc-100 tabular-nums leading-none">{tokens}</p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-medium mt-1">{t('shop.balance')}</p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-700 mt-6 tabular-nums">
            {ownedCount} / {totalCount} {t('shop.collected')}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* ═══ FEATURED ═══ */}
        <section className="pb-12">
          <div className="flex items-center gap-3 mb-7">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.15em]">{t('shop.featured')}</h2>
            <div className="flex-1 h-px bg-zinc-800/50" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {featured.map((item) => (
              <FeaturedCard
                key={item.id}
                item={item}
                owned={ownedIds.has(item.id)}
                canAfford={tokens >= item.price}
                justPurchased={purchasedId === item.id}
                onBuy={handleBuy}
                cosmetics={cosmetics}
                nickname={nickname}
                t={t}
                onHover={handleHover}
                onLeave={handleLeave}
                onTap={handleTap}
              />
            ))}
          </div>
        </section>

        {/* ═══ CATALOG ═══ */}
        <section className="pb-16">
          {/* Category filter */}
          <div className="flex gap-1 overflow-x-auto pb-1 mb-8 scrollbar-thin" style={{ scrollbarColor: 'rgb(63 63 70) transparent' }}>
            {CATEGORIES.map(({ key, labelKey }) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`px-3.5 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all duration-150 shrink-0 ${
                  category === key
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/80'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          {/* Section label */}
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.15em]">{t('shop.all')}</h2>
            <div className="flex-1 h-px bg-zinc-800/50" />
            <span className="text-[10px] text-zinc-700 tabular-nums">{filtered.length}</span>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                owned={ownedIds.has(item.id)}
                canAfford={tokens >= item.price}
                justPurchased={purchasedId === item.id}
                onBuy={handleBuy}
                t={t}
                onHover={handleHover}
                onLeave={handleLeave}
                onTap={handleTap}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-zinc-700 text-sm">{t('shop.empty')}</p>
            </div>
          )}
        </section>
      </div>

      {/* Floating preview popup (desktop) */}
      {hoverItem && hoverRect && (
        <PreviewPopup
          item={hoverItem}
          cosmetics={cosmetics}
          nickname={nickname}
          anchorRect={hoverRect}
          t={t}
        />
      )}

      {/* Mobile preview modal */}
      {mobileItem && (
        <MobilePreviewModal
          item={mobileItem}
          cosmetics={cosmetics}
          nickname={nickname}
          onClose={() => setMobileItem(null)}
          onBuy={handleBuy}
          owned={ownedIds.has(mobileItem.id)}
          canAfford={tokens >= mobileItem.price}
          justPurchased={purchasedId === mobileItem.id}
          t={t}
        />
      )}

      <style>{`
        @keyframes shop-fade-up {
          0%   { opacity: 0; transform: translateY(6px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shop-pop {
          0%   { transform: scale(0.9); }
          50%  { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
