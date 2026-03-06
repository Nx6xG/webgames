'use client';

export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] animate-pulse">
      {/* Banner */}
      <div className="h-32 sm:h-44 bg-zinc-800" />

      <div className="max-w-4xl mx-auto px-4">
        {/* Hero card skeleton */}
        <div className="-mt-12 rounded-xl border border-zinc-700/50 bg-zinc-800/30 px-6 pb-5 pt-0">
          <div className="-mt-10 mb-3">
            <div className="w-10 h-10 rounded-full bg-zinc-700 ring-4 ring-zinc-900" />
          </div>
          <div className="h-6 w-40 bg-zinc-700 rounded mb-2" />
          <div className="h-4 w-60 bg-zinc-700/50 rounded" />
        </div>

        {/* Content skeleton */}
        <div className="py-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
                <div className="h-3 w-16 bg-zinc-700/50 rounded mb-2" />
                <div className="h-7 w-12 bg-zinc-700 rounded" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-5">
            <div className="h-6 w-32 bg-zinc-700 rounded mb-3" />
            <div className="h-2 w-full bg-zinc-700/50 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
