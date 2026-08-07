import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from 'shared';

/** Typed Socket.IO server instance shared across all handler modules. */
export type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Typed per-connection socket. */
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
