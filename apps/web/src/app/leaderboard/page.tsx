import type { Metadata } from 'next';
import Link from 'next/link';
import { LeaderboardClient } from '@/components/LeaderboardClient';

export const metadata: Metadata = { title: 'Leaderboard — Web Games' };

export default function LeaderboardPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
  return (
    <>
      {/* Shared nav header */}
      <header className="border-b border-[var(--cardBorder)] bg-[var(--bg)]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Games
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="font-bold text-zinc-100">Leaderboard</span>
        </div>
      </header>
      <LeaderboardClient wsUrl={wsUrl} />
    </>
  );
}
