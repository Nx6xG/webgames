'use client';

import Link from 'next/link';
import type { LeaderboardRow as RowData } from '@/lib/cloudQueries';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { getNameColorClass } from '@/lib/nameColors';

interface Props {
  row: RowData;
  rank: number;
  isCurrentUser?: boolean;
  /** Column emphasis: 'wins' | 'played' | 'winrate' */
  emphasis?: 'wins' | 'played' | 'winrate';
}

const RANK_COLORS: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-zinc-300',
  3: 'text-amber-600',
};

export function LeaderboardRowItem({ row, rank, isCurrentUser, emphasis = 'wins' }: Props) {
  const nameColorClass = getNameColorClass(row.cosmetics?.nameColor) || 'text-zinc-200';
  const profileHref = `/profile/${row.userId}`;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
        isCurrentUser ? 'bg-indigo-950/30 ring-1 ring-indigo-500/30' : 'hover:bg-zinc-800/40'
      }`}
    >
      {/* Rank */}
      <span className={`w-7 text-sm font-bold tabular-nums text-right shrink-0 ${RANK_COLORS[rank] ?? 'text-zinc-500'}`}>
        {rank}
      </span>

      {/* Avatar + Name — clickable link to profile */}
      <Link
        href={profileHref}
        className="flex items-center gap-2 min-w-0 flex-1 group"
      >
        <AvatarBubble
          size="sm"
          cosmetics={row.cosmetics ?? undefined}
          avatarId={row.cosmetics?.avatarId}
          avatarFrame={row.cosmetics?.slots?.frame}
          nickname={row.nickname}
        />
        <span className={`text-sm font-medium truncate group-hover:underline underline-offset-2 ${nameColorClass}`}>
          {row.nickname}
          {isCurrentUser && <span className="ml-1.5 text-[10px] text-indigo-400 font-normal no-underline">(du)</span>}
        </span>
      </Link>

      {/* Stats */}
      <div className="flex items-center gap-4 shrink-0 text-xs tabular-nums">
        <span className={emphasis === 'wins' ? 'text-zinc-100 font-semibold' : 'text-zinc-400'}>
          {row.wins} <span className="text-zinc-600 hidden sm:inline">S</span>
        </span>
        <span className={emphasis === 'played' ? 'text-zinc-100 font-semibold' : 'text-zinc-500'}>
          {row.played} <span className="text-zinc-600 hidden sm:inline">G</span>
        </span>
        <span className={`w-10 text-right ${emphasis === 'winrate' ? 'text-zinc-100 font-semibold' : 'text-zinc-500'}`}>
          {row.winrate}%
        </span>
      </div>
    </div>
  );
}
