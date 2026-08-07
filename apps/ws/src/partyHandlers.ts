import type { GameId } from 'shared';
import type { GameServer, GameSocket } from './serverTypes.js';
import type { PartyManager } from './parties.js';
import { roomManager } from './rooms.js';
import { getGameCapacity } from './gameCapacity.js';
import { identifiedTokens, profiles } from './chatState.js';
import { presence, broadcastPresence, socketActivity } from './presence.js';
import { buildCosmetics } from './cosmetics.js';
import { roomPlayers } from './emit.js';
import { addPresence } from './roomPresence.js';

/** Resolve nickname/cosmetics from presence for the party member list. */
export function resolvePartyMember(token: string) {
  const p = presence.get(token);
  if (!p) return undefined;
  return {
    nickname: p.nickname,
    avatarId: p.avatarId,
    cosmetics: buildCosmetics(p),
  };
}

export function registerPartyHandlers(io: GameServer, socket: GameSocket, partyManager: PartyManager) {
  /** Broadcast party_updated to all member sockets. */
  function broadcastParty(party: ReturnType<typeof partyManager.getById>) {
    if (!party) return;
    const state = partyManager.toState(party, resolvePartyMember);
    for (const memberToken of party.members) {
      const entry = presence.get(memberToken);
      if (!entry) continue;
      for (const sid of entry.sockets) {
        io.to(sid).emit('party_updated', { party: state });
      }
    }
  }

  socket.on('party_create', () => {
    const token = identifiedTokens.get(socket.id);
    if (!token) return;
    const party = partyManager.create(token);
    if (!party) {
      socket.emit('party_error', { code: 'ALREADY_IN_PARTY', message: 'You are already in a party.' });
      return;
    }
    broadcastParty(party);
    console.log(`[party] ${presence.get(token)?.nickname} created party ${party.id}`);
  });

  socket.on('party_invite', ({ toToken }) => {
    const token = identifiedTokens.get(socket.id);
    if (!token) return;
    const party = partyManager.getByToken(token);
    if (!party) {
      socket.emit('party_error', { code: 'NOT_IN_PARTY', message: 'You are not in a party.' });
      return;
    }
    if (party.hostToken !== token) {
      socket.emit('party_error', { code: 'NOT_HOST', message: 'Only the host can invite.' });
      return;
    }
    if (party.members.length >= 6) {
      socket.emit('party_error', { code: 'PARTY_FULL', message: 'Party is full (max 6).' });
      return;
    }
    // Send invite to all receiver sockets
    const receiverEntry = presence.get(toToken);
    if (!receiverEntry || receiverEntry.sockets.size === 0) return;
    const payload = {
      partyId: party.id,
      fromToken: token,
      fromName: presence.get(token)?.nickname ?? 'Someone',
      createdAt: Date.now(),
    };
    for (const sid of receiverEntry.sockets) {
      io.to(sid).emit('party_invite_received', payload);
    }
    console.log(`[party] invite sent to ${receiverEntry.nickname} for party ${party.id}`);
  });

  socket.on('party_join', ({ partyId }) => {
    const token = identifiedTokens.get(socket.id);
    if (!token) return;
    // Leave current party if in one
    const existing = partyManager.getByToken(token);
    if (existing && existing.id !== partyId) {
      partyManager.leave(token);
    }
    const party = partyManager.join(partyId, token);
    if (!party) {
      socket.emit('party_error', { code: 'PARTY_NOT_FOUND', message: 'Party not found or full.' });
      return;
    }
    broadcastParty(party);
    console.log(`[party] ${presence.get(token)?.nickname} joined party ${party.id}`);
  });

  socket.on('party_leave', () => {
    const token = identifiedTokens.get(socket.id);
    if (!token) return;
    const { party, disbanded } = partyManager.leave(token);
    if (!party) return;
    if (disbanded) {
      // Notify all former members (except the host who left)
      for (const memberToken of party.members) {
        if (memberToken === token) continue;
        const entry = presence.get(memberToken);
        if (!entry) continue;
        for (const sid of entry.sockets) {
          io.to(sid).emit('party_disbanded');
        }
      }
      console.log(`[party] host left, party ${party.id} disbanded`);
    } else {
      broadcastParty(party);
      console.log(`[party] ${presence.get(token)?.nickname} left party ${party.id}`);
    }
  });

  socket.on('party_kick', ({ token: targetToken }) => {
    const token = identifiedTokens.get(socket.id);
    if (!token) return;
    // Notify kicked member
    const kickedEntry = presence.get(targetToken);
    const party = partyManager.kick(token, targetToken);
    if (!party) {
      socket.emit('party_error', { code: 'NOT_HOST', message: 'Only the host can kick members.' });
      return;
    }
    if (kickedEntry) {
      for (const sid of kickedEntry.sockets) {
        io.to(sid).emit('party_disbanded');
      }
    }
    broadcastParty(party);
    console.log(`[party] ${presence.get(token)?.nickname} kicked ${kickedEntry?.nickname} from party ${party.id}`);
  });

  socket.on('party_launch', ({ gameId }) => {
    const token = identifiedTokens.get(socket.id);
    if (!token) return;
    const party = partyManager.getByToken(token);
    if (!party || party.hostToken !== token) {
      socket.emit('party_error', { code: 'NOT_HOST', message: 'Only the host can launch a game.' });
      return;
    }
    // Check party size vs game capacity
    const capacity = getGameCapacity(gameId);
    if (party.members.length > capacity.max) {
      socket.emit('party_error', {
        code: 'PARTY_FULL' as const,
        message: `Party has ${party.members.length} members but ${gameId} supports max ${capacity.max}.`,
      });
      return;
    }

    // Leave any existing rooms for all party members first
    const handleLeaveForToken = (memberToken: string) => {
      const memberEntry = presence.get(memberToken);
      if (!memberEntry) return;
      for (const sid of memberEntry.sockets) {
        const existingRoom = roomManager.getRoomBySocket(sid);
        if (existingRoom) {
          roomManager.removeSocket(sid);
          io.in(existingRoom.code).emit('player_left', {
            playerId: memberToken,
            playerIndex: -1,
            playerCount: existingRoom.players.length,
          });
        }
      }
    };

    for (const memberToken of party.members) {
      handleLeaveForToken(memberToken);
    }

    // Create room with host (mirrors create_room handler)
    const nickname = presence.get(token)?.nickname ?? 'Player';
    const effectiveMax = Math.min(party.members.length, capacity.max);
    const room = roomManager.createRoom(socket.id, token, gameId as GameId, nickname, 'private', undefined, undefined, capacity.min, effectiveMax);

    // Set cosmetics on host player
    const creatorPlayer = room.players.find((p) => p.playerToken === token);
    if (creatorPlayer) {
      const prof = profiles.get(token);
      creatorPlayer.avatarId = prof?.avatarId;
      creatorPlayer.nameColor = prof?.nameColor;
      creatorPlayer.avatarFrame = prof?.avatarFrame;
    }

    socket.join(room.code);
    addPresence(room.code, 0, socket.id);
    socketActivity.set(socket.id, { kind: 'room', gameId: gameId as GameId, roomCode: room.code });

    // Update party state
    partyManager.setRoom(party.id, gameId as GameId, room.code);

    // Emit room_created to host
    socket.emit('room_created', {
      roomCode: room.code,
      playerIndex: 0 as const,
      gameId: gameId as GameId,
      players: roomPlayers(room),
      maxPlayers: room.maxPlayers,
    });
    socket.emit('chat_history', { scope: 'room', messages: [] });

    // Notify all party members to navigate to the game
    for (const memberToken of party.members) {
      const entry = presence.get(memberToken);
      if (!entry) continue;
      for (const sid of entry.sockets) {
        io.to(sid).emit('party_game_starting', { gameId: gameId as GameId, roomCode: room.code });
      }
    }

    broadcastParty(party);
    broadcastPresence(io);
    console.log(`[party] host launched ${gameId} for party ${party.id} → room ${room.code}`);
  });
}
