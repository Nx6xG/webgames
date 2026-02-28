import type { Match } from 'shared';

const GAME_LABELS: Record<string, string> = {
  tictactoe: 'Tic-Tac-Toe',
  connect4: 'Connect Four',
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

interface Props {
  history: Match[];
  myNickname: string;
}

export function MatchHistoryCard({ history, myNickname }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">Recent Matches</p>
      <div className="space-y-2">
        {history.map((m, i) => {
          const isP1 = m.p1 === myNickname;
          const opponent = isP1 ? m.p2 : m.p1;
          const outcome: 'win' | 'loss' | 'draw' =
            m.result === 'draw' ? 'draw' :
            (m.result === 'p1') === isP1 ? 'win' : 'loss';
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`shrink-0 w-6 text-center py-0.5 rounded font-bold text-[10px] ${
                outcome === 'win'  ? 'bg-emerald-900/60 text-emerald-400' :
                outcome === 'loss' ? 'bg-rose-900/60 text-rose-400' :
                                     'bg-zinc-800 text-zinc-400'
              }`}>
                {outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'D'}
              </span>
              <span className="flex-1 text-zinc-300 truncate">{opponent}</span>
              <span className="shrink-0 text-zinc-600">{GAME_LABELS[m.gameId] ?? m.gameId}</span>
              <span className="shrink-0 text-zinc-600">{timeAgo(m.ts)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
