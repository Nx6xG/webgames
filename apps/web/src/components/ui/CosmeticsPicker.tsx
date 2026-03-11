'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/components/providers/LanguageProvider';
import { getCosmeticsBySlot, type CosmeticSlot, type CosmeticDef, type CosmeticRarity } from '@/lib/cosmetics';

// ── Rarity colors ────────────────────────────────────────────────────────────

const RARITY_COLORS: Record<CosmeticRarity, string> = {
  common:    'text-zinc-400',
  epic:      'text-emerald-400',
  rare:      'text-blue-400',
  legendary: 'text-amber-400',
};

const RARITY_BG: Record<CosmeticRarity, string> = {
  common:    'bg-zinc-800',
  epic:      'bg-emerald-950/40',
  rare:      'bg-blue-950/40',
  legendary: 'bg-amber-950/30',
};

const RARITY_RING: Record<CosmeticRarity, string> = {
  common:    'ring-zinc-600',
  epic:      'ring-emerald-600/50',
  rare:      'ring-blue-500/50',
  legendary: 'ring-amber-500/50',
};

// ── Info panel ───────────────────────────────────────────────────────────────

function InfoPanel({
  cosmetic,
  t,
}: {
  cosmetic: CosmeticDef;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center gap-2.5 min-h-[36px]">
      <span className="text-lg shrink-0">{cosmetic.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-zinc-200 truncate">
            {t(cosmetic.labelKey)}
          </p>
          <span className={`text-[9px] font-semibold uppercase ${RARITY_COLORS[cosmetic.rarity]}`}>
            {t(`cosmetics.rarity.${cosmetic.rarity}`)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── CosmeticsPicker ──────────────────────────────────────────────────────────

interface CosmeticsPickerProps {
  slot: CosmeticSlot;
  currentId: string | undefined;
  onSelect: (id: string | undefined) => void;
  onClose: () => void;
}

export function CosmeticsPicker({ slot, currentId, onSelect, onClose }: CosmeticsPickerProps) {
  const { t } = useI18n();
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hoveredCosmetic, setHoveredCosmetic] = useState<CosmeticDef | null>(null);

  const items = getCosmeticsBySlot(slot);

  // Portal mount guard (SSR-safe)
  useEffect(() => { setMounted(true); }, []);

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Auto-focus panel
  useEffect(() => { panelRef.current?.focus(); }, []);

  function handleSelect(c: CosmeticDef) {
    onSelect(c.id === currentId ? undefined : c.id);
    onClose();
  }

  function handleClear() {
    onSelect(undefined);
    onClose();
  }

  const infoDef = hoveredCosmetic ?? items.find((c) => c.id === currentId) ?? null;

  if (!mounted) return null;

  const modal = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t(`cosmetics.slot.${slot}`)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-[340px] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl flex flex-col focus:outline-none"
        style={{ maxHeight: 'min(80vh, calc(100dvh - 48px))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h3 className="text-sm font-bold text-zinc-100">
            {t(`cosmetics.slot.${slot}`)}
          </h3>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto overscroll-contain p-4 space-y-3">
          {/* None / Clear button */}
          <button
            onClick={handleClear}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
              !currentId
                ? 'bg-indigo-600/20 ring-2 ring-indigo-500'
                : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            <span className="text-base">⊘</span>
            <span className="text-xs text-zinc-300">{t('cosmetic.none')}</span>
          </button>

          {/* Cosmetic tiles */}
          <div className="grid grid-cols-4 gap-2">
            {items.map((c) => {
              const selected = currentId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  onMouseEnter={() => setHoveredCosmetic(c)}
                  onFocus={() => setHoveredCosmetic(c)}
                  onMouseLeave={() => setHoveredCosmetic(null)}
                  onBlur={() => setHoveredCosmetic(null)}
                  className={`relative w-full aspect-square rounded-xl flex flex-col items-center justify-center text-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                    selected
                      ? `${RARITY_BG[c.rarity]} ring-2 ${RARITY_RING[c.rarity]} shadow-lg`
                      : `${RARITY_BG[c.rarity]} hover:scale-105`
                  }`}
                >
                  <span>{c.emoji}</span>
                  <span className={`text-[8px] mt-0.5 font-semibold uppercase leading-none ${RARITY_COLORS[c.rarity]}`}>
                    {t(`cosmetics.rarity.${c.rarity}`).charAt(0)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Info panel */}
        <div className="px-4 py-2.5 border-t border-zinc-800 shrink-0 bg-zinc-900/80">
          {infoDef ? (
            <InfoPanel cosmetic={infoDef} t={t} />
          ) : (
            <div className="min-h-[36px] flex items-center">
              <p className="text-[10px] text-zinc-600">{t('cosmetic.hoverHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
