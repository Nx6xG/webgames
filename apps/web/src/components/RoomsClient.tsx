'use client';

import Link from 'next/link';
import { useOpenRooms } from '@/hooks/useOpenRooms';
import type { PublicRoomListItem } from 'shared';

const GAME_LABELS: Record<string, string> = {
  tictactoe: 'Tic-Tac-Toe',
  connect4: 'Connect Four',
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

function StatusBadge({ playerCount, maxPlayers }: { playerCount: number; maxPlayers: number }) {
  if (playerCount >= maxPlayers) {
    return (
      <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-md bg-zinc-700/80 text-zinc-400 border border-zinc-600/50">
        Full
      </span>
    );
  }
  if (playerCount === 0) {
    return (
      <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-md bg-amber-900/40 text-amber-400 border border-amber-800/40">
        Empty
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-md bg-emerald-900/40 text-emerald-400 border border-emerald-800/40">
      Joinable
    </span>
  );
}

function RoomRow({ room }: { room: PublicRoomListItem }) {
  const isFull = room.playerCount >= room.maxPlayers;
  const isEmpty = room.playerCount === 0;
  // Friendly default name when creator didn't set one
  const displayName = room.roomName ?? `${GAME_LABELS[room.gameId] ?? room.gameId} – ${room.code}`;

  return (
    <tr className="border-t border-zinc-800 hover:bg-zinc-800/40 transition-colors">
      <td className="px-4 py-3 text-sm text-zinc-300">{GAME_LABELS[room.gameId] ?? room.gameId}</td>
      <td className="px-4 py-3 text-sm text-zinc-200 truncate max-w-[160px]">{displayName}</td>
      <td className="px-4 py-3 text-sm text-zinc-400 font-mono truncate max-w-[120px]">{room.hostNickname}</td>
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
            {isFull ? 'Watch' : 'Join'}
          </Link>
        )}
      </td>
    </tr>
  );
}

export function RoomsClient({ wsUrl }: { wsUrl: string }) {
  const { rooms, connected } = useOpenRooms(wsUrl);

  const joinableCount = rooms.filter((r) => r.playerCount > 0 && r.playerCount < r.maxPlayers).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {rooms.length === 0
            ? 'No public rooms right now.'
            : `${rooms.length} public room${rooms.length !== 1 ? 's' : ''}${joinableCount > 0 ? ` · ${joinableCount} joinable` : ''}`}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
          {connected ? 'Live' : 'Connecting…'}
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center py-20 gap-3 text-center">
          <span className="text-4xl text-zinc-700">⊞</span>
          <p className="text-zinc-500 text-sm">No public rooms yet.</p>
          <p className="text-zinc-600 text-xs">
            Create a <span className="text-indigo-400">Public</span> room in any game, or use{' '}
            <span className="text-indigo-400">Quick Play</span> to join the matchmaking queue.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-900">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Game</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Room</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Host</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <RoomRow key={room.code} room={room} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
