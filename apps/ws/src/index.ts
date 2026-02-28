import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from 'shared';
import { roomManager } from './rooms.js';
import { engineRegistry } from './engineRegistry.js';
import { rateLimiter } from './rateLimiter.js';
import { getStats, getAllStats, recordResult } from './stats.js';
import { addMatch, getHistory } from './matchHistory.js';
import type { RoomPlayerInfo, OpenRoomInfo, PublicRoomListItem, GameId, Match, ActionErrorCode } from 'shared';
import type { Room } from './rooms.js';

function roomPlayers(room: Room): RoomPlayerInfo[] {
  return room.players
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((p) => ({ index: p.index, nickname: p.nickname }));
}

const COUNTDOWN_MS = 3000;

/** Per-gameId matchmaking queue: gameId → waiting room info */
const quickPlayQueue = new Map<GameId, OpenRoomInfo>();

/** socketId → nickname for all identified sockets */
const nicknameMap = new Map<string, string>();

// ── Public room rate limiter (per IP, in-memory) ──────────────────────────────
const PUBLIC_ROOM_RATE_LIMIT = 3;
const PUBLIC_ROOM_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const publicRoomCreations = new Map<string, { count: number; firstAt: number }>();
// Evict stale entries every 5 minutes to prevent unbounded growth
setInterval(() => {
  const cutoff = Date.now() - PUBLIC_ROOM_RATE_WINDOW_MS;
  for (const [ip, entry] of publicRoomCreations) {
    if (entry.firstAt < cutoff) publicRoomCreations.delete(ip);
  }
}, 5 * 60 * 1000);

function getClientIp(handshake: { headers: Record<string, string | string[] | undefined>; address: string }): string {
  const fwd = handshake.headers['x-forwarded-for'];
  if (fwd) {
    const raw = Array.isArray(fwd) ? fwd[0] : fwd;
    return raw.split(',')[0].trim();
  }
  return handshake.address;
}

function canCreatePublicRoom(ip: string): boolean {
  const now = Date.now();
  const entry = publicRoomCreations.get(ip);
  if (!entry || now - entry.firstAt > PUBLIC_ROOM_RATE_WINDOW_MS) {
    publicRoomCreations.set(ip, { count: 1, firstAt: now });
    return true;
  }
  if (entry.count >= PUBLIC_ROOM_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getPublicRoomList(): PublicRoomListItem[] {
  const items = roomManager.getPublicRooms().map((room) => ({
    code: room.code,
    gameId: room.gameId,
    roomName: room.roomName,
    hostNickname: room.players[0]?.nickname ?? 'Unknown',
    playerCount: room.players.length,
    maxPlayers: 2,
    createdAt: room.createdAt,
  }));
  // Sort: joinable (1/2) → empty (0/2) → full (2/2); newest-first within each group
  items.sort((a, b) => {
    const pri = (n: number) => (n === 1 ? 0 : n === 0 ? 1 : 2);
    const diff = pri(a.playerCount) - pri(b.playerCount);
    return diff !== 0 ? diff : b.createdAt - a.createdAt;
  });
  return items;
}

const PORT = Number(process.env.PORT ?? 3001);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

const httpServer = createServer((_req, res) => {
  res.writeHead(200);
  res.end('ok');
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: WEB_ORIGIN, methods: ['GET', 'POST'] },
});

function broadcastOpenRooms() {
  io.emit('open_rooms', { rooms: getPublicRoomList() });
}

function startCountdown(room: Room) {
  room.matchStartsAt = Date.now() + COUNTDOWN_MS;
  io.to(room.code).emit('match_starting', { startsInMs: COUNTDOWN_MS });
}

// ── Room-level callbacks (fired outside socket event handlers) ────────────────

roomManager.onPlayerEvicted((room, playerIndex) => {
  console.log(`[evict] player ${playerIndex} evicted from ${room.code}`);
  io.to(room.code).emit('player_left', {
    playerId: '(timeout)',
    playerIndex,
    playerCount: room.players.length,
  });
  if (room.visibility === 'public') broadcastOpenRooms();
});

roomManager.onRoomCleaned((room) => {
  // Kick any remaining spectators from the Socket.IO room channel
  io.in(room.code).socketsLeave(room.code);
  if (room.visibility === 'public') broadcastOpenRooms();
});

// ── Per-connection logic ──────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  // ── identify ──────────────────────────────────────────────────────────────
  // Sent by the client immediately after connecting.
  // Restores the player's seat if their token matches a live session.
  socket.on('identify', ({ playerToken, nickname }) => {
    nicknameMap.set(socket.id, nickname);
    const result = roomManager.claimSession(playerToken, socket.id, nickname);
    if (!result) return; // no live session → client stays in lobby

    const { room, player } = result;
    socket.join(room.code);

    socket.emit('room_rejoined', {
      roomCode: room.code,
      gameId: room.gameId,
      playerIndex: player.index,
      playerCount: room.players.length,
      spectatorCount: room.spectators.size,
      state: room.state,
      players: roomPlayers(room),
    });

    // Notify others in the room
    socket.to(room.code).emit('player_rejoined', {
      playerId: socket.id,
      playerIndex: player.index,
      playerCount: room.players.length,
      players: roomPlayers(room),
    });

    // Broadcast authoritative game state to the entire room so that any client
    // whose phase was set to 'ended' by the earlier player_left event gets
    // reset to 'playing' (the only client event that updates phase back).
    const { state: reconnectState } = room;
    if (reconnectState) {
      io.to(room.code).emit('game_state', {
        roomCode: room.code,
        gameId: room.gameId,
        state: reconnectState,
        spectatorCount: room.spectators.size,
      });
    }

    if (room.matchStartsAt && Date.now() < room.matchStartsAt) {
      socket.emit('match_starting', { startsInMs: room.matchStartsAt - Date.now() });
    }
    console.log(`[rejoin] ${socket.id} → ${room.code} (player ${player.index})`);
  });

  // ── create_room ───────────────────────────────────────────────────────────
  socket.on('create_room', ({ playerToken, gameId = 'tictactoe', nickname, visibility = 'private', roomName }) => {
    // Spam protection: max PUBLIC_ROOM_RATE_LIMIT public rooms per IP per window
    if (visibility === 'public') {
      const ip = getClientIp(socket.handshake as { headers: Record<string, string | string[] | undefined>; address: string });
      if (!canCreatePublicRoom(ip)) {
        socket.emit('room_error', {
          code: 'RATE_LIMITED',
          message: `Too many public rooms created — max ${PUBLIC_ROOM_RATE_LIMIT} per 10 minutes. Try again later.`,
        });
        return;
      }
    }

    // Leave any existing room first
    const existing = roomManager.getRoomBySocket(socket.id);
    if (existing) {
      roomManager.removeSocket(socket.id);
      socket.leave(existing.code);
    }

    // Sanitize room name: strip whitespace, cap at 24 chars
    const sanitizedName = roomName?.trim().slice(0, 24) || undefined;

    const room = roomManager.createRoom(socket.id, playerToken, gameId, nickname, visibility, sanitizedName);
    socket.join(room.code);
    socket.emit('room_created', { roomCode: room.code, playerIndex: 0, gameId: room.gameId, players: roomPlayers(room) });
    if (visibility === 'public') broadcastOpenRooms();
    console.log(`[room] created ${room.code} (${room.gameId}, ${visibility}${sanitizedName ? `: ${sanitizedName}` : ''})`);
  });

  // ── join_room ─────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomCode, playerToken, nickname }) => {
    const code = roomCode.toUpperCase().trim();

    // Check if this token already owns a seat in this room (reconnect via join_room)
    const rejoin = roomManager.claimSession(playerToken, socket.id, nickname);
    if (rejoin && rejoin.room.code === code) {
      const { room, player } = rejoin;
      socket.join(code);
      socket.emit('room_rejoined', {
        roomCode: code,
        gameId: room.gameId,
        playerIndex: player.index,
        playerCount: room.players.length,
        spectatorCount: room.spectators.size,
        state: room.state,
        players: roomPlayers(room),
      });
      socket.to(code).emit('player_rejoined', {
        playerId: socket.id,
        playerIndex: player.index,
        playerCount: room.players.length,
        players: roomPlayers(room),
      });
      // Same phase-reset broadcast as in the identify reconnect path.
      const { state: rejoinState } = room;
      if (rejoinState) {
        io.to(code).emit('game_state', {
          roomCode: code,
          gameId: room.gameId,
          state: rejoinState,
          spectatorCount: room.spectators.size,
        });
      }
      return;
    }

    const targetRoom = roomManager.getRoom(code);
    if (!targetRoom) {
      socket.emit('room_error', { code: 'ROOM_NOT_FOUND', message: 'Room not found. Check the code.' });
      return;
    }

    // ── Room has an open player seat ─────────────────────────────────────────
    if (targetRoom.players.length < 2) {
      const result = roomManager.joinAsPlayer(code, socket.id, playerToken, nickname);
      if (typeof result === 'string') {
        const msgs: Record<string, string> = {
          ROOM_NOT_FOUND: 'Room not found.',
          ALREADY_IN_ROOM: 'You are already in this room.',
        };
        socket.emit('room_error', { code: result, message: msgs[result] ?? result });
        return;
      }

      const room = result;
      const playerIds = room.players
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((p) => p.playerToken) as [string, string];
      const engine = engineRegistry[room.gameId];
      const state = engine.initialState(playerIds);
      room.state = state;

      socket.join(code);
      socket.emit('room_joined', {
        roomCode: code,
        gameId: room.gameId,
        playerIndex: 1,
        isSpectator: false,
        playerCount: room.players.length,
        spectatorCount: room.spectators.size,
        state,
        players: roomPlayers(room),
      });
      socket.to(code).emit('player_joined', {
        playerId: socket.id,
        playerIndex: 1,
        playerCount: room.players.length,
        spectatorCount: room.spectators.size,
        state,
        players: roomPlayers(room),
      });
      if (room.visibility === 'public') broadcastOpenRooms();
      startCountdown(room);
      console.log(`[room] ${socket.id} joined ${code} as player 1`);
      return;
    }

    // ── Room is full → join as spectator ─────────────────────────────────────
    const spectateResult = roomManager.joinAsSpectator(code, socket.id);
    if (typeof spectateResult === 'string') {
      socket.emit('room_error', { code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
      return;
    }

    const room = spectateResult;
    socket.join(code);
    socket.emit('room_joined', {
      roomCode: code,
      gameId: room.gameId,
      playerIndex: null,
      isSpectator: true,
      playerCount: room.players.length,
      spectatorCount: room.spectators.size,
      state: room.state,
      players: roomPlayers(room),
    });
    io.to(code).emit('spectator_count_changed', { spectatorCount: room.spectators.size });
    console.log(`[room] ${socket.id} joined ${code} as spectator`);
  });

  // ── game_action ───────────────────────────────────────────────────────────
  socket.on('game_action', ({ roomCode, action }) => {
    const code = roomCode.toUpperCase().trim();
    const room = roomManager.getRoom(code);

    if (!room) {
      socket.emit('action_error', { code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
      return;
    }
    if (roomManager.isSpectator(socket.id)) {
      socket.emit('action_error', { code: 'SPECTATOR_CANNOT_ACT', message: 'Spectators cannot make moves.' });
      return;
    }
    if (!room.state) {
      socket.emit('action_error', { code: 'GAME_NOT_STARTED', message: 'Waiting for second player.' });
      return;
    }
    // Capture as local const so TypeScript preserves the non-null narrowing
    // across subsequent function calls (rateLimiter, getPlayer) that could
    // theoretically mutate room.state from TypeScript's perspective.
    const currentState = room.state;
    if (!rateLimiter.check(socket.id)) {
      socket.emit('action_error', { code: 'RATE_LIMITED', message: 'Slow down — too many actions.' });
      return;
    }
    if (room.matchStartsAt && Date.now() < room.matchStartsAt) {
      socket.emit('action_error', { code: 'MATCH_COUNTDOWN', message: 'Wait for the countdown to finish.' });
      return;
    }

    // Resolve player via the stable token mapping (socket.id changes on every
    // reconnect; playerToken is permanent and is what the engine uses as identity).
    const actingToken = roomManager.getTokenForSocket(socket.id);
    const player = actingToken ? room.players.find((p) => p.playerToken === actingToken) : undefined;
    if (!player) {
      socket.emit('action_error', { code: 'NOT_IN_ROOM', message: 'You are not a player in this room.' });
      return;
    }

    // Sanity guard: if the current-turn token is not among the room's connected
    // players, the game cannot proceed.  Re-sync so clients show the true state
    // and bail — this should never fire after a correct reconnect.
    const connectedTokens = new Set(room.players.map((p) => p.playerToken));
    const turnToken = 'currentTurn' in currentState
      ? currentState.currentTurn
      : currentState.currentPlayer;
    if (!connectedTokens.has(turnToken)) {
      console.error(`[sanity] ${code}: turn token ${turnToken} not in connected players ${[...connectedTokens].join(',')}, re-syncing`);
      io.to(code).emit('game_state', { roomCode: code, gameId: room.gameId, state: currentState, spectatorCount: room.spectators.size });
      return;
    }

    try {
      const engine = engineRegistry[room.gameId];
      const prevStatus = currentState.status;
      const nextState = engine.applyAction(currentState, action, {
        playerId: player.playerToken,
        playerIndex: player.index,
      });
      room.state = nextState;
      io.to(code).emit('game_state', {
        roomCode: code,
        gameId: room.gameId,
        state: nextState,
        spectatorCount: room.spectators.size,
      });

      // Record result and broadcast updated stats when a game just ended
      if (prevStatus === 'ongoing' && nextState.status !== 'ongoing') {
        let result: { winner: 0 | 1 } | { draw: true };
        if (nextState.status === 'draw') {
          result = { draw: true };
        } else {
          // Both TicTacToeState and Connect4State have players[].id and winner
          const winnerIdx = nextState.players.findIndex((p: { id: string }) => p.id === nextState.winner);
          result = { winner: (winnerIdx === 1 ? 1 : 0) as 0 | 1 };
        }
        const stats = recordResult(room.gameId, result);
        io.to(code).emit('stats_updated', { gameId: room.gameId, stats });
        // Broadcast updated aggregate to all sockets (leaderboard page listeners)
        io.emit('all_stats', { statsByGameId: getAllStats() });

        // Record personal match history for both players
        const sortedPlayers = room.players.slice().sort((a, b) => a.index - b.index);
        if (sortedPlayers.length === 2) {
          const matchResult: Match['result'] =
            'draw' in result ? 'draw' : result.winner === 0 ? 'p1' : 'p2';
          const match: Match = {
            ts: Date.now(),
            gameId: room.gameId,
            roomCode: code,
            p1: sortedPlayers[0].nickname,
            p2: sortedPlayers[1].nickname,
            result: matchResult,
          };
          for (const p of sortedPlayers) {
            addMatch(p.nickname, match);
            const psocket = io.sockets.sockets.get(p.socketId);
            if (psocket) psocket.emit('history', { items: getHistory(p.nickname) });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const colonIdx = msg.indexOf(': ');
      const errCode = colonIdx !== -1 ? msg.slice(0, colonIdx) : 'INVALID_ACTION';
      const human = colonIdx !== -1 ? msg.slice(colonIdx + 2) : msg;
      socket.emit('action_error', { code: errCode as ActionErrorCode, message: human });
    }
  });

  // ── get_stats ─────────────────────────────────────────────────────────────
  socket.on('get_stats', ({ gameId }) => {
    socket.emit('stats_updated', { gameId, stats: getStats(gameId) });
  });

  // ── get_all_stats ─────────────────────────────────────────────────────────
  socket.on('get_all_stats', () => {
    socket.emit('all_stats', { statsByGameId: getAllStats() });
  });

  // ── request_rematch ───────────────────────────────────────────────────────
  socket.on('request_rematch', ({ roomCode }) => {
    const code = roomCode.toUpperCase().trim();
    const room = roomManager.getRoom(code);

    // Spectators and unknown sockets are silently ignored
    if (!room || roomManager.isSpectator(socket.id)) return;

    const player = roomManager.getPlayer(room, socket.id);
    if (!player) return;

    if (!room.state || room.state.status === 'ongoing') {
      socket.emit('rematch_error', { code: 'GAME_NOT_OVER', message: 'The game is still in progress.' });
      return;
    }
    if (room.players.length < 2) {
      socket.emit('rematch_error', { code: 'OPPONENT_DISCONNECTED', message: 'Your opponent is not connected.' });
      return;
    }
    if (room.rematchVotes.has(player.index)) {
      socket.emit('rematch_error', { code: 'ALREADY_VOTED', message: 'You already requested a rematch.' });
      return;
    }

    const result = roomManager.voteRematch(socket.id);
    if (!result) return;

    if (result.ready) {
      const engine = engineRegistry[room.gameId];
      const playerIds = room.players
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((p) => p.playerToken) as [string, string];
      const state = engine.initialState(playerIds);
      room.state = state;
      room.rematchVotes.clear();
      io.to(code).emit('rematch_started', { state });
      console.log(`[rematch] ${code} restarted`);
    } else {
      io.to(code).emit('rematch_requested', { votes: result.votes });
    }
  });

  // ── get_history ───────────────────────────────────────────────────────────
  socket.on('get_history', () => {
    const nickname = nicknameMap.get(socket.id);
    socket.emit('history', { items: nickname ? getHistory(nickname) : [] });
  });

  // ── get_open_rooms ────────────────────────────────────────────────────────
  socket.on('get_open_rooms', () => {
    socket.emit('open_rooms', { rooms: getPublicRoomList() });
  });

  // ── quick_play ────────────────────────────────────────────────────────────
  socket.on('quick_play', ({ gameId, playerToken, nickname }) => {
    // Leave any current room first (same as create_room)
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
      }
    }

    const entry = quickPlayQueue.get(gameId);
    if (entry) {
      const waitingRoom = roomManager.getRoom(entry.roomCode);
      if (waitingRoom && waitingRoom.players.length < 2) {
        // Join the waiting room as player 1
        const result = roomManager.joinAsPlayer(entry.roomCode, socket.id, playerToken, nickname);
        if (typeof result !== 'string') {
          quickPlayQueue.delete(gameId);
          broadcastOpenRooms();
          const room = result;
          const playerIds = room.players
            .slice()
            .sort((a, b) => a.index - b.index)
            .map((p) => p.playerToken) as [string, string];
          const state = engineRegistry[room.gameId].initialState(playerIds);
          room.state = state;

          socket.join(entry.roomCode);
          socket.emit('room_joined', {
            roomCode: entry.roomCode,
            gameId: room.gameId,
            playerIndex: 1,
            isSpectator: false,
            playerCount: room.players.length,
            spectatorCount: room.spectators.size,
            state,
            players: roomPlayers(room),
          });
          socket.emit('quick_play_joined', { roomCode: entry.roomCode });
          socket.to(entry.roomCode).emit('player_joined', {
            playerId: socket.id,
            playerIndex: 1,
            playerCount: room.players.length,
            spectatorCount: room.spectators.size,
            state,
            players: roomPlayers(room),
          });
          startCountdown(room);
          console.log(`[quick-play] ${socket.id} joined ${entry.roomCode} (${gameId})`);
          return;
        }
      }
      // Stale entry — clear it and fall through to create
      quickPlayQueue.delete(gameId);
      broadcastOpenRooms();
    }

    // No waiting room — create one and enter the queue
    const room = roomManager.createRoom(socket.id, playerToken, gameId, nickname, 'public');
    quickPlayQueue.set(gameId, { roomCode: room.code, gameId, hostNickname: nickname, createdAt: Date.now() });
    broadcastOpenRooms();
    socket.join(room.code);
    socket.emit('room_created', {
      roomCode: room.code,
      playerIndex: 0,
      gameId: room.gameId,
      players: roomPlayers(room),
    });
    socket.emit('quick_play_joined', { roomCode: room.code });
    console.log(`[quick-play] ${socket.id} waiting in ${room.code} (${gameId})`);
  });

  // ── leave_room ────────────────────────────────────────────────────────────
  socket.on('leave_room', ({ roomCode }) => {
    handleLeave(roomCode.toUpperCase().trim());
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    rateLimiter.clear(socket.id);
    nicknameMap.delete(socket.id);
    handleLeave();
  });

  function handleLeave(explicitCode?: string) {
    const result = roomManager.removeSocket(socket.id);
    if (!result) return;

    const { room } = result;
    socket.leave(room.code);

    if (result.type === 'player') {
      // Broadcast immediately; eviction callback will fire again after 30 s if they don't return
      io.to(room.code).emit('player_left', {
        playerId: socket.id,
        playerIndex: result.player.index,
        playerCount: room.players.length,
      });
      // Remove from quick-play queue if this was the waiting room and it's now empty
      if (room.players.length === 0) {
        for (const [gid, entry] of quickPlayQueue) {
          if (entry.roomCode === room.code) { quickPlayQueue.delete(gid); break; }
        }
      }
      // Broadcast updated public list (covers both quick-play and custom public rooms)
      if (room.visibility === 'public') broadcastOpenRooms();
    } else {
      // Spectator left
      io.to(room.code).emit('spectator_count_changed', { spectatorCount: room.spectators.size });
    }

    console.log(`[room] ${socket.id} left ${room.code} (${result.type})`);
  }
});

httpServer.listen(PORT, () => {
  console.log(`ws server → http://localhost:${PORT}  (CORS: ${WEB_ORIGIN})`);
});
