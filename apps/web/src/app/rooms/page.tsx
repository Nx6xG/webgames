import type { Metadata } from 'next';
import Link from 'next/link';
import { RoomsClient } from '@/components/RoomsClient';

export const metadata: Metadata = { title: 'Open Rooms — Web Games' };

export default function RoomsPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Games
          </Link>
          <span className="text-zinc-700">/</span>
          <h1 className="font-bold text-zinc-100">Open Rooms</h1>
          <nav className="ml-auto">
            <Link href="/leaderboard" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              Leaderboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-black tracking-tight mb-2">Open Rooms</h2>
          <p className="text-zinc-400 text-sm">Join a quick-play room waiting for a second player.</p>
        </div>
        <RoomsClient wsUrl={wsUrl} />
      </main>
    </div>
  );
}
