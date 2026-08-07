import { randomUUID } from 'node:crypto';
import type { GameId, InvitePayload } from 'shared';
import type { GameServer, GameSocket } from './serverTypes.js';
import { roomManager } from './rooms.js';
import { engineRegistry } from './engineRegistry.js';
import { identifiedTokens, nicknameMap, profiles } from './chatState.js';
import { presence } from './presence.js';
import { quickPlayQueue, broadcastOpenRooms } from './openRooms.js';

/** playerToken → timestamp of last invite sent (ms) */
const inviteRateLimit = new Map<string, number>();

export function registerInviteHandlers(io: GameServer, socket: GameSocket) {
  // ── invite_create ─────────────────────────────────────────────────────────
  socket.on('invite_create', ({ toToken, gameId }) => {
    const fromToken = identifiedTokens.get(socket.id);
    if (!fromToken) {
      socket.emit('invite_error', { message: 'Nicht identifiziert.' });
      return;
    }

    // Rate limit: 2 s between invites per sender
    const lastAt = inviteRateLimit.get(fromToken) ?? 0;
    if (Date.now() - lastAt < 2_000) {
      socket.emit('invite_error', { message: 'Warte kurz bevor du erneut einlädst.' });
      return;
    }
    inviteRateLimit.set(fromToken, Date.now());

    if (toToken === fromToken) {
      socket.emit('invite_error', { message: 'Du kannst dich nicht selbst einladen.' });
      return;
    }

    const receiverEntry = presence.get(toToken);
    if (!receiverEntry || receiverEntry.sockets.size === 0) {
      socket.emit('invite_error', { message: 'Nutzer ist nicht mehr online.' });
      return;
    }

    if (!(gameId in engineRegistry)) {
      socket.emit('invite_error', { message: 'Ungültiges Spiel.' });
      return;
    }
    const validGameId = gameId as GameId;

    const fromName = nicknameMap.get(socket.id) ?? profiles.get(fromToken)?.nickname ?? 'Unknown';

    // Leave any current room so the sender can become player 0 in the invite room
    const existing = roomManager.getRoomBySocket(socket.id);
    if (existing) {
      const leaveResult = roomManager.removeSocket(socket.id);
      socket.leave(existing.code);
      if (leaveResult?.type === 'player') {
        io.to(existing.code).emit('player_left', {
          playerId: socket.id,
          playerIndex: leaveResult.player.index,
          playerCount: existing.players.length,
        });
        if (existing.players.length === 0) {
          for (const [gid, entry] of quickPlayQueue) {
            if (entry.roomCode === existing.code) { quickPlayQueue.delete(gid); break; }
          }
        }
      }
      if (existing.visibility === 'public') broadcastOpenRooms(io);
    }

    // Create a private room with sender as player 0 (no room_created emitted — sender navigates manually)
    const room = roomManager.createRoom(socket.id, fromToken, validGameId, fromName, 'private');
    socket.join(room.code);
    socket.emit('chat_history', { scope: 'room', messages: [] });

    const invite: InvitePayload = {
      id: randomUUID(),
      fromToken,
      fromName,
      toToken,
      gameId: validGameId,
      roomCode: room.code,
      createdAt: Date.now(),
    };

    // Deliver to all receiver sockets (multi-tab support)
    for (const sid of receiverEntry.sockets) {
      io.to(sid).emit('invite_received', invite);
    }
    socket.emit('invite_sent', { id: invite.id, roomCode: room.code, gameId: validGameId });
    console.log(`[invite] ${fromName} → ${receiverEntry.nickname} (${validGameId}, room ${room.code})`);
  });

  // ── room_invite (invite into existing room — host only) ──────────────────
  socket.on('room_invite', ({ toToken, roomCode }) => {
    const fromToken = identifiedTokens.get(socket.id);
    if (!fromToken) {
      socket.emit('invite_error', { message: 'Nicht identifiziert.' });
      return;
    }

    // Rate limit: share the same 2 s cooldown as invite_create
    const lastAt = inviteRateLimit.get(fromToken) ?? 0;
    if (Date.now() - lastAt < 2_000) {
      socket.emit('invite_error', { message: 'Warte kurz bevor du erneut einlädst.' });
      return;
    }
    inviteRateLimit.set(fromToken, Date.now());

    if (toToken === fromToken) {
      socket.emit('invite_error', { message: 'Du kannst dich nicht selbst einladen.' });
      return;
    }

    const room = roomManager.getRoom(roomCode);
    if (!room) {
      socket.emit('invite_error', { message: 'Raum nicht gefunden.' });
      return;
    }

    // Only the host (player 0) can send room invites
    if (!room.players[0] || room.players[0].playerToken !== fromToken) {
      socket.emit('invite_error', { message: 'Nur der Host kann einladen.' });
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit('invite_error', { message: 'Raum ist voll.' });
      return;
    }

    const receiverEntry = presence.get(toToken);
    if (!receiverEntry || receiverEntry.sockets.size === 0) {
      socket.emit('invite_error', { message: 'Nutzer ist nicht mehr online.' });
      return;
    }

    const fromName = nicknameMap.get(socket.id) ?? profiles.get(fromToken)?.nickname ?? 'Unknown';

    const invite: InvitePayload = {
      id: randomUUID(),
      fromToken,
      fromName,
      toToken,
      gameId: room.gameId,
      roomCode: room.code,
      createdAt: Date.now(),
    };

    // Deliver to all receiver sockets (multi-tab support)
    for (const sid of receiverEntry.sockets) {
      io.to(sid).emit('invite_received', invite);
    }
    socket.emit('invite_sent', { id: invite.id, roomCode: room.code, gameId: room.gameId });
    console.log(`[room_invite] ${fromName} → ${receiverEntry.nickname} (${room.gameId}, room ${room.code})`);
  });

  // ── invite_decline (optional ack) ────────────────────────────────────────
  socket.on('invite_decline', () => {
    // No server-side action required; included for protocol completeness.
  });

  // ── invite_accept ─────────────────────────────────────────────────────────
  socket.on('invite_accept', ({ id, fromToken, gameId, roomCode }) => {
    const byName = nicknameMap.get(socket.id) ?? profiles.get(identifiedTokens.get(socket.id) ?? '')?.nickname ?? 'Someone';
    const senderEntry = presence.get(fromToken);
    if (!senderEntry || senderEntry.sockets.size === 0) return; // sender went offline
    for (const sid of senderEntry.sockets) {
      io.to(sid).emit('invite_accepted', { id, gameId, roomCode, byName });
    }
    console.log(`[invite] ${byName} accepted → ${senderEntry.nickname} (${gameId}, room ${roomCode})`);
  });
}
