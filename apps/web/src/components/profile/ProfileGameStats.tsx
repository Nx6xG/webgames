'use client';

import Link from 'next/link';
import { useI18n } from '@/components/providers/LanguageProvider';
import { GAME_EMOJI, MULTIPLAYER_GAME_IDS } from '@/lib/localStats';
import type { GameStatEntry } from './types';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  title: string;
  games: GameStatEntry[];
}

export function ProfileGameStats({ title, games }: Props) {
  const { t } = useI18n();
  const withData = games.filter((g) => g.played > 0);
  if (withData.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {withData.map((stat) => (
          <GameStatCard key={stat.gameId} stat={stat} t={t} />
        ))}
      </div>
    </section>
  );
}

function GameStatCard({ stat, t }: { stat: GameStatEntry; t: (k: string) => string }) {
  const emoji = GAME_EMOJI[stat.gameId] ?? '🎮';
  const name = t(`game.name.${stat.gameId}`);
  const losses = stat.played - stat.wins;
  const isMultiplayer = (MULTIPLAYER_GAME_IDS as readonly string[]).includes(stat.gameId);
  const href = `/games/${stat.gameId}`;

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4 hover:border-zinc-600/70 hover:bg-zinc-800/50 transition-all duration-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{emoji}</span>
        <p className="font-semibold text-sm truncate flex-1">{name}</p>
        <Link
          href={isMultiplayer ? `${href}?quickplay=true` : href}
          className="text-xs px-2.5 py-1 rounded-md bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-700/30 transition-colors shrink-0"
        >
          {t('lobby.play')}
        </Link>
      </div>

      {/* Winrate bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-2 rounded-full bg-zinc-700/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${stat.winrate}%` }}
          />
        </div>
        <span className="text-xs text-zinc-400 font-medium tabular-nums shrink-0 w-9 text-right">{stat.winrate}%</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-zinc-500">{t('profilePage.plays')}</p>
          <p className="text-lg font-bold">{stat.played}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">{t('profilePage.wins')}</p>
          <p className="text-lg font-bold text-emerald-400">{stat.wins}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">{t('profilePage.losses')}</p>
          <p className="text-lg font-bold text-rose-400">{losses}</p>
        </div>
      </div>
      {(stat.bestScore != null || stat.bestTime != null || stat.bestTile != null || stat.bestLines != null) && (
        <div className="mt-3 pt-3 border-t border-zinc-700/50 flex flex-wrap gap-x-4 gap-y-1">
          {stat.bestScore != null && (
            <div className="text-xs">
              <span className="text-zinc-500">{t('profilePage.bestScore')}: </span>
              <span className="text-zinc-200 font-semibold">{stat.bestScore.toLocaleString()}</span>
            </div>
          )}
          {stat.bestTile != null && (
            <div className="text-xs">
              <span className="text-zinc-500">{t('profilePage.bestTile')}: </span>
              <span className="text-zinc-200 font-semibold">{stat.bestTile}</span>
            </div>
          )}
          {stat.bestLines != null && (
            <div className="text-xs">
              <span className="text-zinc-500">{t('profilePage.bestLines')}: </span>
              <span className="text-zinc-200 font-semibold">{stat.bestLines}</span>
            </div>
          )}
          {stat.bestTime != null && (
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
