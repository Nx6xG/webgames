'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { isGloballyMuted, setGlobalMuted } from '@/lib/globalMute';

interface Props {
  title: string;
  children: ReactNode;
}

export function GamePage({ title, children }: Props) {
  const { t } = useI18n();
  const [muted, setMuted] = useState(false);

  useEffect(() => { setMuted(isGloballyMuted()); }, []);

  const toggle = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      setGlobalMuted(next);
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('nav.games')}
          </Link>
          <span className="text-zinc-700">/</span>
          <h1 className="font-bold text-zinc-100">{title}</h1>
          <div className="ml-auto flex items-center gap-4">
            <button
              onClick={toggle}
              className="text-zinc-500 hover:text-zinc-300 transition-colors text-base leading-none"
              title={muted ? t('game.sound.unmute') : t('game.sound.mute')}
              aria-label={muted ? t('game.sound.unmute') : t('game.sound.mute')}
            >
              {muted ? '\u{1F507}' : '\u{1F50A}'}
            </button>
            <Link href="/rooms" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              {t('nav.rooms')}
            </Link>
            <Link href="/leaderboard" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              {t('nav.leaderboard')}
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-4 lg:py-6 xl:py-10">
        {children}
      </main>
    </div>
  );
}
