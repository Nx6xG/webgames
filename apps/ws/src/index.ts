import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from 'shared';
import { roomManager } from './rooms.js';
import { engineRegistry } from './engineRegistry.js';
import { rateLimiter } from './rateLimiter.js';
import { getStats, getAllStats, recordResult } from './stats.js';
import { addMatch, getHistory } from './matchHistory.js';
import { recordMatchResult, recordDraw, updateNickname, getEntries } from './leaderboard.js';
import type { RoomPlayerInfo, OpenRoomInfo, PublicRoomListItem, GameId, Match, ActionErrorCode, ChatMessage, LeaderboardMode, AnyGameState, InvitePayload, PresenceActivity, CosmeticsSelection } from 'shared';
import type { Room } from './rooms.js';
import { projectGameState } from './stateProjection.js';
import { PartyManager } from './parties.js';
import { getGameCapacity } from './gameCapacity.js';
import { InMemoryStorage } from './storage/inMemory.js';
import type { Storage } from './storage/types.js';

const storage: Storage = new InMemoryStorage();
const partyManager = new PartyManager();

// ── Cosmetics helpers ─────────────────────────────────────────────────────────

function buildCosmetics(p: { avatarId?: string; nameColor?: string; avatarFrame?: string; banner?: string; cardColor?: string; badges?: string[] }): CosmeticsSelection {
  return { avatarId: p.avatarId, nameColor: p.nameColor, slots: { frame: p.avatarFrame, banner: p.banner, cardColor: p.cardColor }, badges: p.badges };
}

function applyCosmetics(target: { avatarId?: string; nameColor?: string; avatarFrame?: string; banner?: string; cardColor?: string; badges?: string[] }, c?: CosmeticsSelection) {
  if (!c) return;
  if (c.avatarId !== undefined) target.avatarId = c.avatarId;
  if (c.nameColor !== undefined) target.nameColor = c.nameColor;
  if (c.slots?.frame !== undefined) target.avatarFrame = c.slots.frame;
  if (c.slots?.banner !== undefined) target.banner = c.slots.banner;
  if (c.slots?.cardColor !== undefined) target.cardColor = c.slots.cardColor;
  if (c.badges !== undefined) target.badges = c.badges;
}

function roomPlayers(room: Room): RoomPlayerInfo[] {
  return room.players
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((p) => ({ index: p.index, nickname: p.nickname, avatarId: p.avatarId, nameColor: p.nameColor, avatarFrame: p.avatarFrame, cosmetics: buildCosmetics(p) }));
}

const COUNTDOWN_MS = 3000;

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
};

/** Per-gameId matchmaking queue: gameId → waiting room info */
const quickPlayQueue = new Map<GameId, OpenRoomInfo>();

// ── Tick loop management (real-time games like Curve Fever) ─────────────────

const tickTimers = new Map<string, ReturnType<typeof setInterval>>();

function startTickLoop(roomCode: string) {
  if (tickTimers.has(roomCode)) return; // already running
  const room = roomManager.getRoom(roomCode);
  if (!room?.state) return;
  const engine = engineRegistry[room.gameId];
  if (!engine.tick || !engine.tickInterval) return;

  const interval = setInterval(() => {
    const r = roomManager.getRoom(roomCode);
    if (!r?.state) { stopTickLoop(roomCode); return; }
    const newState = engine.tick!(r.state);
    r.state = newState;
    emitGameState(r, newState);
    const st = engine.getStatus(newState);
    if (st.status !== 'ongoing') {
      stopTickLoop(roomCode);
    }
  }, engine.tickInterval);

  tickTimers.set(roomCode, interval);
}

function stopTickLoop(roomCode: string) {
  const timer = tickTimers.get(roomCode);
  if (timer) { clearInterval(timer); tickTimers.delete(roomCode); }
}

/** socketId → nickname for all identified sockets */
const nicknameMap = new Map<string, string>();

// ── Presence (online users) ───────────────────────────────────────────────────

/** playerToken → { nickname, avatarId, nameColor, sockets: Set of active socketIds } */
const presence = new Map<string, { nickname: string; avatarId?: string; nameColor?: string; avatarFrame?: string; banner?: string; cardColor?: string; badges?: string[]; userId?: string; sockets: Set<string> }>();

/** socketId → current activity for that socket */
const socketActivity = new Map<string, PresenceActivity>();

/** Priority: room > game > home. Pick the most specific activity across all sockets for a token. */
function bestActivity(sockets: Set<string>): PresenceActivity | undefined {
  let best: PresenceActivity | undefined;
  let bestRank = -1;
  for (const sid of sockets) {
    const a = socketActivity.get(sid);
    if (!a) continue;
    const rank = a.kind === 'room' ? 2 : a.kind === 'game' ? 1 : 0;
    if (rank > bestRank) { best = a; bestRank = rank; }
  }
  return best;
}

function buildPresenceList() {
  return [...presence.entries()]
    .map(([playerToken, { nickname, avatarId, nameColor, avatarFrame, banner, cardColor, badges, userId, sockets }]) => ({
      playerToken,
      nickname,
      connections: sockets.size,
      activity: bestActivity(sockets),
      avatarId,
      nameColor,
      avatarFrame,
      cosmetics: buildCosmetics({ avatarId, nameColor, avatarFrame, banner, cardColor, badges }),
      userId,
    }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, undefined, { sensitivity: 'base' }));
}

function broadcastPresence() {
  io.emit('online_users', { users: buildPresenceList() });
}

// ── Invite rate limiter ───────────────────────────────────────────────────────

/** playerToken → timestamp of last invite sent (ms) */
const inviteRateLimit = new Map<string, number>();

// ── Per-room game-socket presence ─────────────────────────────────────────────
/**
 * Tracks which players have an active GAME-PAGE socket in each room.
 * Only sockets from create_room / join_room / quick_play / identify→claimSession
 * are tracked.  The invite_create online socket is intentionally excluded so that
 * the countdown cannot start until the inviting player actually navigates to the
 * game page.
 */
/** roomCode → playerIndex → set of active socket IDs for that seat */
const roomGamePresence = new Map<string, Map<number, Set<string>>>();

function getRoomPresence(roomCode: string): Map<number, Set<string>> {
  let rp = roomGamePresence.get(roomCode);
  if (!rp) { rp = new Map(); roomGamePresence.set(roomCode, rp); }
  return rp;
}

/** Add a socket to the game-page presence for a given seat. */
function addPresence(roomCode: string, playerIndex: number, socketId: string) {
  const rp = getRoomPresence(roomCode);
  let sockets = rp.get(playerIndex);
  if (!sockets) { sockets = new Set(); rp.set(playerIndex, sockets); }
  sockets.add(socketId);
}

/** Remove a socket from game-page presence for a given seat. */
function removePresence(roomCode: string, playerIndex: number, socketId: string) {
  const rp = roomGamePresence.get(roomCode);
  if (!rp) return;
  const sockets = rp.get(playerIndex);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) rp.delete(playerIndex);
  }
}

/** Replace all sockets for a seat with a single new one (reconnect). */
function replacePresence(roomCode: string, playerIndex: number, socketId: string) {
  const rp = getRoomPresence(roomCode);
  rp.set(playerIndex, new Set([socketId]));
}

function emitRoomReady(room: Room) {
  const rp = roomGamePresence.get(room.code);
  const p0 = (rp?.get(0)?.size ?? 0) > 0;
  const p1 = (rp?.get(1)?.size ?? 0) > 0;
  io.to(room.code).emit('room_ready', { roomCode: room.code, ready: p0 && p1, players: { p0, p1 } });
}

function allSeatedPlayersPresent(room: Room): boolean {
  const rp = roomGamePresence.get(room.code);
  if (!rp) return false;
  for (const p of room.players) {
    const sockets = rp.get(p.index);
    if (!sockets || sockets.size === 0) return false;
  }
  return true;
}

function tryStartCountdown(room: Room) {
  if (room.gameId === 'liarsbar' || room.gameId === 'uno') return; // lobby games use host-start instead of countdown
  if (room.players.length < room.minPlayers) return; // not enough players yet
  if (!allSeatedPlayersPresent(room)) return; // all must be on the game page
  if (room.matchStartsAt) return; // already issued
  startCountdown(room);
}

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
    maxPlayers: room.maxPlayers,
    createdAt: room.createdAt,
    hostAvatarId: room.players[0]?.avatarId,
    hostNameColor: room.players[0]?.nameColor,
    hostAvatarFrame: room.players[0]?.avatarFrame,
    hostCosmetics: room.players[0] ? buildCosmetics(room.players[0]) : undefined,
  }));
  // Sort: joinable (has space, not empty) → empty → full; newest-first within each group
  items.sort((a, b) => {
    const pri = (item: typeof a) => {
      if (item.playerCount > 0 && item.playerCount < item.maxPlayers) return 0; // joinable
      if (item.playerCount === 0) return 1; // empty
      return 2; // full
    };
    const diff = pri(a) - pri(b);
    return diff !== 0 ? diff : b.createdAt - a.createdAt;
  });
  return items;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

/** playerToken → profile (nickname, avatar, name color) */
const profiles = new Map<string, { nickname: string; avatarId?: string; nameColor?: string; avatarFrame?: string; banner?: string; cardColor?: string; badges?: string[] }>();
/** Global chat buffer — last 100 messages */
const globalChat: ChatMessage[] = [];
/** roomCode → chat buffer — last 50 messages */
const roomChats = new Map<string, ChatMessage[]>();
/** playerToken → recent message timestamps (sliding-window rate limiter) */
const chatTimestamps = new Map<string, number[]>();
/** socketId → playerToken for ALL identified sockets (not just room players) */
const identifiedTokens = new Map<string, string>();

const CHAT_RATE_MSGS = 5;
const CHAT_RATE_WINDOW_MS = 10_000;
const GLOBAL_CHAT_BUF = 100;
const ROOM_CHAT_BUF = 50;
const MSG_MAX_LEN = 200;

function sanitizeNickname(raw: string): string | null {
  const cleaned = raw.trim().slice(0, 16);
  if (cleaned.length < 2) return null;
  if (!/^[a-zA-Z0-9 _-]+$/.test(cleaned)) return null;
  return cleaned;
}

function sanitizeMessage(raw: string): string | null {
  const cleaned = raw.trim().slice(0, MSG_MAX_LEN);
  return cleaned.length > 0 ? cleaned : null;
}

function canChat(token: string): boolean {
  const now = Date.now();
  const cutoff = now - CHAT_RATE_WINDOW_MS;
  const times = (chatTimestamps.get(token) ?? []).filter((t) => t > cutoff);
  if (times.length >= CHAT_RATE_MSGS) return false;
  times.push(now);
  chatTimestamps.set(token, times);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────

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

const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET ?? '';

function verifyAdminSecret(req: IncomingMessage): boolean {
  const auth = req.headers.authorization;
  return !!ADMIN_API_SECRET && auth === `Bearer ${ADMIN_API_SECRET}`;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
  });
}

function jsonResponse(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
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

    // Kick all sockets from the Socket.IO room before deleting
    const room = roomManager.getRoom(roomCode);
    if (room) {
      io.in(roomCode).socketsLeave(roomCode);
      io.to(roomCode).emit('room_error', { code: 'ROOM_CLOSED', message: 'Room closed by admin' });
    }

    const deleted = roomManager.forceCloseRoom(roomCode);
    if (!deleted) return jsonResponse(res, 404, { error: 'Room not found' });

    broadcastOpenRooms();
    return jsonResponse(res, 200, { ok: true });
  }

  // ── Default health check ──
  res.writeHead(200);
  res.end('ok');
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: WS_CORS_ORIGIN, methods: ['GET', 'POST'] },
});

function broadcastOpenRooms() {
  io.emit('open_rooms', { rooms: getPublicRoomList() });
}

function startCountdown(room: Room) {
  room.matchStartsAt = Date.now() + COUNTDOWN_MS;
  io.to(room.code).emit('match_starting', { startsInMs: COUNTDOWN_MS });
}

/**
 * Broadcast game_state to every socket in the room with a per-socket projected
 * state (hides opponent ship positions for Battleship; no-op for other games).
 */
function emitGameState(room: Room, state: AnyGameState) {
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

/**
 * Broadcast rematch_started to every socket in the room with per-socket projection.
 */
function emitRematchStarted(room: Room, state: AnyGameState) {
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

// ── Room-level callbacks (fired outside socket event handlers) ────────────────

roomManager.onPlayerEvicted((room, playerIndex) => {
  console.log(`[evict] player ${playerIndex} evicted from ${room.code}`);
  // Remove evicted player from liarsbar lobby state
  if (room.state && room.gameId === 'liarsbar') {
    const lbState = room.state as import('shared').LiarsBarState;
    if (lbState.phase === 'lobby') {
      // Find the token that was at this room index
      // The evicted player is already removed from room.players by this point,
      // so we need to remove them from the game state by index.
      // playerIndex corresponds to the original room seat, not game-state index.
      // Re-sync game-state players to match room.players.
      const roomTokens = new Set(room.players.map(p => p.playerToken));
      lbState.players = lbState.players.filter(p => roomTokens.has(p.id));
      lbState.hands = lbState.players.map(() => []);
      // Update currentTurn to host if needed
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
      const keepIndices = cfState.playerIds.map((t, i) => roomTokens.has(t) ? i : -1).filter(i => i >= 0);
      cfState.playerIds = keepIndices.map(i => cfState.playerIds[i]);
      cfState.players = keepIndices.map(i => cfState.players[i]);
      cfState.trails = keepIndices.map(i => cfState.trails[i]);
      cfState.gapCounters = keepIndices.map(i => cfState.gapCounters[i]);
      cfState.gapRemaining = keepIndices.map(i => cfState.gapRemaining[i]);
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
    emitGameState(room, room.state);
  }
  if (room.visibility === 'public') broadcastOpenRooms();
});

roomManager.onRoomCleaned((room) => {
  // Stop any tick loop for real-time games
  stopTickLoop(room.code);
  // Kick any remaining spectators from the Socket.IO room channel
  io.in(room.code).socketsLeave(room.code);
  if (room.visibility === 'public') broadcastOpenRooms();
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
  socket.on('identify', ({ playerToken, nickname, avatarId, nameColor, avatarFrame, cosmetics, userId }) => {
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
    socket.emit('session_info', { token: playerToken, nickname, avatarId: profile.avatarId, nameColor: profile.nameColor, avatarFrame: profile.avatarFrame, cosmetics: buildCosmetics(profile) });

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
    } else {
      presence.set(playerToken, { nickname, avatarId: profile.avatarId, nameColor: profile.nameColor, avatarFrame: profile.avatarFrame, banner: profile.banner, cardColor: profile.cardColor, badges: profile.badges, userId, sockets: new Set([socket.id]) });
    }
    broadcastPresence();

    // Push current party state to reconnecting sockets
    const existingParty = partyManager.getByToken(playerToken);
    if (existingParty) {
      const partyState = partyManager.toState(existingParty, resolvePartyMember);
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
      emitRoomReady(room);
      if (!wasReady) tryStartCountdown(room);
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
      emitGameState(room, reconnectState);
    }

    if (room.matchStartsAt && Date.now() < room.matchStartsAt) {
      socket.emit('match_starting', { startsInMs: room.matchStartsAt - Date.now() });
    }
    socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: room.code, isPublic: room.visibility === 'public' });
    broadcastPresence();
    console.log(`[rejoin] ${socket.id} → ${room.code} (player ${player.index})`);
  });

  // ── create_room ───────────────────────────────────────────────────────────
  socket.on('create_room', ({ playerToken, gameId = 'tictactoe', nickname, visibility = 'private', roomName, rpsConfig, ldConfig, battleshipConfig, cfConfig, unoConfig, maxPlayers: requestedMax }) => {
    identifiedTokens.set(socket.id, playerToken);
    nicknameMap.set(socket.id, nickname);
    if (!profiles.has(playerToken)) profiles.set(playerToken, { nickname });

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
    // Liarsbar / Curvefever: create lobby-phase state immediately so it can track players
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
    // Empty history for the brand-new room
    socket.emit('chat_history', { scope: 'room', messages: [] });
    socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: room.code, isPublic: room.visibility === 'public' });
    broadcastPresence();
    if (visibility === 'public') broadcastOpenRooms();
    console.log(`[room] created ${room.code} (${room.gameId}, ${visibility}${sanitizedName ? `: ${sanitizedName}` : ''})`);
  });

  // ── join_room ─────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomCode, playerToken, nickname }) => {
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
        emitRoomReady(room);
        if (!wasReady) tryStartCountdown(room);
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
        emitGameState(room, rejoinState);
      }
      socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: code, isPublic: room.visibility === 'public' });
      broadcastPresence();
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
        room.state = state;
      }
      // For liarsbar, update the lobby state when new players join
      // (add the new player to the game state's player list).
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
      for (const p of room.players) {
        if (p.playerToken === playerToken) continue;
        const pSock = io.sockets.sockets.get(p.socketId);
        if (pSock) {
          pSock.emit('player_joined', {
            playerId: socket.id,
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
      socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: code, isPublic: room.visibility === 'public' });
      broadcastPresence();
      if (room.visibility === 'public') broadcastOpenRooms();
      emitRoomReady(room);
      tryStartCountdown(room);
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
    broadcastPresence();
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

    // Sanity guard: skip turn-order check for simultaneous-input games
    if (!isSimultaneous) {
      const connectedTokens = new Set(room.players.map((p) => p.playerToken));
      const turnToken = 'currentTurn' in currentState
        ? currentState.currentTurn
        : currentState.currentPlayer;
      if (!connectedTokens.has(turnToken)) {
        console.error(`[sanity] ${code}: turn token ${turnToken} not in connected players ${[...connectedTokens].join(',')}, re-syncing`);
        emitGameState(room, currentState);
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
          startTickLoop(room.code);
        }
      }
      // DEV: verify liarsbar lives broadcast
      if (room.gameId === 'liarsbar' && 'players' in nextState) {
        const lbPlayers = (nextState as { players: Array<{ id: string; lives: number }> }).players;
        const sockCount = io.sockets.adapter.rooms.get(room.code)?.size ?? 0;
        console.log(`[LD broadcast] ${room.code} → ${sockCount} sockets, lives: ${lbPlayers.map(p => `${p.id.slice(0, 6)}:${p.lives}`).join(', ')}`);
      }
      emitGameState(room, nextState);

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
          globalChat.push(sysMsg);
          if (globalChat.length > GLOBAL_CHAT_BUF) globalChat.shift();
          io.to('global').emit('chat_message', { message: sysMsg });
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
    if (room.players.length < room.minPlayers) {
      socket.emit('rematch_error', { code: 'OPPONENT_DISCONNECTED', message: 'Not enough players connected.' });
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
        .map((p) => p.playerToken);
      const startingPlayerIndex = Math.floor(Math.random() * playerIds.length);
      const state = engine.initialState(playerIds, startingPlayerIndex, room.gameConfig);
      room.state = state;
      room.rematchVotes.clear();
      emitRematchStarted(room, state);
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
    identifiedTokens.set(socket.id, playerToken);
    nicknameMap.set(socket.id, nickname);
    if (!profiles.has(playerToken)) profiles.set(playerToken, { nickname });

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
            broadcastOpenRooms();
          }

          // Initialize game when minPlayers reached (first time)
          if (!room.state && room.players.length >= room.minPlayers) {
            const playerIds = room.players
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((p) => p.playerToken);
            const startingPlayerIndex = Math.floor(Math.random() * playerIds.length);
            room.state = engineRegistry[room.gameId].initialState(playerIds, startingPlayerIndex, room.gameConfig);
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
          for (const p of room.players) {
            if (p.playerToken === playerToken) continue;
            const pSock = io.sockets.sockets.get(p.socketId);
            if (pSock) {
              pSock.emit('player_joined', {
                playerId: socket.id,
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
          socketActivity.set(socket.id, { kind: 'room', gameId: room.gameId, roomCode: entry.roomCode, isPublic: room.visibility === 'public' });
          broadcastPresence();
          emitRoomReady(room);
          tryStartCountdown(room);
          console.log(`[quick-play] ${socket.id} joined ${entry.roomCode} (${gameId})`);
          return;
        }
      }
      // Stale entry — clear it and fall through to create
      quickPlayQueue.delete(gameId);
      broadcastOpenRooms();
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
    broadcastOpenRooms();
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
    broadcastPresence();
    console.log(`[quick-play] ${socket.id} waiting in ${room.code} (${gameId})`);
  });

  // ── leave_room ────────────────────────────────────────────────────────────
  socket.on('leave_room', ({ roomCode }) => {
    handleLeave(roomCode.toUpperCase().trim());
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
      broadcastPresence();
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
    };

    if (scope === 'global') {
      globalChat.push(msg);
      if (globalChat.length > GLOBAL_CHAT_BUF) globalChat.shift();
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
    broadcastPresence();
  });

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
      if (existing.visibility === 'public') broadcastOpenRooms();
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

  // ── Party events ─────────────────────────────────────────────────────────

  /** Resolve nickname/cosmetics from presence for party member list. */
  function resolvePartyMember(token: string) {
    const p = presence.get(token);
    if (!p) return undefined;
    return {
      nickname: p.nickname,
      avatarId: p.avatarId,
      cosmetics: buildCosmetics(p),
    };
  }

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
    // Leave any existing rooms for all party members first
    // Then create a room for the host
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

    // Leave existing rooms
    for (const memberToken of party.members) {
      handleLeaveForToken(memberToken);
    }

    // Create room with host (mirrors create_room handler)
    const nickname = presence.get(token)?.nickname ?? 'Player';
    const capacity = getGameCapacity(gameId);
    const effectiveMax = Math.min(party.members.length, capacity.max);
    const room = roomManager.createRoom(socket.id, token, gameId, nickname, 'private', undefined, undefined, capacity.min, effectiveMax);

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
    socketActivity.set(socket.id, { kind: 'room', gameId, roomCode: room.code });

    // Update party state
    partyManager.setRoom(party.id, gameId, room.code);

    // Emit room_created to host
    socket.emit('room_created', {
      roomCode: room.code,
      playerIndex: 0 as const,
      gameId,
      players: roomPlayers(room),
      maxPlayers: room.maxPlayers,
    });
    socket.emit('chat_history', { scope: 'room', messages: [] });

    // Notify all party members to navigate to the game
    for (const memberToken of party.members) {
      const entry = presence.get(memberToken);
      if (!entry) continue;
      for (const sid of entry.sockets) {
        io.to(sid).emit('party_game_starting', { gameId, roomCode: room.code });
      }
    }

    broadcastParty(party);
    broadcastPresence();
    console.log(`[party] host launched ${gameId} for party ${party.id} → room ${room.code}`);
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
      broadcastPresence();
    }

    identifiedTokens.delete(socket.id);
    handleLeave();
  });

  function handleLeave(explicitCode?: string) {
    const result = roomManager.removeSocket(socket.id);
    if (!result) return;

    const { room } = result;
    socket.leave(room.code);

    // Reset activity to game-page level (they're still on the page, just not in a room)
    const curActivity = socketActivity.get(socket.id);
    if (curActivity?.kind === 'room') {
      socketActivity.set(socket.id, { kind: 'game', gameId: room.gameId });
      broadcastPresence();
    }

    if (result.type === 'player') {
      // Update game-socket presence before broadcasting
      removePresence(room.code, result.player.index, socket.id);
      emitRoomReady(room);
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

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`ws server → http://0.0.0.0:${PORT}  (CORS: ${WS_CORS_ORIGIN})`);
});
