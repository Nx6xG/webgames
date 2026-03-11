'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { ProfileData } from '@/lib/profileData';
import { GAME_EMOJI } from '@/lib/profileData';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { getCosmeticDef } from '@/lib/cosmetics';
import { BadgeIcon } from '@/components/ui/BadgeIcon';
import { getNameColorClass } from '@/lib/nameColors';
import { useI18n } from '@/components/providers/LanguageProvider';
import { isFriend, addFriend, removeFriend } from '@/lib/friends';
import { getAchievementById } from '@/lib/achievements';
import type { ProfileShowcase, ShowcaseStat } from 'shared';

export interface ProfileViewerModalProps {
  profile: ProfileData;
  onClose: () => void;
  /** Show a loading spinner overlay while cloud stats are being fetched. */
  loading?: boolean;
  /** Supabase account id — when present, renders a "View Profile" link. */
  userId?: string;
}

export function ProfileViewerModal({ profile, onClose, loading, userId }: ProfileViewerModalProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [friendStatus, setFriendStatus] = useState(false);

  useEffect(() => {
    if (!profile.isMe) setFriendStatus(isFriend(profile.id));
  }, [profile.id, profile.isMe]);

  const toggleFriend = useCallback(() => {
    if (friendStatus) {
      removeFriend(profile.id);
      setFriendStatus(false);
    } else {
      addFriend(profile.id, profile.nickname);
      setFriendStatus(true);
    }
  }, [friendStatus, profile.id, profile.nickname]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  if (!mounted) return null;

  const { cosmetics, stats, showcase } = profile;
  const banner = cosmetics.slots?.banner;
  const bannerClass = `wg-banner-${banner || 'default'}`;
  const cardColorId = cosmetics.slots?.cardColor;
  const cardColorDef = cardColorId ? getCosmeticDef(cardColorId, 'cardColor') : undefined;
  const cardBgClass = cardColorDef ? `wg-card-${cardColorId?.replace('card-', '')}` : 'wg-card-default';
  const badges = cosmetics.badges?.slice(0, 3) ?? [];

  const modal = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.nickname} — ${t('profilePage.title')}`}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-[min(92vw,420px)] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden max-sm:w-full max-sm:mx-3">
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close profile"
          className="absolute top-3 right-3 z-10 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-md p-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Banner */}
        <div className={`${bannerClass} h-20`} />

        {/* Card body */}
        <div className={`${cardBgClass} px-5 pb-5`}>
          {/* Avatar overlapping banner */}
          <div className="-mt-8 mb-2">
            <span className="inline-block ring-4 ring-zinc-900 rounded-full">
              <AvatarBubble nickname={profile.nickname} cosmetics={cosmetics} size="lg" />
            </span>
          </div>

          {/* Name + badges */}
          <p className={`text-lg font-bold truncate ${getNameColorClass(cosmetics.nameColor) || 'text-zinc-100'}`}>
            {profile.nickname}
          </p>

          {badges.length > 0 && (
            <div className="flex gap-1.5 mt-1.5">
              {badges.map((badgeId) => (
                <BadgeIcon key={badgeId} badgeId={badgeId} size="md" />
              ))}
            </div>
          )}

          {/* Friend toggle */}
          {!profile.isMe && (
            <button
              onClick={toggleFriend}
              className={`mt-3 w-full py-2 rounded-lg text-xs font-semibold transition-colors border ${
                friendStatus
                  ? 'border-rose-800/50 bg-rose-950/30 text-rose-400 hover:bg-rose-950/50'
                  : 'border-indigo-700/50 bg-indigo-950/30 text-indigo-400 hover:bg-indigo-950/50'
              }`}
            >
              {friendStatus ? t('friends.remove') : t('friends.add')}
            </button>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="mt-4 flex items-center justify-center gap-2 px-3 py-6 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
              <svg className="w-4 h-4 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="text-xs text-zinc-400">{t('profileViewer.loading')}</span>
            </div>
          )}

          {/* Full stats (self / cloud user) */}
          {!loading && stats ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label={t('profilePage.gamesPlayed')} value={stats.playsTotal} />
                <MiniStat label={t('profilePage.wins')} value={stats.winsTotal} />
                <MiniStat label={t('profilePage.winRate')} value={`${stats.winRate}%`} />
              </div>

              {stats.favoriteGameId && (
                <FavoriteGameRow gameId={stats.favoriteGameId} t={t} />
              )}

              {stats.achievementsTotal > 0 && (
                <div className="px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{t('profilePage.achievements')}</span>
                    <span className="text-xs text-yellow-400 font-bold">{stats.achievementsUnlocked}/{stats.achievementsTotal}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-700/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                      style={{ width: `${stats.achievementsTotal > 0 ? Math.round((stats.achievementsUnlocked / stats.achievementsTotal) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Showcase achievements (even for users with full stats) */}
              {showcase?.achievements && showcase.achievements.length > 0 && (
                <ShowcaseAchievements ids={showcase.achievements} t={t} />
              )}
            </div>
          ) : !loading && showcase && hasShowcaseContent(showcase) ? (
            /* Showcase for users without full stats */
            <ShowcaseSection showcase={showcase} t={t} />
          ) : !loading ? (
            <div className="mt-4 px-3 py-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30 text-center">
              <p className="text-xs text-zinc-500">{t('profileViewer.noStats')}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{t('profileViewer.noStatsHint')}</p>
            </div>
          ) : null}

          {/* View Profile link */}
          {userId && (
            <Link
              href={`/profile/${userId}`}
              onClick={onClose}
              className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
            >
              {t('profileViewer.viewProfile')}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/30 px-2.5 py-2 text-center">
      <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-zinc-100 mt-0.5">{value}</p>
    </div>
  );
}

function FavoriteGameRow({ gameId, t }: { gameId: string; t: (k: string) => string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
      <span className="text-base">{GAME_EMOJI[gameId] ?? '🎮'}</span>
      <div>
        <p className="text-[10px] text-zinc-500">{t('profilePage.favoriteGame')}</p>
        <p className="text-xs font-semibold text-zinc-200">{t(`game.name.${gameId}`)}</p>
      </div>
    </div>
  );
}

function hasShowcaseContent(sc: ProfileShowcase): boolean {
  return !!(sc.favoriteGameId || (sc.stats && sc.stats.length > 0) || (sc.achievements && sc.achievements.length > 0));
}

/** Stat type label (translated). */
function statLabel(statKey: string, gameId: string, t: (k: string) => string): string {
  const gameName = gameId === 'total' ? t('showcase.total') : t(`game.name.${gameId}`);
  const typeLabel = t(`showcase.stat.${statKey}`);
  return `${gameName} · ${typeLabel}`;
}

function ShowcaseSection({ showcase, t }: { showcase: ProfileShowcase; t: (k: string) => string }) {
  return (
    <div className="mt-4 space-y-3">
      {/* Favorite game */}
      {showcase.favoriteGameId && (
        <FavoriteGameRow gameId={showcase.favoriteGameId} t={t} />
      )}

      {/* Featured stats */}
      {showcase.stats && showcase.stats.length > 0 && (
        <div className={`grid gap-2 ${showcase.stats.length === 1 ? 'grid-cols-1' : showcase.stats.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {showcase.stats.map((ss, i) => (
            <MiniStat key={i} label={statLabel(ss.statKey, ss.gameId, t)} value={ss.value} />
          ))}
        </div>
      )}

      {/* Featured achievements */}
      {showcase.achievements && showcase.achievements.length > 0 && (
        <ShowcaseAchievements ids={showcase.achievements} t={t} />
      )}
    </div>
  );
}

function ShowcaseAchievements({ ids, t }: { ids: string[]; t: (k: string) => string }) {
  const defs = ids.map((id) => getAchievementById(id)).filter(Boolean);
  if (defs.length === 0) return null;

  return (
    <div className="px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-2">{t('profilePage.achievements')}</p>
      <div className="flex gap-2">
        {defs.map((def) => (
          <div
            key={def!.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-700/30 border border-zinc-600/20"
            title={t(def!.nameKey)}
          >
            <span className="text-sm">{def!.icon}</span>
            <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[80px]">{t(def!.nameKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
