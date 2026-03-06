'use client';

import type { LeaderboardRow } from '@/lib/cloudQueries';
import { LeaderboardRowItem } from './LeaderboardRow';

interface Props {
  title: string;
  icon?: string;
  rows: LeaderboardRow[];
  currentUserId?: string;
  emphasis?: 'wins' | 'played' | 'winrate';
}

export function LeaderboardList({ title, icon, rows, currentUserId, emphasis = 'wins' }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-700/30 flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
        <span className="text-[10px] text-zinc-600 ml-auto">{rows.length} Spieler</span>
      </div>
      <div className="divide-y divide-zinc-800/50 p-1">
        {rows.map((row, i) => (
          <LeaderboardRowItem
            key={row.userId}
            row={row}
            rank={i + 1}
            isCurrentUser={!!currentUserId && row.userId === currentUserId}
            emphasis={emphasis}
          />
        ))}
      </div>
    </div>
  );
}
