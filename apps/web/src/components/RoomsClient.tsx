'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useOpenRooms } from '@/hooks/useOpenRooms';
import type { PublicRoomListItem } from 'shared';
import { useI18n } from '@/components/providers/LanguageProvider';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { getNameColorClass } from '@/lib/nameColors';

/** Internal game IDs → i18n title keys (reuses lobby.games.*.title) */
const GAME_TITLE_KEYS: Record<string, string> = {
  tictactoe:  'lobby.games.tictactoe.title',
  connect4:   'lobby.games.connect4.title',
  rps:        'lobby.games.rps.title',
  chess:      'lobby.games.chess.title',
  battleship: 'lobby.games.battleship.title',
  liarsbar:   'lobby.games.liarsbar.title',
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

function StatusBadge({ playerCount, maxPlayers }: { playerCount: number; maxPlayers: number }) {
  const { t } = useI18n();

  if (playerCount >= maxPlayers) {
    return (
      <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-md bg-zinc-700/80 text-zinc-400 border border-zinc-600/50">
        {t('rooms.status.full')}
      </span>
    );
  }
  if (playerCount === 0) {
    return (
      <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-md bg-amber-900/40 text-amber-400 border border-amber-800/40">
        {t('rooms.status.empty')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-md bg-emerald-900/40 text-emerald-400 border border-emerald-800/40">
      {t('rooms.status.joinable')}
    </span>
  );
}

function RoomRow({ room }: { room: PublicRoomListItem }) {
  const { t } = useI18n();
  const isFull  = room.playerCount >= room.maxPlayers;
  const isEmpty = room.playerCount === 0;
  const gameLabel = t(GAME_TITLE_KEYS[room.gameId] ?? room.gameId);
  // Friendly default name when creator didn't set one
  const displayName = room.roomName ?? `${gameLabel} – ${room.code}`;

  return (
    <tr className="border-t border-zinc-800 hover:bg-zinc-800/40 transition-colors">
      <td className="px-4 py-3 text-sm text-zinc-300">{gameLabel}</td>
      <td className="px-4 py-3 text-sm text-zinc-200 truncate max-w-[160px]">{displayName}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <AvatarBubble avatarId={room.hostAvatarId} avatarFrame={room.hostAvatarFrame} nickname={room.hostNickname} size="sm" cosmetics={room.hostCosmetics} />
          <span className={`text-sm font-mono truncate max-w-[100px] ${getNameColorClass(room.hostCosmetics?.nameColor ?? room.hostNameColor) || 'text-zinc-400'}`}>{room.hostNickname}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge playerCount={room.playerCount} maxPlayers={room.maxPlayers} />
          <span className="text-xs text-zinc-500">
            {room.playerCount}/{room.maxPlayers} · {timeAgo(room.createdAt)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {isEmpty ? (
          <span className="text-xs text-zinc-600">—</span>
        ) : (
          <Link
            href={`/games/${room.gameId}?room=${room.code}`}
            className={`px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-colors ${
              isFull
                ? 'bg-zinc-700 hover:bg-zinc-600'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {isFull ? t('rooms.actions.watch') : t('rooms.actions.join')}
          </Link>
        )}
      </td>
    </tr>
  );
}

const GAME_FILTER_OPTIONS = ['all', 'tictactoe', 'connect4', 'rps', 'chess', 'battleship', 'liarsbar'] as const;

export function RoomsClient({ wsUrl, initialGameFilter }: { wsUrl: string; initialGameFilter?: string }) {
  const { rooms, connected } = useOpenRooms(wsUrl);
  const { t } = useI18n();
  const [gameFilter, setGameFilter] = useState<string>(initialGameFilter ?? 'all');

  const filtered = useMemo(
    () => gameFilter === 'all' ? rooms : rooms.filter((r) => r.gameId === gameFilter),
    [rooms, gameFilter],
  );

  const joinableCount = filtered.filter((r) => r.playerCount > 0 && r.playerCount < r.maxPlayers).length;

  const roomCountLabel = filtered.length === 0
    ? t('rooms.noRooms')
    : `${filtered.length} ${t('rooms.publicRoomsLabel')}${joinableCount > 0 ? ` · ${joinableCount} ${t('rooms.joinableLabel')}` : ''}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('nav.games')}
          </Link>
          <span className="text-zinc-700">/</span>
          <h1 className="font-bold text-zinc-100">{t('rooms.title')}</h1>
          <nav className="ml-auto">
            <Link href="/leaderboard" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              {t('nav.leaderboard')}
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-black tracking-tight mb-2">{t('rooms.title')}</h2>
          <p className="text-zinc-400 text-sm">{t('rooms.subtitle')}</p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Filter chips + status */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg flex-wrap">
              {GAME_FILTER_OPTIONS.map((gf) => (
                <button
                  key={gf}
                  onClick={() => setGameFilter(gf)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                    gameFilter === gf ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {gf === 'all' ? 'All' : t(GAME_TITLE_KEYS[gf] ?? gf)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-zinc-500">{roomCountLabel}</p>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                {connected ? t('common.live') : t('status.connecting')}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center py-20 gap-3 text-center">
              <span className="text-4xl text-zinc-700">⊞</span>
              <p className="text-zinc-500 text-sm">{t('rooms.emptyTitle')}</p>
              <p className="text-zinc-600 text-xs">{t('rooms.emptyHint')}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-900">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('rooms.col.game')}</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('rooms.col.room')}</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('rooms.col.host')}</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('rooms.col.status')}</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((room) => (
                    <RoomRow key={room.code} room={room} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
