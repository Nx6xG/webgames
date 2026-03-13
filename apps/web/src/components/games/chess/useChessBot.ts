import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChessState, ChessColor, ChessClockConfig } from 'shared';
import { createInitialState, applyMoveToState, getBotMove, type BotDifficulty } from './botEngine';

interface ChessBotPlayer {
  index: number;
  nickname: string;
  playerToken: string;
  avatarId?: string;
  nameColor?: string;
  avatarFrame?: string;
}

export interface ChessBotState {
  // Game state
  phase: 'lobby' | 'playing' | 'ended';
  gameState: ChessState | null;
  connection: 'connected';

  // Player info
  playerIndex: number;
  playerCount: number;
  roomMaxPlayers: number;
  isSpectator: boolean;
  spectatorCount: number;

  // Room info (not used in bot mode but needed for interface compat)
  roomCode: string | null;
  roomReady: boolean;
  countdown: number | null;

  // Players list
  players: ChessBotPlayer[];

  // Actions
  sendAction: (action: { type: string; from?: number; to?: number; promotion?: string }) => void;
  startGame: (color: ChessColor, clockConfig?: { timeSeconds: number; incrementSeconds: number }) => void;
  leaveGame: () => void;
  requestRematch: () => void;
  rematchVotes: number;

  // Chat stubs
  roomMessages: never[];
  globalMessages: never[];
  sendChat: () => void;
  setNickname: () => void;

  // Error
  error: string | null;
  clearError: () => void;
}

const BOT_DELAY: Record<BotDifficulty, [number, number]> = {
  easy: [300, 800],
  medium: [500, 1500],
  hard: [800, 2500],
};

const DIFFICULTY_LABEL: Record<BotDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

function randomDelay(range: [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0]);
}

export function useChessBot(
  botDifficulty: BotDifficulty,
): ChessBotState {
  const [phase, setPhase] = useState<'lobby' | 'playing' | 'ended'>('lobby');
  const [gameState, setGameState] = useState<ChessState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rematchVotes, setRematchVotes] = useState(0);
  const [currentPlayerColor, setCurrentPlayerColor] = useState<ChessColor>('w');
  const clockConfigRef = useRef<{ timeSeconds: number; incrementSeconds: number } | undefined>(undefined);

  const botTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef<ChessState | null>(null);
  const phaseRef = useRef(phase);

  // Keep refs in sync
  gameStateRef.current = gameState;
  phaseRef.current = phase;

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  const setErrorWithAutoClear = useCallback((msg: string) => {
    setError(msg);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => setError(null), 3000);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  }, []);

  const scheduleBotMove = useCallback((state: ChessState) => {
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);

    const delay = randomDelay(BOT_DELAY[botDifficulty]);
    botTimeoutRef.current = setTimeout(() => {
      botTimeoutRef.current = null;
      // Re-check phase from ref in case it changed during delay
      if (phaseRef.current !== 'playing') return;

      const currentState = gameStateRef.current;
      if (!currentState || currentState.status !== 'ongoing') return;

      try {
        const botMove = getBotMove(currentState, botDifficulty);
        const newState = applyMoveToState(currentState, { type: 'chess_move', ...botMove }, 'bot');
        setGameState(newState);
        gameStateRef.current = newState;

        if (newState.status !== 'ongoing') {
          setPhase('ended');
          phaseRef.current = 'ended';
        }
      } catch (e) {
        // Bot move failed — this shouldn't happen normally
        console.error('Bot move error:', e);
      }
    }, delay);
  }, [botDifficulty]);

  // Clock tick effect
  useEffect(() => {
    if (phase !== 'playing' || !gameState?.timed) {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
      return;
    }

    clockIntervalRef.current = setInterval(() => {
      const state = gameStateRef.current;
      if (!state || state.status !== 'ongoing' || !state.timed || !state.clockMs || !state.lastMoveAt) return;

      const now = Date.now();
      const elapsed = now - state.lastMoveAt;
      const turnColorIdx = state.turn === 'w' ? 0 : 1;
      const remaining = state.clockMs[turnColorIdx] - elapsed;

      if (remaining <= 0) {
        // Time ran out for the current player
        const loserColor = state.turn;
        const winnerIsHuman = loserColor !== currentPlayerColor;
        const winnerToken = winnerIsHuman ? 'human' : 'bot';

        const newClockMs: [number, number] = [...state.clockMs];
        newClockMs[turnColorIdx] = 0;

        const timedOutState: ChessState = {
          ...state,
          status: 'win',
          winner: winnerToken,
          termination: 'timeout',
          clockMs: newClockMs,
          currentTurn: winnerToken,
        };

        setGameState(timedOutState);
        gameStateRef.current = timedOutState;
        setPhase('ended');
        phaseRef.current = 'ended';

        if (botTimeoutRef.current) {
          clearTimeout(botTimeoutRef.current);
          botTimeoutRef.current = null;
        }
      }
    }, 500);

    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    };
  }, [phase, gameState?.timed, currentPlayerColor]);

  const startGame = useCallback((color: ChessColor, clockCfg?: { timeSeconds: number; incrementSeconds: number }) => {
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);

    setCurrentPlayerColor(color);
    clockConfigRef.current = clockCfg;

    const chessClockConfig: ChessClockConfig | undefined = clockCfg
      ? { timeSeconds: clockCfg.timeSeconds, incrementSeconds: clockCfg.incrementSeconds }
      : undefined;

    const state = createInitialState(color, chessClockConfig);
    setGameState(state);
    gameStateRef.current = state;
    setPhase('playing');
    phaseRef.current = 'playing';
    setRematchVotes(0);

    // If bot plays white (human chose black), schedule bot's first move
    if (color === 'b') {
      scheduleBotMove(state);
    }
  }, [scheduleBotMove]);

  const sendAction = useCallback((action: { type: string; from?: number; to?: number; promotion?: string }) => {
    const state = gameStateRef.current;
    if (!state || phaseRef.current !== 'playing' || state.status !== 'ongoing') return;

    try {
      const typedAction = action.type === 'chess_resign'
        ? { type: 'chess_resign' as const }
        : { type: 'chess_move' as const, from: action.from!, to: action.to!, promotion: action.promotion as import('shared').ChessPromoPiece | undefined };
      const newState = applyMoveToState(state, typedAction, 'human');
      setGameState(newState);
      gameStateRef.current = newState;

      if (newState.status !== 'ongoing') {
        setPhase('ended');
        phaseRef.current = 'ended';
        return;
      }

      // Schedule bot response
      scheduleBotMove(newState);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid move';
      setErrorWithAutoClear(msg);
    }
  }, [scheduleBotMove, setErrorWithAutoClear]);

  const leaveGame = useCallback(() => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    setPhase('lobby');
    phaseRef.current = 'lobby';
    setGameState(null);
    gameStateRef.current = null;
    setRematchVotes(0);
  }, []);

  const requestRematch = useCallback(() => {
    // Bot always accepts, so one vote triggers a new game
    setRematchVotes(1);

    // Swap colors
    const newColor: ChessColor = currentPlayerColor === 'w' ? 'b' : 'w';
    setCurrentPlayerColor(newColor);

    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);

    const chessClockConfig: ChessClockConfig | undefined = clockConfigRef.current
      ? { timeSeconds: clockConfigRef.current.timeSeconds, incrementSeconds: clockConfigRef.current.incrementSeconds }
      : undefined;

    const state = createInitialState(newColor, chessClockConfig);
    setGameState(state);
    gameStateRef.current = state;
    setPhase('playing');
    phaseRef.current = 'playing';
    setRematchVotes(0);

    // If bot plays white after swap, schedule bot's first move
    if (newColor === 'b') {
      scheduleBotMove(state);
    }
  }, [currentPlayerColor, scheduleBotMove]);

  const players: ChessBotPlayer[] = [
    { index: 0, nickname: 'You', playerToken: 'human' },
    { index: 1, nickname: `Bot (${DIFFICULTY_LABEL[botDifficulty]})`, playerToken: 'bot' },
  ];

  return {
    phase,
    gameState,
    connection: 'connected',

    playerIndex: 0,
    playerCount: 2,
    roomMaxPlayers: 2,
    isSpectator: false,
    spectatorCount: 0,

    roomCode: null,
    roomReady: true,
    countdown: null,

    players,

    sendAction,
    startGame,
    leaveGame,
    requestRematch,
    rematchVotes,

    roomMessages: [],
    globalMessages: [],
    sendChat: () => {},
    setNickname: () => {},

    error,
    clearError,
  };
}
