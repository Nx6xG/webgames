'use client';

interface Props {
  message: string;
}

export function LeaderboardEmptyState({ message }: Props) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-6 py-12 text-center">
      <div className="text-3xl mb-3 opacity-40">🏆</div>
      <p className="text-sm text-zinc-500">{message}</p>
    </div>
  );
}
