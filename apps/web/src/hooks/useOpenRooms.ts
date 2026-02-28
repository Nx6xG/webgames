'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, PublicRoomListItem } from 'shared';

type RoomsSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useOpenRooms(wsUrl: string) {
  const [rooms, setRooms] = useState<PublicRoomListItem[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket: RoomsSocket = io(wsUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: Infinity,
    });

    socket.connect();
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('get_open_rooms');
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('open_rooms', ({ rooms }) => setRooms(rooms));

    return () => { socket.disconnect(); };
  }, [wsUrl]);

  return { rooms, connected };
}
