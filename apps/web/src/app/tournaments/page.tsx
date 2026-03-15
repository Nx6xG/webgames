'use client';
import { useState } from 'react';
import { useTournament } from '@/hooks/useTournament';
import { useI18n } from '@/components/providers/LanguageProvider';
import Link from 'next/link';
import TournamentBracket from '@/components/tournament/TournamentBracket';
import TournamentLobby from '@/components/tournament/TournamentLobby';

const GAMES = [
  { id: 'tictactoe', label: 'Tic-Tac-Toe' },
  { id: 'connect4', label: 'Connect 4' },
  { id: 'rps', label: 'Rock Paper Scissors' },
  { id: 'chess', label: 'Chess' },
  { id: 'battleship', label: 'Battleship' },
] as const;

const BRACKET_SIZES = [4, 8, 16] as const;

export default function TournamentsPage() {
  const { t } = useI18n();
  const tm = useTournament();
  const [view, setView] = useState<'list' | 'create'>('list');
  const [createName, setCreateName] = useState('');
  const [createGame, setCreateGame] = useState('tictactoe');
  const [createSize, setCreateSize] = useState<number>(8);

  const handleCreate = () => {
    if (!createName.trim()) return;
    tm.create(createGame, createSize, createName.trim());
    setView('list');
    setCreateName('');
  };

  // If we're viewing a specific tournament
  if (tm.currentTournament) {
    const ct = tm.currentTournament;
    const isCreator = ct.config.createdBy === tm.playerToken;

    if (ct.status === 'lobby') {
      return (
        <TournamentLobby
          tournament={ct}
          isCreator={isCreator}
          playerToken={tm.playerToken}
          onStart={() => tm.start(ct.id)}
          onLeave={() => tm.leave(ct.id)}
          error={tm.error}
        />
      );
    }

    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{ct.config.name}</h1>
              <p className="text-sm text-zinc-400">
                {ct.config.gameId.toUpperCase()} — {ct.config.bracketSize} {t('tournament.players')}
                {ct.status === 'finished' && ct.champion && (
                  <span className="ml-2 text-amber-400">
                    {t('tournament.champion')}: {ct.players.find(p => p.token === ct.champion)?.nickname ?? '?'}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => { tm.leave(ct.id); }}
              className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm"
            >
              {t('tournament.back')}
            </button>
          </div>

          <TournamentBracket tournament={ct} playerToken={tm.playerToken} />

          {tm.matchReady && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 max-w-sm w-full mx-4 text-center">
                <h2 className="text-xl font-bold mb-2">{t('tournament.matchReady')}</h2>
                <p className="text-zinc-400 mb-4">
                  {t('tournament.vs')} {tm.matchReady.opponent.nickname}
                </p>
                <div className="flex gap-3 justify-center">
                  <Link
                    href={`/games/${ct.config.gameId}?room=${tm.matchReady.roomCode}`}
                    onClick={() => tm.dismissMatch()}
                    className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold"
                  >
                    {t('tournament.joinMatch')}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tournament list view
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t('tournament.title')}</h1>
          <div className="flex gap-3">
            <Link href="/" className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm">
              {t('tournament.home')}
            </Link>
            <button
              onClick={() => setView(view === 'list' ? 'create' : 'list')}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold"
            >
              {view === 'list' ? t('tournament.create') : t('tournament.cancel')}
            </button>
          </div>
        </div>

        {!tm.connected && (
          <div className="text-center text-zinc-500 py-8">{t('status.connecting')}</div>
        )}

        {view === 'create' && (
          <div className="bg-[var(--card)] border border-zinc-700 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">{t('tournament.createNew')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">{t('tournament.name')}</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t('tournament.namePlaceholder')}
                  maxLength={32}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-[var(--fg)] outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">{t('tournament.game')}</label>
                <div className="flex flex-wrap gap-2">
                  {GAMES.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setCreateGame(g.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm ${
                        createGame === g.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">{t('tournament.bracketSize')}</label>
                <div className="flex gap-2">
                  {BRACKET_SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => setCreateSize(s)}
                      className={`px-4 py-1.5 rounded-lg text-sm ${
                        createSize === s
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {s} {t('tournament.players')}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={!createName.trim()}
                className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 font-bold"
              >
                {t('tournament.createTournament')}
              </button>
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="space-y-3">
            {tm.tournaments.length === 0 && tm.connected && (
              <div className="text-center text-zinc-500 py-12">
                {t('tournament.noTournaments')}
              </div>
            )}
            {tm.tournaments.map(tour => (
              <div
                key={tour.id}
                className="bg-[var(--card)] border border-zinc-700 rounded-xl p-4 flex items-center justify-between hover:border-zinc-600 transition-colors"
              >
                <div>
                  <h3 className="font-bold">{tour.name}</h3>
                  <p className="text-sm text-zinc-400">
                    {tour.gameId.toUpperCase()} — {tour.playerCount}/{tour.bracketSize} {t('tournament.players')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    tour.status === 'lobby' ? 'bg-emerald-500/15 text-emerald-400' :
                    tour.status === 'in_progress' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-zinc-500/15 text-zinc-400'
                  }`}>
                    {t(`tournament.status.${tour.status}`)}
                  </span>
                  {tour.status === 'lobby' ? (
                    <button
                      onClick={() => tm.join(tour.id)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold"
                    >
                      {t('tournament.join')}
                    </button>
                  ) : (
                    <button
                      onClick={() => tm.getTournament(tour.id)}
                      className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm"
                    >
                      {t('tournament.watch')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tm.error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-rose-600/90 text-white px-4 py-2 rounded-lg text-sm">
            {tm.error}
          </div>
        )}
      </div>
    </div>
  );
}
