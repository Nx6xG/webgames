'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getWsUrl } from '@/lib/getWsUrl';

// Types inline to avoid import issues
interface TournamentMatch {
  id: string;
  round: number;
  position: number;
  player1: string | null;
  player2: string | null;
  winner: string | null;
  roomCode: string | null;
  status: 'pending' | 'in_progress' | 'finished';
}

interface TournamentPlayer {
  token: string;
  nickname: string;
  seed: number;
}

interface TournamentConfig {
  gameId: string;
  bracketSize: number;
  gameConfig?: Record<string, unknown>;
  name: string;
  createdBy: string;
}

interface TournamentState {
  id: string;
  config: TournamentConfig;
  status: 'lobby' | 'in_progress' | 'finished';
  players: TournamentPlayer[];
  matches: TournamentMatch[];
  rounds: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  champion: string | null;
}

interface TournamentListItem {
  id: string;
  name: string;
  gameId: string;
  status: 'lobby' | 'in_progress' | 'finished';
  bracketSize: number;
  playerCount: number;
  createdAt: number;
}

interface MatchReadyData {
  tournamentId: string;
  matchId: string;
  roomCode: string;
  opponent: { token: string; nickname: string };
}

function getPlayerToken(): string {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem('wg_player_token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('wg_player_token', token);
  }
  return token;
}

function getNickname(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('wg_nickname') || '';
}

export function useTournament() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [currentTournament, setCurrentTournament] = useState<TournamentState | null>(null);
  const [matchReady, setMatchReady] = useState<MatchReadyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wsUrl = getWsUrl();
    const socket = io(wsUrl, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      const token = getPlayerToken();
      const nick = getNickname();
      socket.emit('identify', { playerToken: token, nickname: nick });
      socket.emit('tournament_list');
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('tournament_list', (data: { tournaments: TournamentListItem[] }) => {
      setTournaments(data.tournaments);
    });

    socket.on('tournament_state', (data: { tournament: TournamentState }) => {
      setCurrentTournament(data.tournament);
    });

    socket.on('tournament_created', (_data: { tournamentId: string }) => {
      // Tournament state will come via tournament_state event
    });

    socket.on('tournament_joined', (_data: { tournamentId: string }) => {
      // Tournament state will come via tournament_state event
    });

    socket.on('tournament_match_ready', (data: MatchReadyData) => {
      setMatchReady(data);
    });

    socket.on('tournament_error', (data: { code: string; message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 5000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const create = useCallback((gameId: string, bracketSize: number, name: string, gameConfig?: Record<string, unknown>) => {
    socketRef.current?.emit('tournament_create', {
      playerToken: getPlayerToken(),
      nickname: getNickname(),
      gameId,
      bracketSize,
      name,
      gameConfig,
    });
  }, []);

  const join = useCallback((tournamentId: string) => {
    socketRef.current?.emit('tournament_join', {
      playerToken: getPlayerToken(),
      nickname: getNickname(),
      tournamentId,
    });
  }, []);

  const leave = useCallback((tournamentId: string) => {
    socketRef.current?.emit('tournament_leave', {
      playerToken: getPlayerToken(),
      tournamentId,
    });
    setCurrentTournament(null);
  }, []);

  const start = useCallback((tournamentId: string) => {
    socketRef.current?.emit('tournament_start', {
      playerToken: getPlayerToken(),
      tournamentId,
    });
  }, []);

  const getTournament = useCallback((tournamentId: string) => {
    socketRef.current?.emit('tournament_get', { tournamentId });
  }, []);

  const refreshList = useCallback(() => {
    socketRef.current?.emit('tournament_list');
  }, []);

  const dismissMatch = useCallback(() => {
    setMatchReady(null);
  }, []);

  return {
    connected,
    tournaments,
    currentTournament,
    matchReady,
    error,
    playerToken: typeof window !== 'undefined' ? getPlayerToken() : '',
    create,
    join,
    leave,
    start,
    getTournament,
    refreshList,
    dismissMatch,
  };
}
