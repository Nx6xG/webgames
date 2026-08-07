import type { GameId } from 'shared';
import type { GameServer, GameSocket } from './serverTypes.js';
import type { TournamentManager } from './tournament.js';
import { roomManager } from './rooms.js';
import { engineRegistry } from './engineRegistry.js';
import { getGameCapacity } from './gameCapacity.js';
import { identifiedTokens } from './chatState.js';

function findSocketsByToken(token: string): string[] {
  const sids: string[] = [];
  for (const [sid, t] of identifiedTokens) {
    if (t === token) sids.push(sid);
  }
  return sids;
}

export function startTournamentMatch(
  io: GameServer,
  tournamentManager: TournamentManager,
  tournamentId: string,
  match: { id: string; round: number; player1: string | null; player2: string | null },
) {
  if (!match.player1 || !match.player2) return;

  const tournament = tournamentManager.get(tournamentId);
  if (!tournament) return;

  const cap = getGameCapacity(tournament.config.gameId);

  // Find sockets for player1 so we can create the room under their socket
  const p1Sockets = findSocketsByToken(match.player1);
  const p1Sid = p1Sockets[0];
  if (!p1Sid) {
    console.log(`[tournament] no socket found for player1 ${match.player1.slice(0, 8)} in match ${match.id}`);
    return;
  }

  const p1 = tournament.players.find(p => p.token === match.player1);
  const p2 = tournament.players.find(p => p.token === match.player2);

  const room = roomManager.createRoom(
    p1Sid,
    match.player1,
    tournament.config.gameId,
    p1?.nickname ?? 'Player 1',
    'private',
    `${tournament.config.name} R${match.round + 1}`,
    {
      ...tournament.config.gameConfig,
      _tournamentId: tournamentId,
      _matchId: match.id,
    },
    cap.min,
    cap.max,
  );

  tournamentManager.startMatch(tournamentId, match.id, room.code);

  // Join player1's socket to the room channel
  const p1Sock = io.sockets.sockets.get(p1Sid);
  if (p1Sock) {
    p1Sock.join(room.code);
    p1Sock.emit('tournament_match_ready', {
      tournamentId,
      matchId: match.id,
      roomCode: room.code,
      opponent: { token: p2?.token ?? '', nickname: p2?.nickname ?? 'TBD' },
    });
  }

  // Notify player2 to join
  const p2Sockets = findSocketsByToken(match.player2!);
  for (const sid of p2Sockets) {
    const sock = io.sockets.sockets.get(sid);
    sock?.emit('tournament_match_ready', {
      tournamentId,
      matchId: match.id,
      roomCode: room.code,
      opponent: { token: p1?.token ?? '', nickname: p1?.nickname ?? 'TBD' },
    });
  }

  console.log(`[tournament] match ${match.id.slice(0, 8)} started → room ${room.code} (${p1?.nickname} vs ${p2?.nickname})`);
}

export function registerTournamentHandlers(io: GameServer, socket: GameSocket, tournamentManager: TournamentManager) {
  socket.on('tournament_create', ({ playerToken, nickname, gameId, bracketSize, name, gameConfig }: {
    playerToken: string; nickname: string; gameId: string; bracketSize: number; name: string; gameConfig?: Record<string, unknown>;
  }) => {
    if (!(gameId in engineRegistry)) {
      socket.emit('tournament_error', { code: 'INVALID_GAME', message: 'Unknown game.' });
      return;
    }
    if (tournamentManager.countOpenByCreator(playerToken) >= 2) {
      socket.emit('tournament_error', { code: 'RATE_LIMITED', message: 'Du hast bereits 2 offene Turniere. Beende oder verlasse eines zuerst.' });
      return;
    }
    const cleanName = String(name ?? '').trim().slice(0, 40) || 'Turnier';
    const validBracketSize = ([4, 8, 16].includes(bracketSize) ? bracketSize : 8) as 4 | 8 | 16;
    const tournament = tournamentManager.create({
      gameId: gameId as GameId, bracketSize: validBracketSize, name: cleanName, createdBy: playerToken, gameConfig,
    });
    // Creator auto-joins
    tournamentManager.join(tournament.id, playerToken, nickname);
    socket.join(`tournament:${tournament.id}`);
    socket.emit('tournament_created', { tournamentId: tournament.id });
    socket.emit('tournament_state', { tournament: tournamentManager.get(tournament.id)! });
    // Broadcast updated list
    io.emit('tournament_list', { tournaments: tournamentManager.list() });
  });

  socket.on('tournament_join', ({ playerToken, nickname, tournamentId }: {
    playerToken: string; nickname: string; tournamentId: string;
  }) => {
    const result = tournamentManager.join(tournamentId, playerToken, nickname);
    if (typeof result === 'string') {
      socket.emit('tournament_error', { code: result, message: result });
      return;
    }
    socket.join(`tournament:${tournamentId}`);
    socket.emit('tournament_joined', { tournamentId });
    io.to(`tournament:${tournamentId}`).emit('tournament_state', { tournament: result });
    io.emit('tournament_list', { tournaments: tournamentManager.list() });
  });

  socket.on('tournament_leave', ({ playerToken, tournamentId }: {
    playerToken: string; tournamentId: string;
  }) => {
    const result = tournamentManager.leave(tournamentId, playerToken);
    socket.leave(`tournament:${tournamentId}`);
    if (typeof result === 'string') {
      if (result === 'TOURNAMENT_DELETED') {
        io.to(`tournament:${tournamentId}`).emit('tournament_error', { code: 'TOURNAMENT_DELETED', message: 'Tournament was deleted.' });
        io.emit('tournament_list', { tournaments: tournamentManager.list() });
      } else {
        socket.emit('tournament_error', { code: result, message: result });
      }
      return;
    }
    io.to(`tournament:${tournamentId}`).emit('tournament_state', { tournament: result });
    io.emit('tournament_list', { tournaments: tournamentManager.list() });
  });

  socket.on('tournament_start', ({ playerToken, tournamentId }: {
    playerToken: string; tournamentId: string;
  }) => {
    const result = tournamentManager.start(tournamentId, playerToken);
    if (typeof result === 'string') {
      socket.emit('tournament_error', { code: result, message: result });
      return;
    }
    io.to(`tournament:${tournamentId}`).emit('tournament_state', { tournament: result });

    // Start ready matches (first round)
    const readyMatches = tournamentManager.getReadyMatches(tournamentId);
    for (const match of readyMatches) {
      startTournamentMatch(io, tournamentManager, tournamentId, match);
    }
  });

  socket.on('tournament_list', () => {
    socket.emit('tournament_list', { tournaments: tournamentManager.list() });
  });

  socket.on('tournament_get', ({ tournamentId }: { tournamentId: string }) => {
    const t = tournamentManager.get(tournamentId);
    if (!t) {
      socket.emit('tournament_error', { code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found.' });
      return;
    }
    socket.join(`tournament:${tournamentId}`);
    socket.emit('tournament_state', { tournament: t });
  });
}
