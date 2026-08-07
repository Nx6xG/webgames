import { createServer, type Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import type { GameServer } from './serverTypes.js';
import type { ServerToClientEvents, ClientToServerEvents } from 'shared';
import { NC_BOT_TOKEN_PREFIX, isBotToken } from 'shared';
import type { GameId, Match, ActionErrorCode, ChatMessage, LeaderboardMode } from 'shared';
import { roomManager, PLAYER_RECONNECT_MS } from './rooms.js';
import type { Room } from './rooms.js';
import { engineRegistry } from './engineRegistry.js';
import { rateLimiter } from './rateLimiter.js';
import { getStats, getAllStats, recordResult } from './stats.js';
import { addMatch, getHistory } from './matchHistory.js';
import { recordMatchResult, recordDraw, updateNickname, getEntries } from './leaderboard.js';
import { projectGameState } from './stateProjection.js';
import { PartyManager } from './parties.js';
import { getGameCapacity } from './gameCapacity.js';
import { InMemoryStorage } from './storage/inMemory.js';
import type { Storage } from './storage/types.js';
import { TournamentManager } from './tournament.js';

// ── Extracted modules ─────────────────────────────────────────────────────────
import { buildCosmetics, applyCosmetics } from './cosmetics.js';
import {
  profiles, identifiedTokens, nicknameMap,
  globalChat, roomChats, pushGlobalChat, cleanChatTimestamps,
  sanitizeNickname, safeNickname, sanitizeMessage, canChat,
  ROOM_CHAT_BUF,
} from './chatState.js';
import { presence, socketActivity, buildPresenceList, broadcastPresence } from './presence.js';
import {
  COUNTDOWN_MS, roomGamePresence,
  addPresence, removePresence, replacePresence,
  emitRoomReady, allSeatedPlayersPresent, tryStartCountdown,
} from './roomPresence.js';
import { roomPlayers, emitGameState, emitRematchStarted, emitPlayerJoined } from './emit.js';
import { startTickLoop, stopTickLoop } from './tickLoop.js';
import {
  quickPlayQueue, dropFromQuickPlayQueue,
  PUBLIC_ROOM_RATE_LIMIT, cleanPublicRoomRateLimiter,
  getClientIp, canCreatePublicRoom,
  getPublicRoomList, broadcastOpenRooms,
} from './openRooms.js';
import { createHttpHandler } from './adminHttp.js';
import { registerPartyHandlers } from './partyHandlers.js';
import { registerTournamentHandlers, startTournamentMatch } from './tournamentHandlers.js';
import { registerInviteHandlers } from './inviteHandlers.js';

const storage: Storage = new InMemoryStorage();
void storage; // reserved for future persistent backends
const partyManager = new PartyManager();
const tournamentManager = new TournamentManager();

/** Human-readable game names for global chat announcements */
const GAME_DISPLAY_NAMES: Record<GameId, string> = {
  tictactoe: 'Tic Tac Toe',
  connect4: 'Connect 4',
  rps: 'Rock Paper Scissors',
  chess: 'Chess',
  battleship: 'Battleship',
  liarsbar: "Liar's Deck",
  curvefever: 'Curve Fever',
  uno: 'UNO',
  nexusclash: 'Nexus Clash',
};

// ── Periodic cleanup (every 5 minutes) ───────────────────────────────────────
setInterval(() => {
  cleanPublicRoomRateLimiter();
  cleanChatTimestamps();

  // Clean identified tokens for disconnected sockets
  for (const [socketId] of identifiedTokens) {
    if (!io.sockets.sockets.has(socketId)) {
      identifiedTokens.delete(socketId);
    }
  }

  // Clean rate limiter for disconnected sockets
  const activeSocketIds = new Set(io.sockets.sockets.keys());
  rateLimiter.cleanDisconnected(activeSocketIds);

  // Clean stale tournaments
  tournamentManager.cleanup();
}, 5 * 60 * 1000);

// ── Server setup ──────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001);
// Support multiple CORS origins via comma-separated WS_CORS_ORIGIN.
// In production: WS_CORS_ORIGIN="https://games.nico-grim.me"
// Locally the default is http://localhost:3000.
// Always allow localhost:3000 so local dev works even when a prod origin is set.
const RAW_CORS = process.env.WS_CORS_ORIGIN ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const CORS_ORIGINS = RAW_CORS.split(',').map((s) => s.trim()).filter(Boolean);
if (!CORS_ORIGINS.includes('http://localhost:3000')) {
  CORS_ORIGINS.push('http://localhost:3000');
}
const WS_CORS_ORIGIN: string | string[] = CORS_ORIGINS.length === 1 ? CORS_ORIGINS[0] : CORS_ORIGINS;

// Explicit annotations break the circular inference between httpServer and io
// (the HTTP handler closes over io, io wraps httpServer).
const httpServer: HttpServer = createServer(createHttpHandler(() => io));

const io: GameServer = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: WS_CORS_ORIGIN, methods: ['GET', 'POST'] },
});

// ── Room-level callbacks (fired outside socket event handlers) ────────────────

roomManager.onPlayerEvicted((room, playerIndex) => {
  console.log(`[evict] player ${playerIndex} evicted from ${room.code}`);
  // Remove evicted player from liarsbar lobby state
  if (room.state && room.gameId === 'liarsbar') {
    const lbState = room.state as import('shared').LiarsBarState;
    if (lbState.phase === 'lobby') {
      // Re-sync game-state players to match room.players (the evicted player
      // is already removed from room.players at this point).
      const roomTokens = new Set(room.players.map(p => p.playerToken));
      lbState.players = lbState.players.filter(p => roomTokens.has(p.id));
      lbState.hands = lbState.players.map(() => []);
      if (lbState.players.length > 0) {
        lbState.currentTurn = lbState.players[0].id;
      }
    }
  }
  // Remove evicted player from uno lobby state
  if (room.state && room.gameId === 'uno') {
    const unoState = room.state as import('shared').UnoState;
    if (unoState.phase === 'lobby') {
      const roomTokens = new Set(room.players.map(p => p.playerToken));
      const keepIndices = unoState.playerIds.map((t, i) => roomTokens.has(t) ? i : -1).filter(i => i >= 0);
      unoState.playerIds = keepIndices.map(i => unoState.playerIds[i]);
      unoState.players = keepIndices.map(i => unoState.players[i]);
      unoState.hands = keepIndices.map(i => unoState.hands[i]);
      if (unoState.playerIds.length > 0) unoState.currentTurn = unoState.playerIds[0];
    }
  }
  // Remove evicted player from curvefever lobby state
  if (room.state && room.gameId === 'curvefever') {
    const cfState = room.state as import('shared').CurveFeverState;
    if (cfState.phase === 'lobby') {
      const roomTokens = new Set(room.players.map(p => p.playerToken));
      // Keep human players still in room + all bots
      const keepIndices = cfState.playerIds.map((t, i) => (roomTokens.has(t) || isBotToken(t)) ? i : -1).filter(i => i >= 0);
      cfState.playerIds = keepIndices.map(i => cfState.playerIds[i]);
      cfState.players = keepIndices.map(i => cfState.players[i]);
      cfState.trails = keepIndices.map(i => cfState.trails[i]);
      cfState.gapCounters = keepIndices.map(i => cfState.gapCounters[i]);
      cfState.gapRemaining = keepIndices.map(i => cfState.gapRemaining[i]);
      cfState.botReactionCounters = keepIndices.map(i => cfState.botReactionCounters?.[i] ?? 0);
      if (cfState.playerIds.length > 0) cfState.currentTurn = cfState.playerIds[0];
    } else {
      // During gameplay, stop tick loop if too few players remain
      stopTickLoop(room.code);
    }
  }
  io.to(room.code).emit('player_left', {
    playerId: '(timeout)',
    playerIndex,
    playerCount: room.players.length,
  });
  // Broadcast updated game state after liarsbar/curvefever lobby change
  if (room.state && (room.gameId === 'liarsbar' || room.gameId === 'curvefever' || room.gameId === 'uno')) {
    emitGameState(io, room, room.state);
  }
  if (room.visibility === 'public') broadcastOpenRooms(io);
});

roomManager.onRoomCleaned((room) => {
  // Stop any tick loop for real-time games
  stopTickLoop(room.code);
  // Kick any remaining spectators from the Socket.IO room channel
  io.in(room.code).socketsLeave(room.code);
  if (room.visibility === 'public') broadcastOpenRooms(io);
  // Free the room's chat buffer
  roomChats.delete(room.code);
  // Free presence map entry
  roomGamePresence.delete(room.code);
});

// ── Per-connection logic ──────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  // Every socket joins the global chat channel and receives history
  socket.join('global');
  socket.emit('chat_history', { scope: 'global', messages: globalChat });

  // ── identify ──────────────────────────────────────────────────────────────
  // Sent by the client immediately after connecting.
  // Restores the player's seat if their token matches a live session.
  socket.on('identify', ({ playerToken, nickname: rawNickname, avatarId, nameColor, avatarFrame, cosmetics, userId, level: rawLevel, showcase: rawShowcase }) => {
    if (typeof playerToken !== 'string' || playerToken.length === 0 || playerToken.length > 64) return;
    const nickname = safeNickname(rawNickname);
    const level = typeof rawLevel === 'number' && Number.isFinite(rawLevel)
      ? Math.max(1, Math.min(999, Math.floor(rawLevel)))
      : undefined;
    // Showcase is broadcast to every client via presence — cap its size so a
    // malicious client can't amplify arbitrary payloads through the server.
    let showcase = rawShowcase;
    try {
      if (showcase && JSON.stringify(showcase).length > 4096) showcase = undefined;
    } catch {
      showcase = undefined;
    }
    identifiedTokens.set(socket.id, playerToken);
    nicknameMap.set(socket.id, nickname);
    // Initialise profile from the stored nickname if no profile exists yet
    if (!profiles.has(playerToken)) profiles.set(playerToken, { nickname, avatarId, nameColor, avatarFrame });
    else {
      const prof = profiles.get(playerToken)!;
      if (avatarId !== undefined) prof.avatarId = avatarId;
      if (nameColor !== undefined) prof.nameColor = nameColor;
      if (avatarFrame !== undefined) prof.avatarFrame = avatarFrame;
    }
    // Apply unified cosmetics (overwrites individual fields if present)
    applyCosmetics(profiles.get(playerToken)!, cosmetics);
    const profile = profiles.get(playerToken)!;
    socket.emit('session_info', { token: playerToken, nickname, avatarId: profile.avatarId, nameColor: profile.nameColor, avatarFrame: profile.avatarFrame, cosmetics: buildCosmetics(profile), level });

    // Update presence
    const presEntry = presence.get(playerToken);
    if (presEntry) {
      presEntry.sockets.add(socket.id);
      presEntry.nickname = nickname; // prefer latest nickname
      if (avatarId !== undefined) presEntry.avatarId = avatarId;
      if (nameColor !== undefined) presEntry.nameColor = nameColor;
      if (avatarFrame !== undefined) presEntry.avatarFrame = avatarFrame;
      if (profile.banner !== undefined) presEntry.banner = profile.banner;
      if (profile.cardColor !== undefined) presEntry.cardColor = profile.cardColor;
      if (profile.badges !== undefined) presEntry.badges = profile.badges;
      if (userId !== undefined) presEntry.userId = userId;
      if (level !== undefined) presEntry.level = level;
      if (showcase !== undefined) presEntry.showcase = showcase;
    } else {
      presence.set(playerToken, { nickname, avatarId: profile.avatarId, nameColor: profile.nameColor, avatarFrame: profile.avatarFrame, banner: profile.banner, cardColor: profile.cardColor, badges: profile.badges, userId, level, showcase, sockets: new Set([socket.id]) });
    }
    broadcastPresence(io);

    // Push current party state to reconnecting sockets
    const existingParty = partyManager.getByToken(playerToken);
    if (existingParty) {
      const partyState = partyManager.toState(existingParty, (token) => {
        const p = presence.get(token);
        if (!p) return undefined;
        return { nickname: p.nickname, avatarId: p.avatarId, cosmetics: buildCosmetics(p) };
      });
      socket.emit('party_updated', { party: partyState });
    }

    const result = roomManager.claimSession(playerToken, socket.id, nickname);
    if (!result) return; // no live session → client stays in lobby

    const { room, player } = result;
    const identifyProfile = profiles.get(playerToken);
    player.avatarId = identifyProfile?.avatarId;
    player.nameColor = identifyProfile?.nameColor;
    player.avatarFrame = identifyProfile?.avatarFrame;
    player.cardColor = identifyProfile?.cardColor;
    socket.join(room.code);

    // Register game-page socket presence; may trigger countdown if other player was waiting
    {
      const wasReady = allSeatedPlayersPresent(room);
      replacePresence(room.code, player.index, socket.id);
      emitRoomReady(io, room);
      if (!wasReady) tryStartCountdown(io, room);
    }

    socket.emit('room_rejoined', {
      roomCode: room.code,
      gameId: room.gameId,
      playerIndex: player.index,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      spectatorCount: room.spectators.size,
      state: room.state
        ? projectGameState(room.gameId, room.state, { playerIndex: player.index, isSpectator: false })
        : null,
      players: roomPlayers(room),
    });

    // Send room chat history so the rejoining player catches up
    socket.emit('chat_history', { scope: 'room', messages: roomChats.get(room.code) ?? [] });

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
      emitGameState(io, room, reconnectState);
    }

    if (room.matchStartsAt && Date.now() < room.matchStartsAt) {
      socket.emit('match_starting', { startsInMs: room.matchStartsAt - Date.now() });
    }
    socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: room.code, isPublic: room.visibility === 'public' });
    broadcastPresence(io);
    console.log(`[rejoin] ${socket.id} → ${room.code} (player ${player.index})`);
  });

  // ── create_room ───────────────────────────────────────────────────────────
  socket.on('create_room', ({ playerToken, gameId = 'tictactoe', nickname: rawNickname, visibility = 'private', roomName, rpsConfig, ldConfig, battleshipConfig, cfConfig, unoConfig, chessConfig, ncConfig, maxPlayers: requestedMax }) => {
    const nickname = safeNickname(rawNickname);
    identifiedTokens.set(socket.id, playerToken);
    nicknameMap.set(socket.id, nickname);
    if (!profiles.has(playerToken)) profiles.set(playerToken, { nickname });

    // Validate gameId
    if (!(gameId in engineRegistry)) {
      socket.emit('room_error', { code: 'INVALID_GAME', message: 'Unknown game.' });
      return;
    }

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

    const gameConfig = gameId === 'rps' && rpsConfig
      ? rpsConfig
      : gameId === 'liarsbar' && ldConfig
        ? ldConfig
        : gameId === 'battleship' && battleshipConfig
          ? battleshipConfig
          : gameId === 'curvefever' && cfConfig
            ? cfConfig
            : gameId === 'uno' && unoConfig
              ? unoConfig
              : gameId === 'chess' && chessConfig
                ? chessConfig
                : gameId === 'nexusclash' && ncConfig
                  ? {
                      ...ncConfig,
                      // Map creator's flat deckCards into playerDecks keyed by token
                      playerDecks: ncConfig.deckCards
                        ? { [playerToken]: ncConfig.deckCards }
                        : ncConfig.playerDecks ?? {},
                    }
                  : undefined;
    const cap = getGameCapacity(gameId);
    // Allow creator to choose maxPlayers within the game's valid range
    const effectiveMax = requestedMax
      ? Math.max(cap.min, Math.min(cap.max, requestedMax))
      : cap.max;
    const room = roomManager.createRoom(socket.id, playerToken, gameId, nickname, visibility, sanitizedName, gameConfig, cap.min, effectiveMax);
    // Set avatar + name color on the room player from profile
    const creatorPlayer = room.players.find((p) => p.playerToken === playerToken);
    if (creatorPlayer) {
      const crProf = profiles.get(playerToken);
      creatorPlayer.avatarId = crProf?.avatarId;
      creatorPlayer.nameColor = crProf?.nameColor;
      creatorPlayer.avatarFrame = crProf?.avatarFrame;
    }
    // Liarsbar / Curvefever / UNO: create lobby-phase state immediately so it can track players
    if (gameId === 'liarsbar' || gameId === 'curvefever' || gameId === 'uno') {
      const engine = engineRegistry[gameId];
      room.state = engine.initialState([playerToken], 0, room.gameConfig);
      // Fix creator nickname in curvefever lobby state
      if (gameId === 'curvefever') {
        const cfState = room.state as import('shared').CurveFeverState;
        if (cfState.players[0]) cfState.players[0].nickname = nickname;
      }
      // Fix creator nickname in uno lobby state
      if (gameId === 'uno') {
        const unoState = room.state as import('shared').UnoState;
        if (unoState.players[0]) unoState.players[0].nickname = nickname;
      }
    }

    socket.join(room.code);
    addPresence(room.code, 0, socket.id);
    socket.emit('room_created', { roomCode: room.code, playerIndex: 0, gameId: room.gameId, players: roomPlayers(room), maxPlayers: room.maxPlayers });
    // Emit initial lobby state for lobby-phase games (curvefever, liarsbar, uno)
    if (room.state) {
      const projected = projectGameState(room.gameId, room.state, { playerIndex: 0, isSpectator: false });
      socket.emit('game_state', { roomCode: room.code, gameId: room.gameId, state: projected, spectatorCount: 0 });
    }
    // ── Nexus Clash bot game: add virtual bot player and start immediately ──
    if (gameId === 'nexusclash' && ncConfig?.botDifficulty) {
      const botToken = NC_BOT_TOKEN_PREFIX + randomUUID();
      const botNickname = `Bot (${ncConfig.botDifficulty})`;
      // Add the bot as player index 1 (no real socket — use empty string)
      room.players.push({ socketId: '', index: 1, playerToken: botToken, nickname: botNickname });
      // Initialize game state with both players; human always starts
      const engine = engineRegistry[gameId];
      const state = engine.initialState([playerToken, botToken], 0, room.gameConfig);
      room.state = state;
      startTickLoop(io, room.code);
      // Emit the game state to the human player
      const projected = projectGameState(room.gameId, state, { playerIndex: 0, isSpectator: false });
      socket.emit('game_state', { roomCode: room.code, gameId: room.gameId, state: projected, spectatorCount: 0 });
      console.log(`[room] ${room.code} nexusclash bot game started (difficulty: ${ncConfig.botDifficulty})`);
    }

    // Empty history for the brand-new room
    socket.emit('chat_history', { scope: 'room', messages: [] });
    socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: room.code, isPublic: room.visibility === 'public' });
    broadcastPresence(io);
    if (visibility === 'public') broadcastOpenRooms(io);
    console.log(`[room] created ${room.code} (${room.gameId}, ${visibility}${sanitizedName ? `: ${sanitizedName}` : ''})`);
  });

  // ── join_room ─────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomCode, playerToken, nickname: rawNickname, ncDeckCards }) => {
    const nickname = safeNickname(rawNickname);
    identifiedTokens.set(socket.id, playerToken);
    nicknameMap.set(socket.id, nickname);
    if (!profiles.has(playerToken)) profiles.set(playerToken, { nickname });

    const code = roomCode.toUpperCase().trim();

    // Check if this token already owns a seat in this room (reconnect via join_room)
    const rejoin = roomManager.claimSession(playerToken, socket.id, nickname);
    if (rejoin && rejoin.room.code === code) {
      const { room, player } = rejoin;
      socket.join(code);
      {
        const wasReady = allSeatedPlayersPresent(room);
        replacePresence(code, player.index, socket.id);
        emitRoomReady(io, room);
        if (!wasReady) tryStartCountdown(io, room);
      }
      socket.emit('room_rejoined', {
        roomCode: code,
        gameId: room.gameId,
        playerIndex: player.index,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        spectatorCount: room.spectators.size,
        state: room.state
          ? projectGameState(room.gameId, room.state, { playerIndex: player.index, isSpectator: false })
          : null,
        players: roomPlayers(room),
      });
      socket.emit('chat_history', { scope: 'room', messages: roomChats.get(code) ?? [] });
      socket.to(code).emit('player_rejoined', {
        playerId: socket.id,
        playerIndex: player.index,
        playerCount: room.players.length,
        players: roomPlayers(room),
      });
      // Same phase-reset broadcast as in the identify reconnect path.
      const { state: rejoinState } = room;
      if (rejoinState) {
        emitGameState(io, room, rejoinState);
      }
      socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: code, isPublic: room.visibility === 'public' });
      broadcastPresence(io);
      return;
    }

    const targetRoom = roomManager.getRoom(code);
    if (!targetRoom) {
      socket.emit('room_error', { code: 'ROOM_NOT_FOUND', message: 'Room not found. Check the code.' });
      return;
    }

    // ── Room has an open player seat ─────────────────────────────────────────
    if (targetRoom.players.length < targetRoom.maxPlayers) {
      const result = roomManager.joinAsPlayer(code, socket.id, playerToken, nickname);
      if (typeof result === 'string') {
        const msgs: Record<string, string> = {
          ROOM_NOT_FOUND: 'Room not found.',
          ALREADY_IN_ROOM: 'You are already in this room.',
          ROOM_FULL: 'Room is full.',
        };
        socket.emit('room_error', { code: result as 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'ALREADY_IN_ROOM', message: msgs[result] ?? result });
        return;
      }

      const room = result;
      const joiner = room.players.find((p) => p.playerToken === playerToken)!;
      { const joinProf = profiles.get(playerToken); joiner.avatarId = joinProf?.avatarId; joiner.nameColor = joinProf?.nameColor; joiner.avatarFrame = joinProf?.avatarFrame; }
      socket.join(code);
      addPresence(code, joiner.index, socket.id);

      // Nexus Clash: inject joiner's deck into gameConfig.playerDecks
      if (room.gameId === 'nexusclash' && ncDeckCards && Array.isArray(ncDeckCards)) {
        const cfg = (room.gameConfig ?? {}) as { playerDecks?: Record<string, string[]> };
        if (!cfg.playerDecks) cfg.playerDecks = {};
        cfg.playerDecks[playerToken] = ncDeckCards;
        room.gameConfig = cfg;
      }

      // Initialize game state when the room reaches minPlayers for the first time.
      // Liarsbar uses a lobby phase — state is created immediately but the host
      // must send lb_start to begin dealing cards.
      if (!room.state && room.players.length >= room.minPlayers) {
        const playerIds = room.players
          .slice()
          .sort((a, b) => a.index - b.index)
          .map((p) => p.playerToken);
        const engine = engineRegistry[room.gameId];
        const startingPlayerIndex = Math.floor(Math.random() * playerIds.length);
        const state = engine.initialState(playerIds, startingPlayerIndex, room.gameConfig);
        // For timed chess: delay clock start until after the countdown finishes
        if ((state as { timed?: boolean }).timed) {
          (state as { lastMoveAt?: number }).lastMoveAt = Date.now() + COUNTDOWN_MS;
        }
        room.state = state;
        startTickLoop(io, room.code);
      }
      // For liarsbar, update the lobby state when new players join
      if (room.state && room.gameId === 'liarsbar') {
        const lbState = room.state as import('shared').LiarsBarState;
        if (lbState.phase === 'lobby' && !lbState.players.some(p => p.id === playerToken)) {
          lbState.players.push({
            id: playerToken,
            lives: 3,
            handCount: 0,
            eliminated: false,
          });
          lbState.hands.push([]);
        }
      }
      // For uno, update the lobby state when new players join
      if (room.state && room.gameId === 'uno') {
        const unoState = room.state as import('shared').UnoState;
        if (unoState.phase === 'lobby' && !unoState.playerIds.includes(playerToken)) {
          const joinNick = profiles.get(playerToken)?.nickname ?? nickname;
          unoState.playerIds.push(playerToken);
          unoState.players.push({
            token: playerToken,
            nickname: joinNick,
            handCount: 0,
            calledUno: false,
            matchScore: 0,
          });
          unoState.hands.push([]);
        }
      }
      // For curvefever, update the lobby state when new players join
      if (room.state && room.gameId === 'curvefever') {
        const cfState = room.state as import('shared').CurveFeverState;
        if (cfState.phase === 'lobby' && !cfState.playerIds.includes(playerToken)) {
          const joinNick = profiles.get(playerToken)?.nickname ?? nickname;
          const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
          cfState.playerIds.push(playerToken);
          cfState.players.push({
            token: playerToken,
            nickname: joinNick,
            x: 0, y: 0,
            angle: 0,
            alive: true,
            score: 0,
            color: colors[cfState.players.length % colors.length],
            inGap: false,
            steering: 'none',
            effects: [],
            hasShield: false,
          });
          cfState.trails.push([]);
          cfState.gapCounters.push(0);
          cfState.gapRemaining.push(0);
        }
      }

      socket.emit('room_joined', {
        roomCode: code,
        gameId: room.gameId,
        playerIndex: joiner.index,
        isSpectator: false,
        isPublic: room.visibility === 'public',
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        spectatorCount: room.spectators.size,
        state: room.state
          ? projectGameState(room.gameId, room.state, { playerIndex: joiner.index, isSpectator: false })
          : null,
        players: roomPlayers(room),
      });
      socket.emit('chat_history', { scope: 'room', messages: roomChats.get(code) ?? [] });
      // Notify all existing players about the new joiner
      emitPlayerJoined(io, room, playerToken, socket.id);
      socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: code, isPublic: room.visibility === 'public' });
      broadcastPresence(io);
      if (room.visibility === 'public') broadcastOpenRooms(io);
      emitRoomReady(io, room);
      tryStartCountdown(io, room);
      console.log(`[room] ${socket.id} joined ${code} as player ${joiner.index}`);
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
      isPublic: room.visibility === 'public',
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      spectatorCount: room.spectators.size,
      state: room.state
        ? projectGameState(room.gameId, room.state, { playerIndex: null, isSpectator: true })
        : null,
      players: roomPlayers(room),
    });
    socket.emit('chat_history', { scope: 'room', messages: roomChats.get(code) ?? [] });
    io.to(code).emit('spectator_count_changed', { spectatorCount: room.spectators.size });
    socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: code, isPublic: room.visibility === 'public' });
    broadcastPresence(io);
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
    const engine = engineRegistry[room.gameId];
    const isSimultaneous = engine.simultaneousInput === true;

    // Skip rate limiter for simultaneous-input games (players send rapid steering changes)
    if (!isSimultaneous && !rateLimiter.check(socket.id)) {
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

    // Handle Nexus Clash emotes without touching game state
    if (room.gameId === 'nexusclash' && action.type === 'nc_emote') {
      socket.to(room.code).emit('nc_emote', { emoteId: (action as { emoteId: string }).emoteId, playerIndex: player.index });
      return;
    }

    // Sanity guard: skip turn-order check for simultaneous-input games
    if (!isSimultaneous) {
      const connectedTokens = new Set(room.players.map((p) => p.playerToken));
      const turnToken = 'currentTurn' in currentState
        ? currentState.currentTurn
        : currentState.currentPlayer;
      if (!connectedTokens.has(turnToken)) {
        console.error(`[sanity] ${code}: turn token ${turnToken} not in connected players ${[...connectedTokens].join(',')}, re-syncing`);
        emitGameState(io, room, currentState);
        return;
      }
    }

    try {
      const prevStatus = currentState.status;
      const nextState = engine.applyAction(currentState, action, {
        playerId: player.playerToken,
        playerIndex: player.index,
      });
      room.state = nextState;
      // Start tick loop when a real-time game transitions out of lobby
      if (engine.tick && engine.tickInterval && 'phase' in nextState) {
        const prevPhase = 'phase' in currentState ? (currentState as { phase: string }).phase : undefined;
        const nextPhase = (nextState as { phase: string }).phase;
        if (prevPhase === 'lobby' && nextPhase !== 'lobby') {
          startTickLoop(io, room.code);
        }
      }
      emitGameState(io, room, nextState);

      // Sync bot config for curvefever rematch support
      if (room.gameId === 'curvefever' && (action.type === 'CF_ADD_BOT' || action.type === 'CF_REMOVE_BOT')) {
        const cfState = nextState as import('shared').CurveFeverState;
        if (!room.gameConfig) room.gameConfig = {};
        (room.gameConfig as Record<string, unknown>).bots = cfState.bots;
      }

      // Record result and broadcast updated stats when a game just ended
      if (prevStatus === 'ongoing' && nextState.status !== 'ongoing') {
        let result: { winner: 0 | 1 } | { draw: true };
        if (nextState.status === 'draw') {
          result = { draw: true };
          // Record draw for both players
          const [p0, p1] = room.players.slice().sort((a, b) => a.index - b.index);
          if (p0 && p1) {
            recordDraw(p0.playerToken, p0.nickname, p1.playerToken, p1.nickname, room.gameId);
          }
        } else {
          // Both TicTacToeState and Connect4State have players[].id and winner
          const winnerIdx = nextState.players.findIndex((p: { id: string }) => p.id === nextState.winner);
          result = { winner: (winnerIdx === 1 ? 1 : 0) as 0 | 1 };

          // Record win/loss in leaderboard (winner token = nextState.winner = playerToken)
          const winnerToken = nextState.winner as string;
          const winnerPlayer = room.players.find((p) => p.playerToken === winnerToken);
          const winnerNickname = winnerPlayer?.nickname ?? profiles.get(winnerToken)?.nickname ?? 'Unknown';
          const loserPlayer = room.players.find((p) => p.playerToken !== winnerToken);
          const loserToken = loserPlayer?.playerToken ?? '';
          const loserNickname = loserPlayer?.nickname ?? (loserToken ? profiles.get(loserToken)?.nickname : undefined) ?? 'Unknown';
          recordMatchResult(winnerToken, winnerNickname, loserToken, loserNickname, room.gameId);
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

        // Broadcast win announcement to global chat
        if (!('draw' in result)) {
          const winnerToken = nextState.winner as string;
          const winnerNick = room.players.find((p) => p.playerToken === winnerToken)?.nickname
            ?? profiles.get(winnerToken)?.nickname ?? 'Unknown';
          const opponents = room.players
            .filter((p) => p.playerToken !== winnerToken)
            .map((p) => p.nickname);
          const gameName = GAME_DISPLAY_NAMES[room.gameId] ?? room.gameId;
          const oppText = opponents.length > 0 ? ` gegen ${opponents.join(', ')}` : '';
          const sysMsg: ChatMessage = {
            id: randomUUID(),
            scope: 'global',
            playerToken: 'system',
            nickname: 'System',
            message: `🏆 ${winnerNick} hat ${gameName}${oppText} gewonnen!`,
            ts: Date.now(),
            system: true,
          };
          pushGlobalChat(sysMsg);
          io.to('global').emit('chat_message', { message: sysMsg });
        }

        // Check if this is a tournament match
        if (room.gameConfig?._tournamentId && room.gameConfig?._matchId) {
          const tId = room.gameConfig._tournamentId as string;
          if (!('draw' in result)) {
            const tWinnerToken = nextState.winner as string;
            if (tWinnerToken) {
              const tResult = tournamentManager.reportMatchResult(tId, room.code, tWinnerToken);
              if (typeof tResult !== 'string') {
                io.to(`tournament:${tId}`).emit('tournament_state', { tournament: tResult.tournament });
                // Start newly ready matches
                for (const readyMatch of tResult.readyMatches) {
                  startTournamentMatch(io, tournamentManager, tId, readyMatch);
                }
              }
            }
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
    // Count bots (if any) toward the player total for minPlayers check
    const botCount = (room.gameConfig as Record<string, unknown> | undefined)?.bots
      ? (((room.gameConfig as Record<string, unknown>).bots) as unknown[]).length
      : 0;
    if (room.players.length + botCount < room.minPlayers) {
      socket.emit('rematch_error', { code: 'OPPONENT_DISCONNECTED', message: 'Not enough players connected.' });
      return;
    }
    if (room.rematchVotes.has(player.index)) {
      socket.emit('rematch_error', { code: 'ALREADY_VOTED', message: 'You already requested a rematch.' });
      return;
    }

    // With bots, a single human player's vote is enough for rematch
    const result = roomManager.voteRematch(socket.id);
    if (!result) return;

    if (result.ready) {
      const engine = engineRegistry[room.gameId];
      const playerIds = room.players
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((p) => p.playerToken);
      const startingPlayerIndex = Math.floor(Math.random() * playerIds.length);
      const state = engine.initialState(playerIds, startingPlayerIndex, room.gameConfig);
      // For timed chess: delay clock start until after the countdown finishes
      if ((state as { timed?: boolean }).timed) {
        (state as { lastMoveAt?: number }).lastMoveAt = Date.now() + COUNTDOWN_MS;
      }
      room.state = state;
      room.rematchVotes.clear();
      startTickLoop(io, room.code);
      emitRematchStarted(io, room, state);
      console.log(`[rematch] ${code} restarted`);
    } else {
      io.to(code).emit('rematch_requested', { votes: result.votes });
    }
  });

  // ── return_to_lobby ──────────────────────────────────────────────────────
  socket.on('return_to_lobby', ({ roomCode }) => {
    const code = roomCode.toUpperCase().trim();
    const room = roomManager.getRoom(code);
    if (!room || roomManager.isSpectator(socket.id)) return;
    const player = roomManager.getPlayer(room, socket.id);
    if (!player) return;

    if (!room.state || room.state.status === 'ongoing') {
      socket.emit('rematch_error', { code: 'GAME_NOT_OVER', message: 'The game is still in progress.' });
      return;
    }

    // Stop any tick loop
    stopTickLoop(room.code);

    room.rematchVotes.clear();

    // Re-create initial state in lobby phase (preserves settings/bots via gameConfig)
    const engine = engineRegistry[room.gameId];
    const playerTokens = room.players
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((p) => p.playerToken);
    const newState = engine.initialState(playerTokens, undefined, room.gameConfig ?? undefined);
    room.state = newState;

    // Notify all players to return to lobby/waiting phase, then send fresh lobby state
    io.to(code).emit('returned_to_lobby', { roomCode: code });
    emitGameState(io, room, newState);
    emitRoomReady(io, room);
    console.log(`[lobby] ${code} returned to lobby`);
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
  socket.on('quick_play', ({ gameId, playerToken, nickname: rawNickname }) => {
    const nickname = safeNickname(rawNickname);
    identifiedTokens.set(socket.id, playerToken);
    nicknameMap.set(socket.id, nickname);
    if (!profiles.has(playerToken)) profiles.set(playerToken, { nickname });

    // Validate gameId
    if (!(gameId in engineRegistry)) {
      socket.emit('room_error', { code: 'INVALID_GAME', message: 'Unknown game.' });
      return;
    }

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
      if (waitingRoom && waitingRoom.players.length < waitingRoom.maxPlayers) {
        const result = roomManager.joinAsPlayer(entry.roomCode, socket.id, playerToken, nickname);
        if (typeof result !== 'string') {
          const room = result;
          const joiner = room.players.find((p) => p.playerToken === playerToken)!;
          { const qpJoinProf = profiles.get(playerToken); joiner.avatarId = qpJoinProf?.avatarId; joiner.nameColor = qpJoinProf?.nameColor; joiner.avatarFrame = qpJoinProf?.avatarFrame; }

          // Remove from queue once room has enough players to start
          if (room.players.length >= room.minPlayers) {
            quickPlayQueue.delete(gameId);
            broadcastOpenRooms(io);
          }

          // Initialize game when minPlayers reached (first time)
          if (!room.state && room.players.length >= room.minPlayers) {
            const playerIds = room.players
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((p) => p.playerToken);
            const startingPlayerIndex = Math.floor(Math.random() * playerIds.length);
            const qpState = engineRegistry[room.gameId].initialState(playerIds, startingPlayerIndex, room.gameConfig);
            if ((qpState as { timed?: boolean }).timed) {
              (qpState as { lastMoveAt?: number }).lastMoveAt = Date.now() + COUNTDOWN_MS;
            }
            room.state = qpState;
            startTickLoop(io, room.code);
          }
          // For liarsbar, add the new player to the lobby state
          if (room.state && room.gameId === 'liarsbar') {
            const lbState = room.state as import('shared').LiarsBarState;
            if (lbState.phase === 'lobby' && !lbState.players.some(p => p.id === playerToken)) {
              lbState.players.push({
                id: playerToken,
                lives: 3,
                handCount: 0,
                eliminated: false,
              });
              lbState.hands.push([]);
            }
          }
          // For uno, add the new player to the lobby state
          if (room.state && room.gameId === 'uno') {
            const unoState = room.state as import('shared').UnoState;
            if (unoState.phase === 'lobby' && !unoState.playerIds.includes(playerToken)) {
              const joinNick = profiles.get(playerToken)?.nickname ?? nickname;
              unoState.playerIds.push(playerToken);
              unoState.players.push({
                token: playerToken,
                nickname: joinNick,
                handCount: 0,
                calledUno: false,
                matchScore: 0,
              });
              unoState.hands.push([]);
            }
          }

          socket.join(entry.roomCode);
          addPresence(room.code, joiner.index, socket.id);
          socket.emit('room_joined', {
            roomCode: entry.roomCode,
            gameId: room.gameId,
            playerIndex: joiner.index,
            isSpectator: false,
            isPublic: room.visibility === 'public',
            playerCount: room.players.length,
            maxPlayers: room.maxPlayers,
            spectatorCount: room.spectators.size,
            state: room.state
              ? projectGameState(room.gameId, room.state, { playerIndex: joiner.index, isSpectator: false })
              : null,
            players: roomPlayers(room),
          });
          socket.emit('chat_history', { scope: 'room', messages: roomChats.get(entry.roomCode) ?? [] });
          socket.emit('quick_play_joined', { roomCode: entry.roomCode });
          // Notify all existing players
          emitPlayerJoined(io, room, playerToken, socket.id);
          socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: entry.roomCode, isPublic: room.visibility === 'public' });
          broadcastPresence(io);
          emitRoomReady(io, room);
          tryStartCountdown(io, room);
          console.log(`[quick-play] ${socket.id} joined ${entry.roomCode} (${gameId})`);
          return;
        }
      }
      // Stale entry — clear it and fall through to create
      quickPlayQueue.delete(gameId);
      broadcastOpenRooms(io);
    }

    // No waiting room — create one and enter the queue
    const cap = getGameCapacity(gameId);
    const room = roomManager.createRoom(socket.id, playerToken, gameId, nickname, 'public', undefined, undefined, cap.min, cap.max);
    { const qpCreator = room.players.find((p) => p.playerToken === playerToken); if (qpCreator) { const qpProf = profiles.get(playerToken); qpCreator.avatarId = qpProf?.avatarId; qpCreator.nameColor = qpProf?.nameColor; qpCreator.avatarFrame = qpProf?.avatarFrame; } }
    // Liarsbar: create lobby-phase state immediately
    if (gameId === 'liarsbar') {
      room.state = engineRegistry[gameId].initialState([playerToken], 0, room.gameConfig);
    }
    quickPlayQueue.set(gameId, { roomCode: room.code, gameId, hostNickname: nickname, createdAt: Date.now() });
    broadcastOpenRooms(io);
    socket.join(room.code);
    addPresence(room.code, 0, socket.id);
    socket.emit('room_created', {
      roomCode: room.code,
      playerIndex: 0,
      gameId: room.gameId,
      players: roomPlayers(room),
      maxPlayers: room.maxPlayers,
    });
    socket.emit('chat_history', { scope: 'room', messages: [] });
    socket.emit('quick_play_joined', { roomCode: room.code });
    socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: room.code, isPublic: room.visibility === 'public' });
    broadcastPresence(io);
    console.log(`[quick-play] ${socket.id} waiting in ${room.code} (${gameId})`);
  });

  // ── leave_room ────────────────────────────────────────────────────────────
  socket.on('leave_room', () => {
    handleLeave(true);
  });

  // ── set_nickname ──────────────────────────────────────────────────────────
  socket.on('set_nickname', ({ nickname, avatarId, nameColor, avatarFrame, cosmetics }) => {
    const token = identifiedTokens.get(socket.id);
    if (!token) return;

    const clean = sanitizeNickname(nickname);
    if (!clean) {
      socket.emit('chat_error', { message: 'Nickname must be 2–16 characters (letters, numbers, spaces, _ or -).' });
      return;
    }

    const prof = profiles.get(token) ?? { nickname: clean };
    prof.nickname = clean;
    if (avatarId !== undefined) prof.avatarId = avatarId;
    if (nameColor !== undefined) prof.nameColor = nameColor || undefined;
    if (avatarFrame !== undefined) prof.avatarFrame = avatarFrame || undefined;
    applyCosmetics(prof, cosmetics);
    profiles.set(token, prof);
    nicknameMap.set(socket.id, clean);
    updateNickname(token, clean);
    const profCosmetics = buildCosmetics(prof);
    socket.emit('nickname_set', { nickname: clean, avatarId: prof.avatarId, nameColor: prof.nameColor, avatarFrame: prof.avatarFrame, cosmetics: profCosmetics });

    // Sync presence
    const presEntry = presence.get(token);
    if (presEntry) {
      presEntry.nickname = clean;
      if (avatarId !== undefined) presEntry.avatarId = avatarId;
      if (nameColor !== undefined) presEntry.nameColor = nameColor || undefined;
      if (avatarFrame !== undefined) presEntry.avatarFrame = avatarFrame || undefined;
      applyCosmetics(presEntry, cosmetics);
      broadcastPresence(io);
    }

    // Update in any room the player is currently in
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      const player = roomManager.getPlayer(room, socket.id);
      if (player) {
        player.nickname = clean;
        if (avatarId !== undefined) player.avatarId = avatarId;
        if (nameColor !== undefined) player.nameColor = nameColor || undefined;
        if (avatarFrame !== undefined) player.avatarFrame = avatarFrame || undefined;
        applyCosmetics(player, cosmetics);
        io.to(room.code).emit('room_profile', { playerToken: token, nickname: clean, avatarId: prof.avatarId, nameColor: prof.nameColor, avatarFrame: prof.avatarFrame, cosmetics: profCosmetics });
      }
    }
  });

  // ── chat_send ─────────────────────────────────────────────────────────────
  socket.on('chat_send', ({ scope, roomCode: targetRoom, message }) => {
    const token = identifiedTokens.get(socket.id);
    if (!token) return;

    const clean = sanitizeMessage(message);
    if (!clean) {
      socket.emit('chat_error', { message: 'Message cannot be empty.' });
      return;
    }

    if (!canChat(token)) {
      socket.emit('chat_error', { message: 'You are sending messages too fast. Please wait.' });
      return;
    }

    const profile = profiles.get(token);
    const nickname = profile?.nickname ?? nicknameMap.get(socket.id) ?? 'Unknown';

    const presEntry = presence.get(token);
    const msg: ChatMessage = {
      id: randomUUID(),
      scope,
      playerToken: token,
      nickname,
      message: clean,
      ts: Date.now(),
      avatarId: profile?.avatarId,
      nameColor: profile?.nameColor,
      avatarFrame: profile?.avatarFrame,
      cosmetics: profile ? buildCosmetics(profile) : undefined,
      level: presEntry?.level,
    };

    // Mark spectator messages so clients can display a badge
    if (scope === 'room' && roomManager.isSpectator(socket.id)) {
      msg.isSpectator = true;
    }

    if (scope === 'global') {
      pushGlobalChat(msg);
      io.to('global').emit('chat_message', { message: msg });
    } else {
      // Room-scoped message
      const code = (targetRoom?.toUpperCase().trim()) || roomManager.getRoomBySocket(socket.id)?.code;
      if (!code) {
        socket.emit('chat_error', { message: 'You are not in a room.' });
        return;
      }
      if (!socket.rooms.has(code)) {
        socket.emit('chat_error', { message: 'Not authorised to chat in that room.' });
        return;
      }
      msg.roomCode = code;
      let buf = roomChats.get(code);
      if (!buf) { buf = []; roomChats.set(code, buf); }
      buf.push(msg);
      if (buf.length > ROOM_CHAT_BUF) buf.shift();
      io.to(code).emit('chat_message', { message: msg });
    }
  });

  // ── get_online_users ──────────────────────────────────────────────────────
  socket.on('get_online_users', () => {
    socket.emit('online_users', { users: buildPresenceList() });
  });

  // ── presence_update ────────────────────────────────────────────────────────
  socket.on('presence_update', ({ activity }) => {
    if (!activity || typeof activity.kind !== 'string') return;
    socketActivity.set(socket.id, activity);
    broadcastPresence(io);
  });

  // ── leaderboard_get ───────────────────────────────────────────────────────
  socket.on('leaderboard_get', ({ mode, gameId }) => {
    const lbMode = (mode === 'game' ? 'game' : 'overall') as LeaderboardMode;
    const myToken = identifiedTokens.get(socket.id);
    socket.emit('leaderboard_data', {
      mode: lbMode,
      gameId,
      entries: getEntries(lbMode, gameId, myToken),
    });
  });

  // ── Extracted handler modules ─────────────────────────────────────────────
  registerInviteHandlers(io, socket);
  registerPartyHandlers(io, socket, partyManager);
  registerTournamentHandlers(io, socket, tournamentManager);

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    rateLimiter.clear(socket.id);
    nicknameMap.delete(socket.id);
    socketActivity.delete(socket.id);

    // Update presence before deleting the token mapping
    const disconnectedToken = identifiedTokens.get(socket.id);
    if (disconnectedToken) {
      const presEntry = presence.get(disconnectedToken);
      if (presEntry) {
        presEntry.sockets.delete(socket.id);
        if (presEntry.sockets.size === 0) presence.delete(disconnectedToken);
      }
      broadcastPresence(io);
    }

    identifiedTokens.delete(socket.id);
    handleLeave(false);
  });

  function handleLeave(explicit = false) {
    const result = roomManager.removeSocket(socket.id);
    if (!result) return;

    const { room } = result;
    socket.leave(room.code);

    // Reset activity to game-page level (they're still on the page, just not in a room)
    const curActivity = socketActivity.get(socket.id);
    if (curActivity?.kind === 'room') {
      socketActivity.set(socket.id, { kind: 'game', gameId: room.gameId });
      broadcastPresence(io);
    }

    if (result.type === 'player') {
      // Update game-socket presence before broadcasting
      removePresence(room.code, result.player.index, socket.id);
      emitRoomReady(io, room);

      if (explicit) {
        // Player intentionally left — cancel their reconnect grace period
        roomManager.cancelEviction(result.player.playerToken);
        io.to(room.code).emit('player_left', {
          playerId: socket.id,
          playerIndex: result.player.index,
          playerCount: room.players.length,
        });
      } else {
        // Network disconnect — give them time to reconnect
        io.to(room.code).emit('player_disconnected', {
          playerIndex: result.player.index,
          playerCount: room.players.length,
          gracePeriodMs: PLAYER_RECONNECT_MS,
        });
      }

      // Remove from quick-play queue if this was the waiting room and it's now empty
      if (room.players.length === 0) {
        dropFromQuickPlayQueue(room.code);
      }
      // Broadcast updated public list (covers both quick-play and custom public rooms)
      if (room.visibility === 'public') broadcastOpenRooms(io);
    } else {
      // Spectator left
      io.to(room.code).emit('spectator_count_changed', { spectatorCount: room.spectators.size });
    }

    console.log(`[room] ${socket.id} ${explicit ? 'left' : 'disconnected from'} ${room.code} (${result.type})`);
  }
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`ws server → http://0.0.0.0:${PORT}  (CORS: ${WS_CORS_ORIGIN})`);
});
