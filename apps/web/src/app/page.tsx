import Link from 'next/link';
import { webRegistry } from '@/lib/gameRegistry';
import type { WebGameEntry } from '@/lib/gameRegistry';
import { GlobalChatWidget } from '@/components/chat/GlobalChatWidget';
import { ProfileMenu } from '@/components/ProfileMenu';

const CATEGORY_COLORS: Record<string, string> = {
  classic: 'bg-amber-900/40 text-amber-300 border-amber-800',
  strategy: 'bg-indigo-900/40 text-indigo-300 border-indigo-800',
  '2 players': 'bg-rose-900/40 text-rose-300 border-rose-800',
  multiplayer: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
};

function GameCard({ entry }: { entry: WebGameEntry }) {
  const { manifest: game, comingSoon } = entry;

  if (comingSoon) {
    return (
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 opacity-70 cursor-default">
        <div className="w-14 h-14 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-600 flex items-center justify-center mb-5 text-2xl">⊞</div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-lg text-zinc-500">{game.name}</h3>
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-800/60 text-zinc-500 font-medium">Soon</span>
        </div>
        <p className="text-sm mb-4 leading-relaxed text-zinc-600">{game.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {game.categories.map((cat) => (
            <span key={cat} className="text-xs px-2 py-0.5 rounded-full border bg-zinc-900 text-zinc-600 border-zinc-800">{cat}</span>
          ))}
        </div>
        <p className="mt-5 text-sm text-zinc-600">Coming soon</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--cardBorder)] bg-[var(--card)] p-6 hover:border-indigo-700/60 hover:bg-zinc-800/50 transition-all duration-200">
      <div className="w-14 h-14 rounded-xl border bg-indigo-950 border-indigo-900 flex items-center justify-center mb-5 text-2xl">⊞</div>
      <h3 className="font-bold text-lg mb-1">{game.name}</h3>
      <p className="text-sm mb-4 leading-relaxed text-zinc-400">{game.description}</p>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {game.categories.map((cat) => (
          <span key={cat} className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>{cat}</span>
        ))}
      </div>
      <div className="flex gap-2">
        <Link
          href={`/games/${game.routeSlug}?quickplay=true`}
          className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold text-center transition-colors"
        >
          Quick Play
        </Link>
        <Link
          href={`/games/${game.routeSlug}`}
          className="px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          title="Create or join a custom room"
        >
          Custom
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Header */}
      <header className="border-b border-[var(--cardBorder)] bg-[var(--bg)]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-sm">
            W
          </div>
          <span className="font-bold text-lg tracking-tight">Web Games</span>
          <nav className="ml-auto flex items-center gap-5">
            <Link href="/rooms" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              Rooms
            </Link>
            <Link href="/leaderboard" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              Leaderboard
            </Link>
            <div className="w-px h-4 bg-zinc-700 shrink-0" aria-hidden />
            <ProfileMenu />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-5xl font-black tracking-tight mb-4">
          Play.{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-rose-400">
            Together.
          </span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-md mx-auto">
          Real-time multiplayer games in your browser — no account required.
        </p>
      </section>

      {/* Games grid */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-6">
          Available Games
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(webRegistry).map((entry) => (
            <GameCard key={entry.manifest.id} entry={entry} />
          ))}
        </div>
      </section>

      <GlobalChatWidget />
    </main>
  );
}
