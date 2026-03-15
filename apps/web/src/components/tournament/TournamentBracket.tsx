'use client';
import { useI18n } from '@/components/providers/LanguageProvider';

interface TournamentMatch {
  id: string;
  round: number;
  position: number;
  player1: string | null;
  player2: string | null;
  winner: string | null;
  roomCode: string | null;
  status: 'pending' | 'in_progress' | 'finished';
}

interface TournamentPlayer {
  token: string;
  nickname: string;
  seed: number;
}

interface TournamentState {
  id: string;
  config: { name: string; gameId: string; bracketSize: number; createdBy: string };
  status: 'lobby' | 'in_progress' | 'finished';
  players: TournamentPlayer[];
  matches: TournamentMatch[];
  rounds: number;
  champion: string | null;
}

interface Props {
  tournament: TournamentState;
  playerToken: string;
}

export default function TournamentBracket({ tournament, playerToken }: Props) {
  const { t } = useI18n();
  const { matches, players, rounds } = tournament;

  const roundLabels = Array.from({ length: rounds }, (_, i) => {
    if (i === rounds - 1) return t('tournament.final');
    if (i === rounds - 2) return t('tournament.semiFinal');
    return `${t('tournament.round')} ${i + 1}`;
  });

  const getName = (token: string | null): string => {
    if (!token) return t('tournament.tbd');
    const p = players.find(pl => pl.token === token);
    return p?.nickname || t('tournament.anonymous');
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max">
        {Array.from({ length: rounds }, (_, roundIdx) => {
          const roundMatches = matches
            .filter(m => m.round === roundIdx)
            .sort((a, b) => a.position - b.position);

          return (
            <div key={roundIdx} className="flex flex-col">
              <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3 text-center">
                {roundLabels[roundIdx]}
              </h3>
              <div
                className="flex flex-col justify-around flex-1 gap-4"
              >
                {roundMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    getName={getName}
                    playerToken={playerToken}
                    t={t}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Champion column */}
        <div className="flex flex-col">
          <h3 className="text-xs font-bold text-amber-400 uppercase mb-3 text-center">
            {t('tournament.champion')}
          </h3>
          <div className="flex items-center justify-center flex-1">
            {tournament.champion ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-6 py-4 text-center">
                <div className="text-2xl mb-1">&#x1F3C6;</div>
                <div className="font-bold text-amber-400">{getName(tournament.champion)}</div>
              </div>
            ) : (
              <div className="text-zinc-600 text-sm">{t('tournament.tbd')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match, getName, playerToken, t }: {
  match: TournamentMatch;
  getName: (token: string | null) => string;
  playerToken: string;
  t: (key: string) => string;
}) {
  const isMyMatch = match.player1 === playerToken || match.player2 === playerToken;

  return (
    <div className={`w-56 rounded-lg border ${
      isMyMatch ? 'border-indigo-500/50 bg-indigo-500/5' :
      match.status === 'in_progress' ? 'border-amber-500/30 bg-amber-500/5' :
      'border-zinc-700 bg-zinc-800/50'
    }`}>
      <PlayerRow
        token={match.player1}
        name={getName(match.player1)}
        isWinner={match.winner === match.player1 && match.winner !== null}
        isMe={match.player1 === playerToken}
      />
      <div className="border-t border-zinc-700/50" />
      <PlayerRow
        token={match.player2}
        name={getName(match.player2)}
        isWinner={match.winner === match.player2 && match.winner !== null}
        isMe={match.player2 === playerToken}
      />
      {match.status === 'in_progress' && match.roomCode && (
        <div className="border-t border-zinc-700/50 px-3 py-1.5 text-center">
          <span className="text-xs text-amber-400 animate-pulse">{t('tournament.live')}</span>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ token, name, isWinner, isMe }: {
  token: string | null;
  name: string;
  isWinner: boolean;
  isMe: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-sm ${
      isWinner ? 'bg-emerald-500/10' : ''
    }`}>
      <span className={`truncate flex-1 ${
        !token ? 'text-zinc-600 italic' :
        isWinner ? 'text-emerald-400 font-bold' :
        isMe ? 'text-indigo-400 font-medium' :
        'text-zinc-300'
      }`}>
        {name}
      </span>
      {isWinner && <span className="text-emerald-400 text-xs">&#x2713;</span>}
    </div>
  );
}
