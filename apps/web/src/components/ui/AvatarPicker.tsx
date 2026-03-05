'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AVATAR_REGISTRY, getAvatarById, getRecentAvatarUnlocks, type AvatarDef } from '@/lib/avatars';
import { loadUnlocked } from '@/lib/achievements/store';
import { getAchievementById } from '@/lib/achievements';
import { useI18n } from '@/components/providers/LanguageProvider';

// ── Info panel helper ────────────────────────────────────────────────────────

function InfoPanel({
  avatar,
  locked,
  t,
}: {
  avatar: AvatarDef;
  locked: boolean;
  t: (key: string) => string;
}) {
  const achDef = avatar.requiredAchievement
    ? getAchievementById(avatar.requiredAchievement)
    : null;

  return (
    <div className="flex items-center gap-2.5 min-h-[36px]">
      <span className="text-lg shrink-0">{avatar.emoji}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-zinc-200 truncate">
          {t(avatar.nameKey)}
        </p>
        {avatar.category === 'default' ? (
          <p className="text-[10px] text-zinc-500 truncate">
            {t('avatar.info.default')}
          </p>
        ) : locked && achDef ? (
          <p className="text-[10px] text-rose-400/80 truncate">
            {t('avatar.info.lockedNeed')}{t(achDef.nameKey)}
          </p>
        ) : achDef ? (
          <p className="text-[10px] text-emerald-400/80 truncate">
            {t('avatar.info.unlockedBy')}{t(achDef.nameKey)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── AvatarPicker ────────────────────────────────────────────────────────────

interface AvatarPickerProps {
  currentAvatarId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function AvatarPicker({ currentAvatarId, onSelect, onClose }: AvatarPickerProps) {
  const { t } = useI18n();
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const unlocked = loadUnlocked();
  const [mounted, setMounted] = useState(false);
  const [hoveredAvatar, setHoveredAvatar] = useState<AvatarDef | null>(null);

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

  // Auto-focus the panel for keyboard nav
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const defaults = AVATAR_REGISTRY.filter((a) => a.category === 'default');
  const achievements = AVATAR_REGISTRY.filter((a) => a.category === 'achievement');

  // Recent avatar unlocks: only achievement avatars that are currently unlocked
  const recentAvatarIds = getRecentAvatarUnlocks();
  const recentAvatars = recentAvatarIds
    .map((id) => getAvatarById(id))
    .filter((a): a is AvatarDef => !!a && a.category === 'achievement' && !!a.requiredAchievement && unlocked.has(a.requiredAchievement));
  const recentSet = new Set(recentAvatars.map((a) => a.id));

  const isUnlocked = useCallback((a: AvatarDef): boolean => {
    if (a.category === 'default') return true;
    return a.requiredAchievement ? unlocked.has(a.requiredAchievement) : true;
  }, [unlocked]);

  function handleSelect(a: AvatarDef) {
    if (!isUnlocked(a)) return;
    onSelect(a.id);
    onClose();
  }

  // The avatar shown in the info panel: hovered > current selection
  const currentAvatarDef = AVATAR_REGISTRY.find((a) => a.id === currentAvatarId) ?? AVATAR_REGISTRY[0];
  const infoAvatar = hoveredAvatar ?? currentAvatarDef;
  const infoLocked = !isUnlocked(infoAvatar);

  function renderTile(a: AvatarDef, showNewBadge = false, keyPrefix = '') {
    const locked = !isUnlocked(a);
    const selected = currentAvatarId === a.id;
    const badge = showNewBadge && !locked && a.category === 'achievement';
    return (
      <button
        key={keyPrefix + a.id}
        onClick={() => handleSelect(a)}
        aria-disabled={locked}
        onMouseEnter={() => setHoveredAvatar(a)}
        onFocus={() => setHoveredAvatar(a)}
        onMouseLeave={() => setHoveredAvatar(null)}
        onBlur={() => setHoveredAvatar(null)}
        className={`group relative w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          locked
            ? 'bg-zinc-800/60 opacity-40 cursor-not-allowed'
            : selected
              ? 'bg-indigo-600/30 ring-2 ring-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
              : 'bg-zinc-800 hover:bg-zinc-700 hover:scale-105'
        }`}
      >
        {a.emoji}
        {locked && (
          <span className="absolute bottom-0 right-0 w-4 h-4 flex items-center justify-center rounded-tl-md bg-zinc-900/90 text-[9px] leading-none pointer-events-none">
            🔒
          </span>
        )}
        {badge && (
          <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold uppercase leading-none px-1 py-0.5 rounded bg-emerald-600 text-white pointer-events-none">
            {t('avatar.newBadge')}
          </span>
        )}
      </button>
    );
  }

  if (!mounted) return null;

  const modal = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('avatar.select')}
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
        {/* Sticky header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h3 className="text-sm font-bold text-zinc-100">{t('avatar.select')}</h3>
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

        {/* Scrollable body */}
        <div className="overflow-y-auto overscroll-contain p-4 space-y-5">
          {/* Recently unlocked section */}
          {recentAvatars.length > 0 && (
            <div>
              <p className="text-[11px] text-emerald-500/80 uppercase tracking-wider font-semibold mb-2.5">
                {t('avatar.recentTitle')}
              </p>
              <div className="grid grid-cols-5 gap-2">
                {recentAvatars.map((a) => renderTile(a, true, 'recent-'))}
              </div>
            </div>
          )}

          {/* Default section */}
          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-2.5">
              {t('avatar.default')}
            </p>
            <div className="grid grid-cols-5 gap-2">
              {defaults.map((a) => renderTile(a))}
            </div>
          </div>

          {/* Achievement section */}
          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-2.5">
              {t('avatar.achievements')}
            </p>
            <div className="grid grid-cols-5 gap-2">
              {achievements.map((a) => renderTile(a))}
            </div>
          </div>
        </div>

        {/* Persistent info panel */}
        <div className="px-4 py-2.5 border-t border-zinc-800 shrink-0 bg-zinc-900/80">
          <InfoPanel avatar={infoAvatar} locked={infoLocked} t={t} />
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
