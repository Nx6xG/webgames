'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import { UserSettingsPanel } from '@/components/settings/UserSettingsPanel';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { getCosmeticDef } from '@/lib/cosmetics';
import { BadgeIcon } from '@/components/ui/BadgeIcon';
import { getNameColorClass } from '@/lib/nameColors';
import {
  loadLocalProfile,
  MULTIPLAYER_GAME_IDS,
  SINGLEPLAYER_GAME_IDS,
  GAME_EMOJI,
} from '@/lib/localStats';
import type { LocalProfile, GameStat } from '@/lib/localStats';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t } = useI18n();
  const { nickname, cosmetics } = useNickname();
  const [profile, setProfile] = useState<LocalProfile | null>(null);

  useEffect(() => { setProfile(loadLocalProfile()); }, []);

  if (!profile) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
      </div>
    );
  }

  const achPct = profile.achievementsTotal > 0
    ? Math.round((profile.achievementsUnlocked / profile.achievementsTotal) * 100)
    : 0;

  const mpGames = profile.perGame.filter((g) =>
    (MULTIPLAYER_GAME_IDS as readonly string[]).includes(g.gameId),
  );
  const spGames = profile.perGame.filter((g) =>
    (SINGLEPLAYER_GAME_IDS as readonly string[]).includes(g.gameId),
  );

  const banner = cosmetics.slots?.banner;
  const bannerClass = `wg-banner-${banner || 'default'}`;
  const cardColorId = cosmetics.slots?.cardColor;
  const cardColorDef = cardColorId ? getCosmeticDef(cardColorId, 'cardColor') : undefined;
  const cardBgClass = cardColorDef ? `wg-card-${cardColorId?.replace('card-', '')}` : 'wg-card-default';
  const badges = cosmetics.badges?.slice(0, 3) ?? [];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* ── Profile Header ─────────────────────────────────────────────── */}
      <div className="relative">
        {/* Banner */}
        <div className={`${bannerClass} h-32 sm:h-44`} />

        {/* Back button */}
        <Link
          href="/"
          className="absolute top-4 left-4 text-white/70 hover:text-white bg-black/30 rounded-lg p-2 transition-colors backdrop-blur-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Card body over banner */}
        <div className="max-w-4xl mx-auto px-4">
          <div className={`${cardBgClass} -mt-12 rounded-xl border border-zinc-700/50 px-5 sm:px-6 pb-5 pt-0 relative`}>
            {/* Avatar */}
            <div className="-mt-10 mb-2">
              <span className="inline-block ring-4 ring-zinc-900 rounded-full">
                <AvatarBubble nickname={nickname} cosmetics={cosmetics} size="lg" />
              </span>
            </div>

            {/* Name row */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h1 className={`text-xl sm:text-2xl font-bold truncate ${getNameColorClass(cosmetics.nameColor) || 'text-zinc-100'}`}>
                  {nickname}
                </h1>
                {badges.length > 0 && (
                  <div className="flex gap-1.5 mt-1.5">
                    {badges.map((badgeId) => (
                      <BadgeIcon key={badgeId} badgeId={badgeId} size="md" />
                    ))}
                  </div>
                )}
              </div>
              {/* Meta stats */}
              <div className="flex items-center gap-4 text-xs text-zinc-500 shrink-0">
                <span><strong className="text-zinc-300 font-semibold">{profile.playsTotal}</strong> {t('profilePage.plays')}</span>
                <span><strong className="text-zinc-300 font-semibold">{profile.winsTotal}</strong> {t('profilePage.wins')}</span>
                <span><strong className="text-zinc-300 font-semibold">{profile.winRate}%</strong> {t('profilePage.winRate')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* ── Left Column ────────────────────────────────────────── */}
          <div className="space-y-6 min-w-0">

            {/* Overview Stats */}
            <section>
              <SectionHeader text={t('profilePage.overview')} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label={t('profilePage.gamesPlayed')} value={profile.playsTotal} />
                <StatCard label={t('profilePage.wins')} value={profile.winsTotal} />
                <StatCard label={t('profilePage.winRate')} value={`${profile.winRate}%`} />
                <StatCard
                  label={t('profilePage.favoriteGame')}
                  value={
                    profile.favoriteGameId
                      ? `${GAME_EMOJI[profile.favoriteGameId] ?? ''} ${t(`game.name.${profile.favoriteGameId}`)}`
                      : t('profilePage.noFavorite')
                  }
                  small={!profile.favoriteGameId}
                />
              </div>
            </section>

            {/* Achievements */}
            <section>
              <SectionHeader text={t('profilePage.achievements')} />
              <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🏆</span>
                  <span className="text-3xl font-black text-yellow-400">{profile.achievementsUnlocked}</span>
                  <span className="text-lg text-zinc-500 font-medium">/ {profile.achievementsTotal}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-zinc-700/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-400 transition-all duration-700"
                      style={{ width: `${achPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 font-medium shrink-0 w-10 text-right">{achPct}%</span>
                </div>
                <Link
                  href="/achievements"
                  className="mt-3 inline-block text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {t('nav.achievements')} →
                </Link>
              </div>
            </section>

            {/* Per game — Multiplayer */}
            {mpGames.some((g) => g.plays > 0) && (
              <section>
                <SectionHeader text={t('leaderboards.multiplayer')} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mpGames.filter((g) => g.plays > 0).map((g) => (
                    <GameStatCard key={g.gameId} stat={g} t={t} />
                  ))}
                </div>
              </section>
            )}

            {/* Per game — Singleplayer */}
            {spGames.some((g) => g.plays > 0) && (
              <section>
                <SectionHeader text={t('leaderboards.singleplayer')} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {spGames.filter((g) => g.plays > 0).map((g) => (
                    <GameStatCard key={g.gameId} stat={g} t={t} />
                  ))}
                </div>
              </section>
            )}

            {/* No data fallback */}
            {profile.playsTotal === 0 && (
              <p className="text-center text-zinc-500 py-12">{t('profilePage.noData')}</p>
            )}
          </div>

          {/* ── Right Column (sidebar) ─────────────────────────────── */}
          <div className="space-y-6">
            {/* Settings */}
            <section>
              <SectionHeader text={t('profile.settings')} />
              <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-5">
                <UserSettingsPanel />
              </div>
            </section>

            {/* Cosmetics Showcase */}
            <section>
              <SectionHeader text={t('profilePage.showcase')} />
              <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
                <div className="flex flex-wrap gap-2">
                  <ShowcaseItem emoji={cosmetics.slots?.frame ? (getCosmeticDef(cosmetics.slots.frame, 'frame')?.emoji ?? '◆') : '⊘'} label={t('studio.tab.frame')} active={!!cosmetics.slots?.frame} />
                  <ShowcaseItem emoji={cosmetics.slots?.head ? (getCosmeticDef(cosmetics.slots.head, 'head')?.emoji ?? '👑') : '⊘'} label={t('studio.tab.head')} active={!!cosmetics.slots?.head} />
                  <ShowcaseItem emoji={cosmetics.slots?.portal ? (getCosmeticDef(cosmetics.slots.portal, 'portal')?.emoji ?? '🕳️') : '⊘'} label={t('studio.tab.portal')} active={!!cosmetics.slots?.portal} />
                  <ShowcaseItem emoji={cosmetics.slots?.aura ? (getCosmeticDef(cosmetics.slots.aura, 'aura')?.emoji ?? '✨') : '⊘'} label={t('studio.tab.aura')} active={!!cosmetics.slots?.aura} />
                  <ShowcaseItem emoji={cosmetics.slots?.banner ? (getCosmeticDef(cosmetics.slots.banner, 'banner')?.emoji ?? '🌅') : '⊘'} label={t('studio.tab.banner')} active={!!cosmetics.slots?.banner} />
                  <ShowcaseItem emoji={cosmetics.slots?.cardColor ? (getCosmeticDef(cosmetics.slots.cardColor, 'cardColor')?.emoji ?? '🎨') : '⊘'} label={t('studio.tab.cardColor')} active={!!cosmetics.slots?.cardColor} />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────────────────

function SectionHeader({ text }: { text: string }) {
  return (
    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
      {text}
    </h2>
  );
}

function StatCard({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`font-bold ${small ? 'text-sm text-zinc-400' : 'text-2xl'}`}>{value}</p>
    </div>
  );
}

function ShowcaseItem({ emoji, label, active }: { emoji: string; label: string; active: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1 p-2 rounded-lg ${active ? 'bg-zinc-700/30' : 'bg-zinc-800/20 opacity-40'}`} title={label}>
      <span className="text-lg">{emoji}</span>
      <span className="text-[9px] text-zinc-500 font-medium">{label}</span>
    </div>
  );
}

function GameStatCard({ stat, t }: { stat: GameStat; t: (k: string) => string }) {
  const emoji = GAME_EMOJI[stat.gameId] ?? '🎮';
  const name = t(`game.name.${stat.gameId}`);

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4 hover:border-zinc-600/70 hover:bg-zinc-800/50 transition-all duration-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{emoji}</span>
        <p className="font-semibold text-sm truncate">{name}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-zinc-500">{t('profilePage.plays')}</p>
          <p className="text-lg font-bold">{stat.plays}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">{t('profilePage.wins')}</p>
          <p className="text-lg font-bold">{stat.wins}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">{t('profilePage.winRate')}</p>
          <p className="text-lg font-bold">{stat.winRate}%</p>
        </div>
      </div>
      {(stat.bestScore !== null || stat.bestTime !== null || stat.bestTile !== null || stat.bestLines !== null) && (
        <div className="mt-3 pt-3 border-t border-zinc-700/50 flex flex-wrap gap-x-4 gap-y-1">
          {stat.bestScore !== null && (
            <div className="text-xs">
              <span className="text-zinc-500">{t('profilePage.bestScore')}: </span>
              <span className="text-zinc-200 font-semibold">{stat.bestScore.toLocaleString()}</span>
            </div>
          )}
          {stat.bestTile !== null && (
            <div className="text-xs">
              <span className="text-zinc-500">{t('profilePage.bestTile')}: </span>
              <span className="text-zinc-200 font-semibold">{stat.bestTile}</span>
            </div>
          )}
          {stat.bestLines !== null && (
            <div className="text-xs">
              <span className="text-zinc-500">{t('profilePage.bestLines')}: </span>
              <span className="text-zinc-200 font-semibold">{stat.bestLines}</span>
            </div>
          )}
          {stat.bestTime !== null && (
            <div className="text-xs">
              <span className="text-zinc-500">{t('profilePage.bestTime')}: </span>
              <span className="text-zinc-200 font-semibold">{formatTime(stat.bestTime)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
