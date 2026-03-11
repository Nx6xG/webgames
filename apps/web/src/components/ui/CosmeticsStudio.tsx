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
  COSMETIC_SET_LABELS,
  type CosmeticSlot,
  type CosmeticDef,
  type CosmeticRarity,
  type CosmeticSet,
} from '@/lib/cosmetics';
import { NAME_COLOR_PALETTE } from '@/lib/nameColors';
import { AVATAR_REGISTRY } from '@/lib/avatars';
import { SvgAvatar, hasSvgAvatar } from '@/components/ui/SvgAvatars';
import { isCosmeticSeen, markSlotAllSeen } from '@/lib/cosmeticsSeen';
import { Tooltip } from '@/components/ui/Tooltip';

// ── Types ───────────────────────────────────────────────────────────────────

type StudioTab = 'avatar' | 'frame' | 'head' | 'portal' | 'aura' | 'banner' | 'cardColor' | 'badge' | 'title' | 'colors';

const TABS: StudioTab[] = ['avatar', 'frame', 'title', 'head', 'portal', 'aura', 'banner', 'cardColor', 'badge', 'colors'];

// ── SVG Tab Icons ───────────────────────────────────────────────────────────

function TabIcon({ tab, className = 'w-3.5 h-3.5' }: { tab: StudioTab; className?: string }) {
  const props = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8 };
  switch (tab) {
    case 'avatar':
      return <svg {...props}><circle cx="12" cy="8" r="4" /><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" strokeLinecap="round" /></svg>;
    case 'frame':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /></svg>;
    case 'title':
      return <svg {...props}><path d="M4 7V4h16v3M9 20h6M12 4v16" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'head':
      return <svg {...props}><path d="M12 2l2.09 6.26L21 9.27l-5 3.64L17.18 20 12 16.27 6.82 20 8 12.91l-5-3.64 6.91-1.01L12 2z" strokeLinejoin="round" /></svg>;
    case 'portal':
      return <svg {...props}><circle cx="12" cy="12" r="9" strokeDasharray="4 3" /><circle cx="12" cy="12" r="4" /></svg>;
    case 'aura':
      return <svg {...props}><path d="M12 3c1.5 2 4 3.5 4 6.5a4 4 0 11-8 0c0-3 2.5-4.5 4-6.5z" /><path d="M12 8c.75 1 2 1.75 2 3.25a2 2 0 11-4 0c0-1.5 1.25-2.25 2-3.25z" /></svg>;
    case 'banner':
      return <svg {...props}><rect x="3" y="3" width="18" height="14" rx="2" /><path d="M3 9h18" /></svg>;
    case 'cardColor':
      return <svg {...props}><circle cx="7.5" cy="12" r="4.5" /><circle cx="16.5" cy="12" r="4.5" /><circle cx="12" cy="7" r="4.5" /></svg>;
    case 'badge':
      return <svg {...props}><path d="M12 2l1.5 3 3.5.5-2.5 2.5.5 3.5L12 10l-3 1.5.5-3.5L7 5.5 10.5 5 12 2z" strokeLinejoin="round" /></svg>;
    case 'colors':
      return <svg {...props}><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-9-10-9z" /><circle cx="7.5" cy="11" r="1.5" fill="currentColor" /><circle cx="10" cy="7.5" r="1.5" fill="currentColor" /><circle cx="14" cy="7.5" r="1.5" fill="currentColor" /><circle cx="16.5" cy="11" r="1.5" fill="currentColor" /></svg>;
  }
}

export interface CosmeticsStudioProps {
  initialCosmetics: CosmeticsSelection;
  nickname: string;
  onSave: (cosmetics: CosmeticsSelection) => void;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function hasNewItems(slot: CosmeticSlot): boolean {
  const items = getCosmeticsBySlot(slot);
  for (const item of items) {
    if (!isCosmeticSeen(slot, item.id)) return true;
  }
  return false;
}

// ── Rarity glow on hover — subtle border glow per rarity ────────────────

const RARITY_HOVER_GLOW: Record<CosmeticRarity, string> = {
  common:    '',
  epic:      'hover:shadow-[0_0_12px_-2px_rgba(52,211,153,0.2)]',
  rare:      'hover:shadow-[0_0_12px_-2px_rgba(59,130,246,0.2)]',
  legendary: 'hover:shadow-[0_0_16px_-2px_rgba(251,191,36,0.25)]',
};

// ── Info panel for hovered item ─────────────────────────────────────────────

function ItemInfo({ cosmetic, t }: { cosmetic: CosmeticDef; t: (k: string) => string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-base">{cosmetic.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-zinc-100">{t(cosmetic.labelKey)}</p>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${RARITY_COLORS[cosmetic.rarity]}`}>
            {t(`cosmetics.rarity.${cosmetic.rarity}`)}
          </span>
        </div>
      </div>
      {cosmetic.descriptionKey && (
        <p className="text-[10px] text-zinc-400">{t(cosmetic.descriptionKey)}</p>
      )}
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
    const ids = items.map((c) => c.id);
    if (ids.length > 0) markSlotAllSeen(slot, ids);
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-[min(96vw,920px)] h-[min(90vh,640px)] rounded-2xl border border-zinc-700/40 bg-[#0c0d12] shadow-2xl flex flex-col max-sm:!w-full max-sm:!h-full max-sm:!rounded-none max-sm:!border-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 shrink-0">
          <h2 className="text-sm font-bold text-zinc-100 tracking-wide uppercase">{t('studio.title')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors"
            >
              {t('studio.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              {t('studio.save')}
            </button>
          </div>
        </div>

        {/* Body: 2-column — preview left, editor right */}
        <div className="flex flex-1 min-h-0 max-sm:flex-col max-sm:overflow-y-auto">

          {/* Left: Large profile preview */}
          <div className="w-[300px] max-sm:w-full shrink-0 border-r max-sm:border-r-0 max-sm:border-b border-zinc-800/40 p-5 flex flex-col gap-4 overflow-y-auto scrollbar-thin bg-[#08090d]">
            <ProfileCard nickname={nickname} cosmetics={previewCosmetics} />
            {hoveredItem ? (
              <ItemInfo cosmetic={hoveredItem} t={t} />
            ) : (
              <div className="text-center py-4">
                <p className="text-[10px] text-zinc-600">{t('cosmetic.hoverHint')}</p>
              </div>
            )}
          </div>

          {/* Right: Tabs + items */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            {/* Tab bar — wrap on overflow, no scrollbar */}
            <div className="flex flex-wrap border-b border-zinc-800/40 shrink-0">
              {TABS.map((t_) => {
                const isSlot = t_ !== 'avatar' && t_ !== 'colors';
                const hasNew = isSlot && hasNewItems(t_ as CosmeticSlot);
                const active = tab === t_;
                return (
                  <button
                    key={t_}
                    onClick={() => setTab(t_)}
                    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                      active
                        ? 'border-indigo-500 text-zinc-100'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <TabIcon tab={t_} className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-indigo-400' : 'text-zinc-600'}`} />
                    <span>{t(`studio.tab.${t_}`)}</span>
                    {hasNew && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Items grid — scrollable with hidden scrollbar */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
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
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Sub-grids ───────────────────────────────────────────────────────────────

function AvatarGrid({ draft, setDraft, onHoverPreview }: { draft: CosmeticsSelection; setDraft: React.Dispatch<React.SetStateAction<CosmeticsSelection>>; onHoverPreview: (avatarId: string | null) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-6 max-sm:grid-cols-4 gap-2">
      {AVATAR_REGISTRY.map((av) => {
        const selected = draft.avatarId === av.id;
        return (
          <button
            key={av.id}
            onClick={() => setDraft((p) => ({ ...p, avatarId: av.id }))}
            onMouseEnter={() => onHoverPreview(av.id)}
            onMouseLeave={() => onHoverPreview(null)}
            className={`relative aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
              selected
                ? 'bg-indigo-600/20 ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10'
                : 'bg-zinc-800/60 hover:bg-zinc-800 hover:scale-105'
            }`}
            title={t(av.nameKey)}
          >
            {hasSvgAvatar(av.id) ? (
              <SvgAvatar avatarId={av.id} className="w-[70%] h-[70%]" />
            ) : (
              av.emoji
            )}
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
      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={() => setDraft((p) => ({ ...p, nameColor: undefined }))}
          onMouseEnter={() => onHoverPreview('')}
          onMouseLeave={() => onHoverPreview(null)}
          title={t('profile.colorDefault')}
          className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
            !draft.nameColor ? 'border-white/50 bg-zinc-700 scale-110' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'
          }`}
        >
          <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
            className={`w-8 h-8 rounded-full border-2 transition-all ${c.className} ${
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

  // Group items by set (items without set go into 'none' group)
  const setGroups: { setId: CosmeticSet | null; items: CosmeticDef[] }[] = [];
  const noSetItems: CosmeticDef[] = [];
  const setMap = new Map<CosmeticSet, CosmeticDef[]>();
  for (const c of items) {
    if (c.set) {
      const arr = setMap.get(c.set) ?? [];
      arr.push(c);
      setMap.set(c.set, arr);
    } else {
      noSetItems.push(c);
    }
  }
  if (noSetItems.length > 0) setGroups.push({ setId: null, items: noSetItems });
  for (const [setId, setItems] of setMap) setGroups.push({ setId, items: setItems });

  return (
    <div className="space-y-3">
      {/* None button */}
      <button
        onClick={() => onSelect(undefined)}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all ${
          !currentId ? 'bg-indigo-600/15 ring-2 ring-indigo-500/60' : 'bg-zinc-800/40 hover:bg-zinc-800/70'
        }`}
      >
        <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <span className="text-xs text-zinc-400">{t('cosmetic.none')}</span>
      </button>

      {setGroups.map((group, gi) => (
        <div key={group.setId ?? `_${gi}`} className="space-y-2">
          {/* Set label */}
          {group.setId && (
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold uppercase tracking-widest ${COSMETIC_SET_LABELS[group.setId].color}`}>
                {t(COSMETIC_SET_LABELS[group.setId].labelKey)}
              </span>
              <div className="flex-1 h-px bg-zinc-800/60" />
            </div>
          )}

          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-1.5">
            {group.items.map((c) => {
              const selected = currentId === c.id;
              const isNew = !isCosmeticSeen(slot, c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id === currentId ? undefined : c.id)}
                  onMouseEnter={() => { onHover(c); onHoverPreview(slot, c.id); }}
                  onFocus={() => { onHover(c); onHoverPreview(slot, c.id); }}
                  onMouseLeave={() => { onHover(null); onHoverPreview(slot, undefined); }}
                  onBlur={() => { onHover(null); onHoverPreview(slot, undefined); }}
                  className={`relative w-full rounded-lg px-2.5 py-2 flex items-center gap-2 text-left transition-all ${
                    selected
                      ? `${RARITY_BG[c.rarity]} ring-2 ${RARITY_RING[c.rarity]}`
                      : `bg-zinc-800/40 hover:bg-zinc-800/70 ${RARITY_HOVER_GLOW[c.rarity]}`
                  }`}
                >
                  <span className="text-base shrink-0">{c.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-zinc-200 truncate">{t(c.labelKey)}</p>
                    <div className="flex items-center gap-1.5 mt-px">
                      <span className={`w-1 h-1 rounded-full shrink-0 ${
                        c.rarity === 'legendary' ? 'bg-amber-400' : c.rarity === 'rare' ? 'bg-blue-400' : c.rarity === 'epic' ? 'bg-emerald-400' : 'bg-zinc-500'
                      }`} />
                      <span className={`text-[8px] font-semibold uppercase tracking-wider ${RARITY_COLORS[c.rarity]}`}>
                        {t(`cosmetics.rarity.${c.rarity}`)}
                      </span>
                    </div>
                  </div>
                  {isNew && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
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

  const RARITY_ACCENT: Record<CosmeticRarity, string> = {
    common:    'border-zinc-700/50',
    epic:      'border-emerald-500/30',
    rare:      'border-blue-500/30',
    legendary: 'border-amber-500/40',
  };
  const RARITY_SELECTED: Record<CosmeticRarity, string> = {
    common:    'ring-zinc-500/60 bg-zinc-800/60',
    epic:      'ring-emerald-500/50 bg-emerald-950/20',
    rare:      'ring-blue-500/50 bg-blue-950/20',
    legendary: 'ring-amber-500/50 bg-amber-950/20',
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
        {t('studio.maxBadges')}
      </p>
      <div className="grid grid-cols-3 max-sm:grid-cols-2 gap-2.5">
        {items.map((c) => {
          const selected = selectedBadges.includes(c.id);
          const isNew = !isCosmeticSeen('badge', c.id);
          const tooltipContent = c.descriptionKey ? (
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-400">{t(c.descriptionKey)}</p>
            </div>
          ) : null;
          return (
            <Tooltip key={c.id} content={tooltipContent} placement="bottom">
              <button
                onClick={() => toggleBadge(c.id)}
                onMouseEnter={() => { onHover(c); onHoverPreview(c.id); }}
                onFocus={() => { onHover(c); onHoverPreview(c.id); }}
                onMouseLeave={() => { onHover(null); onHoverPreview(null); }}
                onBlur={() => { onHover(null); onHoverPreview(null); }}
                className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all ${
                  selected
                    ? `ring-2 ${RARITY_SELECTED[c.rarity]} border-transparent`
                    : `${RARITY_ACCENT[c.rarity]} bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-zinc-600/50`
                }`}
              >
                {/* Badge icon container */}
                <span className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-base ${
                  selected ? 'bg-zinc-800/80' : 'bg-zinc-800/50'
                }`}>
                  {c.emoji}
                </span>
                {/* Label + rarity */}
                <span className="flex flex-col items-start min-w-0">
                  <span className="text-[11px] font-medium text-zinc-200 truncate max-w-full">{t(c.labelKey)}</span>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider ${RARITY_COLORS[c.rarity]}`}>
                    {t(`cosmetics.rarity.${c.rarity}`)}
                  </span>
                </span>
                {isNew && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
                {selected && (
                  <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-indigo-600 text-[8px] text-white font-bold leading-none ring-1 ring-zinc-900">
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
