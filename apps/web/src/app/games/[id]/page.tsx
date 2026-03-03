import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { GameId } from 'shared';
import { GamePage } from '@/components/GamePage';
import { webRegistry } from '@/lib/gameRegistry';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ room?: string; quickplay?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const entry = webRegistry[id as GameId];
  return { title: entry ? `${entry.manifest.name} — Web Games` : 'Not Found' };
}

export default async function GameRoutePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { room, quickplay } = await searchParams;

  const entry = webRegistry[id as GameId];
  if (!entry) notFound();

  const { manifest } = entry;

  if (entry.comingSoon) {
    return (
      <GamePage title={manifest.name}>
        <div className="flex flex-col items-center justify-center min-h-[480px] gap-8 text-center px-4">
          <div className="w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-5xl text-zinc-700">
            ⊞
          </div>
          <div className="space-y-3 max-w-sm">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Coming Soon
            </div>
            <h2 className="text-3xl font-black text-zinc-300">{manifest.name}</h2>
            <p className="text-zinc-500 leading-relaxed">{manifest.description}</p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to games
          </Link>
        </div>
      </GamePage>
    );
  }

  const { Component } = entry;
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? '';

  return (
    <GamePage title={manifest.name}>
      <Component wsUrl={wsUrl} gameId={id as GameId} initialRoomCode={room} quickPlay={quickplay === 'true'} />
    </GamePage>
  );
}
