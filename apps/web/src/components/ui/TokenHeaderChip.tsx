'use client';

import Link from 'next/link';
import { useProgression } from '@/components/providers/ProgressionProvider';
import { TokenIcon } from '@/components/ui/TokenIcon';

export function TokenHeaderChip() {
  const { progression, isHydrated } = useProgression();

  return (
    <Link
      href="/shop"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-500/10 border border-zinc-500/15 hover:border-zinc-400/30 hover:bg-zinc-500/15 transition-all group"
    >
      <span className="leading-none group-hover:scale-110 transition-transform">
        <TokenIcon size="sm" />
      </span>
      <span className="text-xs font-bold text-zinc-300 tabular-nums">
        {isHydrated ? progression.tokens : 0}
      </span>
    </Link>
  );
}
