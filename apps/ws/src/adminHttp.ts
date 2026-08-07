import type { IncomingMessage, ServerResponse } from 'node:http';
import type { GameServer } from './serverTypes.js';
import { roomManager } from './rooms.js';
import { broadcastOpenRooms } from './openRooms.js';

const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET ?? '';
const MAX_BODY_BYTES = 64 * 1024;

function verifyAdminSecret(req: IncomingMessage): boolean {
  const auth = req.headers.authorization;
  return !!ADMIN_API_SECRET && auth === `Bearer ${ADMIN_API_SECRET}`;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      if (body.length < MAX_BODY_BYTES) body += chunk.toString();
    });
    req.on('end', () => resolve(body));
  });
}

function jsonResponse(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * HTTP request handler for the admin API + health check.
 * `getIo` is lazy because the Socket.IO server is created after the HTTP server.
 */
export function createHttpHandler(getIo: () => GameServer) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';

    // ── Admin: list all rooms ──
    if (url === '/admin/rooms' && req.method === 'GET') {
      if (!verifyAdminSecret(req)) return jsonResponse(res, 401, { error: 'Unauthorized' });
      const rooms = roomManager.getAllRooms().map((r) => ({
        code: r.code,
        gameId: r.gameId,
        visibility: r.visibility,
        roomName: r.roomName,
        players: r.players.map((p) => ({ index: p.index, nickname: p.nickname, playerToken: p.playerToken })),
        spectators: r.spectators.size,
        createdAt: r.createdAt,
        hasState: r.state !== null,
      }));
      return jsonResponse(res, 200, { rooms });
    }

    // ── Admin: force-close a room ──
    if (url === '/admin/rooms/close' && req.method === 'POST') {
      if (!verifyAdminSecret(req)) return jsonResponse(res, 401, { error: 'Unauthorized' });
      const body = await readBody(req);
      let roomCode: string;
      try {
        roomCode = JSON.parse(body).roomCode;
      } catch {
        return jsonResponse(res, 400, { error: 'Invalid JSON' });
      }
      if (!roomCode) return jsonResponse(res, 400, { error: 'Missing roomCode' });

      const io = getIo();
      // Kick all sockets from the Socket.IO room before deleting
      const room = roomManager.getRoom(roomCode);
      if (room) {
        io.in(roomCode).socketsLeave(roomCode);
        io.to(roomCode).emit('room_error', { code: 'ROOM_CLOSED', message: 'Room closed by admin' });
      }

      const deleted = roomManager.forceCloseRoom(roomCode);
      if (!deleted) return jsonResponse(res, 404, { error: 'Room not found' });

      broadcastOpenRooms(io);
      return jsonResponse(res, 200, { ok: true });
    }

    // ── Default health check ──
    res.writeHead(200);
    res.end('ok');
  };
}
