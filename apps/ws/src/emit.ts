import type { AnyGameState, RoomPlayerInfo } from 'shared';
import type { Room } from './rooms.js';
import type { GameServer } from './serverTypes.js';
import { roomManager } from './rooms.js';
import { projectGameState } from './stateProjection.js';
import { buildCosmetics } from './cosmetics.js';
import { presence } from './presence.js';

export function roomPlayers(room: Room): RoomPlayerInfo[] {
  return room.players
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((p) => {
      const pres = presence.get(p.playerToken);
      return { index: p.index, nickname: p.nickname, avatarId: p.avatarId, nameColor: p.nameColor, avatarFrame: p.avatarFrame, cosmetics: buildCosmetics(p), level: pres?.level };
    });
}

/**
 * Broadcast game_state to every socket in the room with a per-socket projected
 * state (hides opponent ship positions for Battleship; no-op for other games).
 */
export function emitGameState(io: GameServer, room: Room, state: AnyGameState) {
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (!sockets) return;
  for (const sid of sockets) {
    const sock = io.sockets.sockets.get(sid);
    if (!sock) continue;
    const isSpec = roomManager.isSpectator(sid);
    const pIdx = isSpec
      ? null
      : (room.players.find((p) => p.socketId === sid)?.index ?? null);
    sock.emit('game_state', {
      roomCode: room.code,
      gameId: room.gameId,
      state: projectGameState(room.gameId, state, { playerIndex: pIdx, isSpectator: isSpec }),
      spectatorCount: room.spectators.size,
    });
  }
}

/** Broadcast rematch_started to every socket in the room with per-socket projection. */
export function emitRematchStarted(io: GameServer, room: Room, state: AnyGameState) {
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (!sockets) return;
  for (const sid of sockets) {
    const sock = io.sockets.sockets.get(sid);
    if (!sock) continue;
    const isSpec = roomManager.isSpectator(sid);
    const pIdx = isSpec
      ? null
      : (room.players.find((p) => p.socketId === sid)?.index ?? null);
    sock.emit('rematch_started', {
      state: projectGameState(room.gameId, state, { playerIndex: pIdx, isSpectator: isSpec }),
    });
  }
}

export function emitPlayerJoined(io: GameServer, room: Room, joinerToken: string, joinerSocketId: string) {
  const joiner = room.players.find(p => p.playerToken === joinerToken);
  if (!joiner) return;
  for (const p of room.players) {
    if (p.playerToken === joinerToken) continue;
    const pSock = io.sockets.sockets.get(p.socketId);
    if (pSock) {
      pSock.emit('player_joined', {
        playerId: joinerSocketId,
        playerIndex: joiner.index,
        playerCount: room.players.length,
        spectatorCount: room.spectators.size,
        state: room.state
          ? projectGameState(room.gameId, room.state, { playerIndex: p.index, isSpectator: false })
          : null,
        players: roomPlayers(room),
      });
    }
  }
}
