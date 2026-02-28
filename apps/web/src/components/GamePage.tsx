import Link from 'next/link';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
}

export function GamePage({ title, children }: Props) {
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
            Games
          </Link>
          <span className="text-zinc-700">/</span>
          <h1 className="font-bold text-zinc-100">{title}</h1>
          <div className="ml-auto flex items-center gap-4">
            <Link href="/rooms" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Rooms
            </Link>
            <Link href="/leaderboard" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Leaderboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        {children}
      </main>
    </div>
  );
}
