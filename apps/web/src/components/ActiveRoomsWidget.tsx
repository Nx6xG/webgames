'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { io, type Socket } from 'socket.io-client';
import { getWsUrl } from '@/lib/getWsUrl';
import { useI18n } from '@/components/providers/LanguageProvider';
import { GAME_EMOJI } from '@/lib/localStats';
import type { ServerToClientEvents, ClientToServerEvents, PublicRoomListItem } from 'shared';

type RoomsSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const MAX_DISPLAY = 4;

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}

/** Maps gameId → lobby title i18n key. */
const TITLE_KEYS: Record<string, string> = {
  tictactoe: 'lobby.games.tictactoe.title',
  connect4: 'lobby.games.connect4.title',
  rps: 'lobby.games.rps.title',
  chess: 'lobby.games.chess.title',
  battleship: 'lobby.games.battleship.title',
  liarsbar: 'lobby.games.liarsbar.title',
};

export function ActiveRoomsWidget() {
  const { t } = useI18n();
  const [rooms, setRooms] = useState<PublicRoomListItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const socket: RoomsSocket = io(getWsUrl(), {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: Infinity,
    });

    socket.connect();
    socket.on('connect', () => {
      socket.emit('get_open_rooms');
    });
    socket.on('open_rooms', ({ rooms: r }) => {
      setRooms(r);
      setLoaded(true);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Only show joinable rooms (1/maxPlayers)
  const joinable = rooms.filter((r) => r.playerCount > 0 && r.playerCount < r.maxPlayers);

  if (!loaded || joinable.length === 0) return null;

  const displayed = joinable.slice(0, MAX_DISPLAY);

  return (
    <section className="max-w-5xl mx-auto px-6 pb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {t('activeRooms.title')}
          </h2>
        </div>
        <Link href="/rooms" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          {t('activeRooms.viewAll')}
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {displayed.map((room) => (
          <Link
            key={room.code}
            href={`/games/${room.gameId}?room=${room.code}`}
            className="flex items-center gap-3 p-3 rounded-xl border border-[var(--cardBorder)] bg-[var(--card)] hover:border-emerald-700/50 hover:bg-zinc-800/50 transition-all group"
          >
            <span className="text-xl select-none">{GAME_EMOJI[room.gameId] ?? '⊞'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-200 truncate">
                {room.roomName || t(TITLE_KEYS[room.gameId] ?? room.gameId)}
              </p>
              <p className="text-[10px] text-zinc-500 truncate">
                {room.hostNickname} · {timeAgo(room.createdAt)}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-xs tabular-nums text-zinc-400">
                {room.playerCount}/{room.maxPlayers}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 font-medium">
                {t('activeRooms.join')}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
