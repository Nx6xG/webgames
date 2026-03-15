'use client';
import { useI18n } from '@/components/providers/LanguageProvider';

interface TournamentState {
  id: string;
  config: { name: string; gameId: string; bracketSize: number; createdBy: string };
  status: string;
  players: { token: string; nickname: string; seed: number }[];
  rounds: number;
  createdAt: number;
}

interface Props {
  tournament: TournamentState;
  isCreator: boolean;
  playerToken: string;
  onStart: () => void;
  onLeave: () => void;
  error: string | null;
}

export default function TournamentLobby({ tournament, isCreator, playerToken, onStart, onLeave, error }: Props) {
  const { t } = useI18n();
  const ct = tournament;
  const slots = Array.from({ length: ct.config.bracketSize }, (_, i) => ct.players[i] ?? null);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center p-4">
      <div className="bg-[var(--card)] border border-zinc-700 rounded-xl p-6 max-w-lg w-full">
        <h1 className="text-2xl font-bold mb-1">{ct.config.name}</h1>
        <p className="text-sm text-zinc-400 mb-6">
          {ct.config.gameId.toUpperCase()} — {t('tournament.bracketSize')}: {ct.config.bracketSize}
        </p>

        <div className="space-y-2 mb-6">
          <h2 className="text-sm font-bold text-zinc-400 uppercase">{t('tournament.players')} ({ct.players.length}/{ct.config.bracketSize})</h2>
          {slots.map((player, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                player ? 'bg-zinc-800' : 'bg-zinc-800/40 border border-dashed border-zinc-700'
              }`}
            >
              <span className="text-xs text-zinc-500 w-5">{i + 1}</span>
              {player ? (
                <>
                  <span className={`font-medium ${player.token === playerToken ? 'text-indigo-400' : ''}`}>
                    {player.nickname || t('tournament.anonymous')}
                  </span>
                  {player.token === ct.config.createdBy && (
                    <span className="text-xs bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">
                      {t('tournament.host')}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-zinc-600 italic">{t('tournament.emptySlot')}</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          {isCreator && (
            <button
              onClick={onStart}
              disabled={ct.players.length < 2}
              className="flex-1 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 font-bold"
            >
              {t('tournament.startTournament')}
            </button>
          )}
          <button
            onClick={onLeave}
            className="flex-1 py-3 rounded-lg bg-zinc-700 hover:bg-zinc-600"
          >
            {t('tournament.leave')}
          </button>
        </div>

        {error && (
          <div className="mt-3 text-sm text-rose-400 text-center">{error}</div>
        )}
      </div>
    </div>
  );
}
