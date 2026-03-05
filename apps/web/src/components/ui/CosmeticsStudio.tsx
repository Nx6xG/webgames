'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { CosmeticsSelection } from 'shared';
import { useI18n } from '@/components/providers/LanguageProvider';
import { ProfileCard } from '@/components/ui/ProfileCard';
import {
  getCosmeticsBySlot,
  getCosmeticDef,
  RARITY_COLORS,
  RARITY_BG,
  RARITY_RING,
  type CosmeticSlot,
  type CosmeticDef,
} from '@/lib/cosmetics';
import { NAME_COLOR_PALETTE } from '@/lib/nameColors';
import { AVATAR_REGISTRY } from '@/lib/avatars';
import { isCosmeticUnlocked, loadUnlocked } from '@/lib/achievements/store';
import { getAchievementById } from '@/lib/achievements';
import { isCosmeticSeen, markSlotAllSeen } from '@/lib/cosmeticsSeen';
import { Tooltip } from '@/components/ui/Tooltip';

// ── Types ───────────────────────────────────────────────────────────────────

type StudioTab = 'avatar' | 'frame' | 'head' | 'portal' | 'aura' | 'banner' | 'cardColor' | 'badge' | 'colors';

const TABS: StudioTab[] = ['avatar', 'frame', 'head', 'portal', 'aura', 'banner', 'cardColor', 'badge', 'colors'];

const TAB_ICONS: Record<StudioTab, string> = {
  avatar: '😊',
  frame: '◆',
  head: '👑',
  portal: '🕳️',
  aura: '✨',
  banner: '🌅',
  cardColor: '🎨',
  badge: '🏅',
  colors: '🎨',
};

export interface CosmeticsStudioProps {
  initialCosmetics: CosmeticsSelection;
  nickname: string;
  onSave: (cosmetics: CosmeticsSelection) => void;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isItemUnlocked(slot: CosmeticSlot, id: string): boolean {
  const def = getCosmeticDef(id, slot);
  if (!def?.requiredAchievement) return true;
  return isCosmeticUnlocked(slot, id);
}

function hasNewItems(slot: CosmeticSlot): boolean {
  const items = getCosmeticsBySlot(slot);
  const unlocked = loadUnlocked();
  for (const item of items) {
    if (!item.requiredAchievement) continue;
    if (!unlocked.has(item.requiredAchievement)) continue;
    if (!isCosmeticSeen(slot, item.id)) return true;
  }
  return false;
}

// ── Info panel for hovered item ─────────────────────────────────────────────

function ItemInfo({ cosmetic, locked, t }: { cosmetic: CosmeticDef; locked: boolean; t: (k: string) => string }) {
  const achDef = cosmetic.requiredAchievement ? getAchievementById(cosmetic.requiredAchievement) : null;
  return (
    <div className="flex items-center gap-2.5 min-h-[36px]">
      <span className="text-lg shrink-0">{cosmetic.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-zinc-200 truncate">{t(cosmetic.labelKey)}</p>
          <span className={`text-[9px] font-semibold uppercase ${RARITY_COLORS[cosmetic.rarity]}`}>
            {t(`cosmetics.rarity.${cosmetic.rarity}`)}
          </span>
        </div>
        {locked && achDef ? (
          <p className="text-[10px] text-rose-400/80 truncate">
            {cosmetic.unlockHintKey ? t(cosmetic.unlockHintKey) : `${t('cosmetic.info.lockedNeed')}${t(achDef.nameKey)}`}
          </p>
        ) : achDef ? (
          <p className="text-[10px] text-emerald-400/80 truncate">{t('cosmetic.info.unlocked')}</p>
        ) : null}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function CosmeticsStudio({ initialCosmetics, nickname, onSave, onClose }: CosmeticsStudioProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<StudioTab>('avatar');
  const [draft, setDraft] = useState<CosmeticsSelection>(() => ({
    ...initialCosmetics,
    slots: { ...initialCosmetics.slots },
    badges: [...(initialCosmetics.badges ?? [])],
  }));
  const [hoveredItem, setHoveredItem] = useState<CosmeticDef | null>(null);
  const [hoverPreview, setHoverPreview] = useState<Partial<CosmeticsSelection> | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  // Mark items as seen when visiting a slot tab
  useEffect(() => {
    if (tab === 'avatar' || tab === 'colors') return;
    const slot = tab as CosmeticSlot;
    const items = getCosmeticsBySlot(slot);
    const unlocked = loadUnlocked();
    const unlockedIds = items
      .filter((c) => c.requiredAchievement && unlocked.has(c.requiredAchievement))
      .map((c) => c.id);
    if (unlockedIds.length > 0) markSlotAllSeen(slot, unlockedIds);
  }, [tab]);

  const updateSlot = useCallback((slot: string, value: string | undefined) => {
    setDraft((prev) => ({
      ...prev,
      slots: { ...prev.slots, [slot]: value },
    }));
  }, []);

  const toggleBadge = useCallback((badgeId: string) => {
    setDraft((prev) => {
      const current = [...(prev.badges ?? [])];
      const idx = current.indexOf(badgeId);
      if (idx >= 0) {
        current.splice(idx, 1);
      } else {
        if (current.length >= 3) return prev;
        current.push(badgeId);
      }
      return { ...prev, badges: current };
    });
  }, []);

  function handleSave() {
    onSave(draft);
    onClose();
  }

  if (!mounted) return null;

  // Compute preview cosmetics (draft + hover overlay)
  const previewCosmetics: CosmeticsSelection = hoverPreview
    ? { ...draft, ...hoverPreview, slots: { ...draft.slots, ...hoverPreview.slots } }
    : draft;

  const modal = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('studio.title')}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel — FIXED height on desktop, full-screen on mobile */}
      <div className="relative w-[min(96vw,820px)] h-[min(85vh,580px)] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl flex flex-col max-sm:!w-full max-sm:!h-full max-sm:!rounded-none max-sm:!border-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-bold text-zinc-100">{t('studio.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-zinc-800"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body: 3-column desktop, stacked mobile — flex-1 + min-h-0 ensures it fills remaining space without growing */}
        <div className="flex flex-1 min-h-0 max-sm:flex-col max-sm:overflow-y-auto">
          {/* Left: Tabs */}
          <div className="w-[150px] max-sm:w-full max-sm:flex max-sm:overflow-x-auto border-r max-sm:border-r-0 max-sm:border-b border-zinc-800 shrink-0 overflow-y-auto">
            {TABS.map((t_) => {
              const isSlot = t_ !== 'avatar' && t_ !== 'colors';
              const hasNew = isSlot && hasNewItems(t_ as CosmeticSlot);
              return (
                <button
                  key={t_}
                  onClick={() => setTab(t_)}
                  className={`w-full max-sm:w-auto max-sm:shrink-0 flex items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors ${
                    tab === t_ ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <span className="text-sm">{TAB_ICONS[t_]}</span>
                  <span>{t(`studio.tab.${t_}`)}</span>
                  {hasNew && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Center: Content grid — scrolls independently */}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4">
            {tab === 'avatar' && <AvatarGrid draft={draft} setDraft={setDraft} onHoverPreview={(avatarId) => { setHoverPreview(avatarId ? { avatarId } : null); }} />}
            {tab === 'colors' && <ColorGrid draft={draft} setDraft={setDraft} onHoverPreview={(nameColor) => { setHoverPreview(nameColor !== undefined ? { nameColor: nameColor || undefined } : null); }} />}
            {tab === 'badge' && (
              <BadgeGrid
                draft={draft}
                toggleBadge={toggleBadge}
                onHover={setHoveredItem}
                onHoverPreview={(badgeId) => { setHoverPreview(badgeId ? { badges: [badgeId, ...(draft.badges ?? []).slice(1)] } : null); }}
                t={t}
              />
            )}
            {tab !== 'avatar' && tab !== 'colors' && tab !== 'badge' && (
              <SlotGrid
                slot={tab as CosmeticSlot}
                currentId={draft.slots?.[tab as keyof typeof draft.slots]}
                onSelect={(id) => updateSlot(tab, id)}
                onHover={setHoveredItem}
                onHoverPreview={(slot, id) => { setHoverPreview(id ? { slots: { [slot]: id } } : null); }}
                t={t}
              />
            )}
          </div>

          {/* Right: Preview — sticky within modal, scrolls only if content overflows */}
          <div className="w-[200px] max-sm:w-full border-l max-sm:border-l-0 max-sm:border-t border-zinc-800 p-3 shrink-0 flex flex-col gap-3 overflow-y-auto">
            <ProfileCard nickname={nickname} cosmetics={previewCosmetics} compact />
            {hoveredItem ? (
              <ItemInfo cosmetic={hoveredItem} locked={!isItemUnlocked(hoveredItem.slot, hoveredItem.id)} t={t} />
            ) : (
              <p className="text-[10px] text-zinc-600 text-center">{t('cosmetic.hoverHint')}</p>
            )}
          </div>
        </div>

        {/* Footer — always pinned at bottom */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs font-semibold transition-colors"
          >
            {t('studio.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
          >
            {t('studio.save')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Sub-grids ───────────────────────────────────────────────────────────────

function AvatarGrid({ draft, setDraft, onHoverPreview }: { draft: CosmeticsSelection; setDraft: React.Dispatch<React.SetStateAction<CosmeticsSelection>>; onHoverPreview: (avatarId: string | null) => void }) {
  const { t } = useI18n();
  const unlocked = loadUnlocked();
  return (
    <div className="grid grid-cols-5 max-sm:grid-cols-4 gap-2">
      {AVATAR_REGISTRY.map((av) => {
        const locked = !!av.requiredAchievement && !unlocked.has(av.requiredAchievement);
        const selected = draft.avatarId === av.id;
        return (
          <button
            key={av.id}
            onClick={() => !locked && setDraft((p) => ({ ...p, avatarId: av.id }))}
            aria-disabled={locked}
            onMouseEnter={() => onHoverPreview(av.id)}
            onMouseLeave={() => onHoverPreview(null)}
            className={`relative aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
              locked
                ? 'bg-zinc-800/60 opacity-40 cursor-not-allowed'
                : selected
                  ? 'bg-indigo-600/20 ring-2 ring-indigo-500 shadow-lg'
                  : 'bg-zinc-800 hover:scale-105'
            }`}
            title={t(av.nameKey)}
          >
            {av.emoji}
          </button>
        );
      })}
    </div>
  );
}

function ColorGrid({ draft, setDraft, onHoverPreview }: { draft: CosmeticsSelection; setDraft: React.Dispatch<React.SetStateAction<CosmeticsSelection>>; onHoverPreview: (nameColor: string | null) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{t('profile.nameColor')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setDraft((p) => ({ ...p, nameColor: undefined }))}
          onMouseEnter={() => onHoverPreview('')}
          onMouseLeave={() => onHoverPreview(null)}
          title={t('profile.colorDefault')}
          className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
            !draft.nameColor ? 'border-white/50 bg-zinc-700 scale-110' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'
          }`}
        >
          <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </button>
        {NAME_COLOR_PALETTE.map((c) => (
          <button
            key={c.id}
            onClick={() => setDraft((p) => ({ ...p, nameColor: c.id }))}
            onMouseEnter={() => onHoverPreview(c.id)}
            onMouseLeave={() => onHoverPreview(null)}
            title={t(c.labelKey)}
            className={`w-7 h-7 rounded-full border-2 transition-all ${c.className} ${
              draft.nameColor === c.id ? 'border-white/50 scale-110' : 'border-zinc-700 hover:border-zinc-500'
            }`}
            style={{ backgroundColor: 'currentColor' }}
          />
        ))}
      </div>
    </div>
  );
}

function SlotGrid({
  slot,
  currentId,
  onSelect,
  onHover,
  onHoverPreview,
  t,
}: {
  slot: CosmeticSlot;
  currentId: string | undefined;
  onSelect: (id: string | undefined) => void;
  onHover: (item: CosmeticDef | null) => void;
  onHoverPreview: (slot: CosmeticSlot, id: string | undefined) => void;
  t: (k: string) => string;
}) {
  const items = getCosmeticsBySlot(slot);
  const unlocked = loadUnlocked();

  return (
    <div className="space-y-3">
      {/* None button */}
      <button
        onClick={() => onSelect(undefined)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
          !currentId ? 'bg-indigo-600/20 ring-2 ring-indigo-500' : 'bg-zinc-800 hover:bg-zinc-700'
        }`}
      >
        <span className="text-base">⊘</span>
        <span className="text-xs text-zinc-300">{t('cosmetic.none')}</span>
      </button>

      <div className="grid grid-cols-4 max-sm:grid-cols-3 gap-2">
        {items.map((c) => {
          const locked = !!c.requiredAchievement && !unlocked.has(c.requiredAchievement) && !isCosmeticUnlocked(slot, c.id);
          const selected = currentId === c.id;
          const isNew = !locked && c.requiredAchievement && !isCosmeticSeen(slot, c.id);
          return (
            <button
              key={c.id}
              onClick={() => {
                if (locked) return;
                onSelect(c.id === currentId ? undefined : c.id);
              }}
              aria-disabled={locked}
              onMouseEnter={() => { onHover(c); onHoverPreview(slot, c.id); }}
              onFocus={() => { onHover(c); onHoverPreview(slot, c.id); }}
              onMouseLeave={() => { onHover(null); onHoverPreview(slot, undefined); }}
              onBlur={() => { onHover(null); onHoverPreview(slot, undefined); }}
              className={`relative w-full aspect-square rounded-xl flex flex-col items-center justify-center text-xl transition-all ${
                locked
                  ? 'bg-zinc-800/60 opacity-40 cursor-not-allowed'
                  : selected
                    ? `${RARITY_BG[c.rarity]} ring-2 ${RARITY_RING[c.rarity]} shadow-lg`
                    : `${RARITY_BG[c.rarity]} hover:scale-105`
              }`}
            >
              <span>{c.emoji}</span>
              <span className={`text-[8px] mt-0.5 font-semibold uppercase leading-none ${RARITY_COLORS[c.rarity]}`}>
                {t(`cosmetics.rarity.${c.rarity}`).charAt(0)}
              </span>
              {locked && (
                <span className="absolute bottom-0 right-0 w-4 h-4 flex items-center justify-center rounded-tl-md bg-zinc-900/90 text-[9px] leading-none pointer-events-none">🔒</span>
              )}
              {isNew && (
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-indigo-500 ring-1 ring-zinc-900" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BadgeGrid({
  draft,
  toggleBadge,
  onHover,
  onHoverPreview,
  t,
}: {
  draft: CosmeticsSelection;
  toggleBadge: (id: string) => void;
  onHover: (item: CosmeticDef | null) => void;
  onHoverPreview: (badgeId: string | null) => void;
  t: (k: string) => string;
}) {
  const items = getCosmeticsBySlot('badge');
  const selectedBadges = draft.badges ?? [];
  const unlocked = loadUnlocked();

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
        {t('studio.maxBadges')}
      </p>
      <div className="grid grid-cols-4 max-sm:grid-cols-3 gap-2">
        {items.map((c) => {
          const locked = !!c.requiredAchievement && !unlocked.has(c.requiredAchievement) && !isCosmeticUnlocked('badge', c.id);
          const selected = selectedBadges.includes(c.id);
          const isNew = !locked && c.requiredAchievement && !isCosmeticSeen('badge', c.id);
          const tooltipContent = (
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-zinc-100">{c.emoji} {t(c.labelKey)}</p>
              {c.descriptionKey && <p className="text-[10px] text-zinc-400">{t(c.descriptionKey)}</p>}
              {c.unlockHintKey && (
                <p className="text-[10px] text-zinc-500">{locked ? '🔒 ' : '✓ '}{t(c.unlockHintKey)}</p>
              )}
              <span className={`inline-block text-[9px] font-semibold uppercase tracking-wider ${RARITY_COLORS[c.rarity]}`}>
                {t(`cosmetics.rarity.${c.rarity}`)}
              </span>
            </div>
          );
          return (
            <Tooltip key={c.id} content={tooltipContent} placement="bottom">
              <button
                onClick={() => !locked && toggleBadge(c.id)}
                aria-disabled={locked}
                onMouseEnter={() => { onHover(c); onHoverPreview(c.id); }}
                onFocus={() => { onHover(c); onHoverPreview(c.id); }}
                onMouseLeave={() => { onHover(null); onHoverPreview(null); }}
                onBlur={() => { onHover(null); onHoverPreview(null); }}
                className={`relative w-full aspect-square rounded-xl flex flex-col items-center justify-center text-xl transition-all ${
                  locked
                    ? 'bg-zinc-800/60 opacity-40 cursor-not-allowed'
                    : selected
                      ? `${RARITY_BG[c.rarity]} ring-2 ${RARITY_RING[c.rarity]} shadow-lg`
                      : `${RARITY_BG[c.rarity]} hover:scale-105`
                }`}
              >
                <span>{c.emoji}</span>
                <span className={`text-[8px] mt-0.5 font-semibold uppercase leading-none ${RARITY_COLORS[c.rarity]}`}>
                  {t(`cosmetics.rarity.${c.rarity}`).charAt(0)}
                </span>
                {locked && (
                  <span className="absolute bottom-0 right-0 w-4 h-4 flex items-center justify-center rounded-tl-md bg-zinc-900/90 text-[9px] leading-none pointer-events-none">🔒</span>
                )}
                {isNew && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-indigo-500 ring-1 ring-zinc-900" />
                )}
                {selected && (
                  <span className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center rounded-br-md bg-indigo-600 text-[8px] text-white font-bold leading-none">
                    ✓
                  </span>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
