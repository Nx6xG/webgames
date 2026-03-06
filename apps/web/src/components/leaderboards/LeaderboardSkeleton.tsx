'use client';

export function LeaderboardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 overflow-hidden animate-pulse">
      <div className="px-5 py-3 border-b border-zinc-700/30">
        <div className="h-4 w-32 bg-zinc-700 rounded" />
      </div>
      <div className="p-1 space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-7 h-4 bg-zinc-700/50 rounded" />
            <div className="w-5 h-5 bg-zinc-700/50 rounded-full" />
            <div className="h-4 bg-zinc-700/50 rounded flex-1 max-w-[120px]" />
            <div className="ml-auto flex gap-4">
              <div className="w-8 h-4 bg-zinc-700/50 rounded" />
              <div className="w-8 h-4 bg-zinc-700/50 rounded" />
              <div className="w-10 h-4 bg-zinc-700/50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
