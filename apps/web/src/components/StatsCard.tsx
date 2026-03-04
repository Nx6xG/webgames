import type { GameStats } from 'shared';

interface Props {
  stats: GameStats | null;
  /** Null / undefined = spectator or lobby view → show generic P1/P2 labels */
  playerIndex?: number | null;
}

export function StatsCard({ stats, playerIndex }: Props) {
  const played = stats?.gamesPlayed ?? 0;
  const draws = stats?.draws ?? 0;
  const p0wins = stats?.winsByPlayerIndex[0] ?? 0;
  const p1wins = stats?.winsByPlayerIndex[1] ?? 0;

  const isPlayer = playerIndex === 0 || playerIndex === 1;
  const myWins = isPlayer ? stats?.winsByPlayerIndex[playerIndex!] ?? 0 : null;
  const oppWins = isPlayer ? stats?.winsByPlayerIndex[playerIndex === 0 ? 1 : 0] ?? 0 : null;
  const winRate = isPlayer && played > 0 ? Math.round((myWins! / played) * 100) : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">Platform Stats</p>
      <div className="space-y-2 text-sm">
        <StatRow label="Games played" value={played} />
        {isPlayer ? (
          <>
            <StatRow label="Your wins" value={myWins!} accent />
            <StatRow label="Opponent wins" value={oppWins!} />
          </>
        ) : (
          <>
            <StatRow label="Player 1 wins" value={p0wins} />
            <StatRow label="Player 2 wins" value={p1wins} />
          </>
        )}
        <StatRow label="Draws" value={draws} />
        {winRate !== null && (
          <StatRow label="Win rate" value={`${winRate}%`} accent />
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-zinc-400">{label}</span>
      <span className={accent ? 'font-semibold text-indigo-300' : 'font-semibold text-zinc-200'}>
        {value}
      </span>
    </div>
  );
}
