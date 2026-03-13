'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useProgression } from '@/components/providers/ProgressionProvider';
import { createSeededRng } from '@/lib/seededRandom';
import { getTodayStr } from '@/lib/dailyChallenges/definitions';
import { XP_REWARDS } from '@/lib/progression/rewards';
import { isGotdBonusAvailable } from '@/lib/progression/xp';

interface SpotlightGame {
  id: string;
  emoji: string;
  titleKey: string;
  descKey: string;
  href: string;
}

const SPOTLIGHT_POOL: SpotlightGame[] = [
  { id: '2048', emoji: '🔢', titleKey: 'lobby.games.2048.title', descKey: 'lobby.games.2048.desc', href: '/games/2048' },
  { id: 'snake', emoji: '🐍', titleKey: 'lobby.games.snake.title', descKey: 'lobby.games.snake.desc', href: '/games/snake' },
  { id: 'sudoku', emoji: '#️⃣', titleKey: 'lobby.games.sudoku.title', descKey: 'lobby.games.sudoku.desc', href: '/games/sudoku' },
  { id: 'tetris', emoji: '🧱', titleKey: 'lobby.games.tetris.title', descKey: 'lobby.games.tetris.desc', href: '/games/tetris' },
  { id: 'flappy', emoji: '🐦', titleKey: 'lobby.games.flappy.title', descKey: 'lobby.games.flappy.desc', href: '/games/flappy' },
  { id: 'pong', emoji: '🏓', titleKey: 'lobby.games.pong.title', descKey: 'lobby.games.pong.desc', href: '/games/pong' },
  { id: 'breakout', emoji: '🧱', titleKey: 'lobby.games.breakout.title', descKey: 'lobby.games.breakout.desc', href: '/games/breakout' },
  { id: 'minesweeper', emoji: '💣', titleKey: 'lobby.games.minesweeper.title', descKey: 'lobby.games.minesweeper.desc', href: '/games/minesweeper' },
];

function getGameOfTheDay(): SpotlightGame {
  const rng = createSeededRng(`gotd_${getTodayStr()}`);
  const idx = Math.floor(rng() * SPOTLIGHT_POOL.length);
  return SPOTLIGHT_POOL[idx];
}

export function GameOfTheDay() {
  const { t } = useI18n();
  const { progression, isHydrated } = useProgression();
  const [game, setGame] = useState<SpotlightGame | null>(null);

  useEffect(() => {
    setGame(getGameOfTheDay());
  }, []);

  if (!game) return null;

  const bonusAvailable = isHydrated && isGotdBonusAvailable(progression, game.id);
  const bonusClaimed = isHydrated && !bonusAvailable && progression.gotdBonusDate === getTodayStr();

  return (
    <section className="max-w-5xl mx-auto px-6 pb-6">
      <div className="rounded-2xl border border-indigo-800/40 bg-gradient-to-r from-indigo-950/40 to-violet-950/40 p-5 flex items-center gap-5">
        <div className="w-14 h-14 rounded-xl border border-indigo-800/60 bg-indigo-950/60 flex items-center justify-center text-2xl shrink-0 select-none">
          {game.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-0.5">
            {t('daily.gameOfTheDay')}
          </p>
          <p className="text-lg font-bold text-zinc-100 truncate">{t(game.titleKey)}</p>
          <p className="text-xs text-zinc-400 truncate">{t(game.descKey)}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {isHydrated && (
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                bonusClaimed
                  ? 'bg-zinc-800/60 text-zinc-500 border-zinc-700/50'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {bonusClaimed
                ? `✓ +${XP_REWARDS.GOTD_FIRST_WIN} XP`
                : `+${XP_REWARDS.GOTD_FIRST_WIN} XP`}
            </span>
          )}
          <Link
            href={game.href}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            {t('lobby.play')}
          </Link>
        </div>
      </div>
    </section>
  );
}
