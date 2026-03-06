'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/providers/LanguageProvider';
import { loadRecent } from '@/lib/recentlyPlayed';
import type { RecentEntry } from '@/lib/recentlyPlayed';
import { GAME_EMOJI } from '@/lib/localStats';

/** Maps gameId → i18n title key. Covers all known games. */
const TITLE_KEYS: Record<string, string> = {
  tictactoe: 'lobby.games.tictactoe.title',
  connect4: 'lobby.games.connect4.title',
  rps: 'lobby.games.rps.title',
  chess: 'lobby.games.chess.title',
  battleship: 'lobby.games.battleship.title',
  liarsbar: 'lobby.games.liarsbar.title',
  '2048': 'lobby.games.2048.title',
  snake: 'lobby.games.snake.title',
  tetris: 'lobby.games.tetris.title',
  flappy: 'lobby.games.flappy.title',
  sudoku: 'lobby.games.sudoku.title',
  'tictactoe-solo': 'lobby.games.tictactoe-solo.title',
  pong: 'lobby.games.pong.title',
  breakout: 'lobby.games.breakout.title',
  minesweeper: 'lobby.games.minesweeper.title',
};

function timeAgo(ts: number, t: (k: string) => string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t('recent.justNow');
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function RecentlyPlayed() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<RecentEntry[]>([]);

  useEffect(() => {
    setEntries(loadRecent());
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className="max-w-5xl mx-auto px-6 pb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        {t('recent.title')}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {entries.map((entry) => (
          <Link
            key={entry.gameId}
            href={`/games/${entry.gameId}`}
            className="shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--cardBorder)] bg-[var(--card)] hover:border-indigo-600/50 hover:bg-zinc-800/50 transition-all group"
          >
            <span className="text-xl select-none">{GAME_EMOJI[entry.gameId] ?? '🎮'}</span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100">
                {t(TITLE_KEYS[entry.gameId] ?? entry.gameId)}
              </span>
              <span className="text-[10px] text-zinc-500">{timeAgo(entry.ts, t)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
