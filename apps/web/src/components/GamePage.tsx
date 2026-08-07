'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { GlobalMuteButton } from '@/components/ui/GlobalMuteButton';
import { OnlineNavChip } from '@/components/social/OnlineNavChip';

interface Props {
  title: string;
  children: ReactNode;
  /** When true, the main content area has no max-width constraint (e.g. for full-screen arena games). */
  fullWidth?: boolean;
}

export function GamePage({ title, children, fullWidth }: Props) {
  const { t } = useI18n();

  return (
    <div className="h-dvh bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex items-center gap-2 sm:gap-4 overflow-x-auto scrollbar-none">
          <Link
            href="/"
            className="flex items-center gap-1 sm:gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('nav.games')}
          </Link>
          <span className="text-zinc-700 flex-shrink-0">/</span>
          <h1 className="font-bold text-zinc-100 text-sm sm:text-base truncate min-w-0">{title}</h1>
          <div className="ml-auto flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <GlobalMuteButton />
            <OnlineNavChip />
            <Link href="/rooms" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap hidden sm:block">
              {t('nav.rooms')}
            </Link>
            <Link href="/leaderboards" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap hidden sm:block">
              {t('nav.leaderboard')}
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className={`flex-1 min-h-0 ${fullWidth ? '' : 'max-w-6xl'} mx-auto w-full px-2 sm:px-6 py-2 lg:py-3 flex flex-col overflow-auto scrollbar-none`}>
        {children}
      </main>
    </div>
  );
}
