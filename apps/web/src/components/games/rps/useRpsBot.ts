import { useState, useCallback, useRef, useEffect } from 'react';
import type { RpsState, RpsMode } from 'shared';
import { createInitialState, applyPick, getBotPick, type BotDifficulty } from './botEngine';

const BOT_DELAY: Record<BotDifficulty, [number, number]> = {
  easy: [400, 1000],
  medium: [600, 1500],
  hard: [800, 2000],
};

const DIFFICULTY_LABEL: Record<BotDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

function randomDelay(range: [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0]);
}

interface RpsBotPlayer {
  index: number;
  nickname: string;
  playerToken: string;
  avatarId?: string;
  nameColor?: string;
  avatarFrame?: string;
  cosmetics?: { avatarId?: string; nameColor?: string; slots: Record<string, string>; badges?: string[] };
}

export interface RpsBotState {
  phase: 'lobby' | 'playing' | 'ended';
  gameState: RpsState | null;
  connection: 'connected';
  playerIndex: number;
  playerCount: number;
  roomMaxPlayers: number;
  isSpectator: boolean;
  spectatorCount: number;
  roomCode: string | null;
  roomReady: boolean;
  countdown: number | null;
  players: RpsBotPlayer[];
  sendAction: (action: { type: string; pick?: string }) => void;
  startGame: (mode: RpsMode, bestOf: number) => void;
  leaveGame: () => void;
  requestRematch: () => void;
  rematchVotes: number;
  roomMessages: never[];
  globalMessages: never[];
  sendChat: () => void;
  setNickname: () => void;
  error: string | null;
  clearError: () => void;
}

export function useRpsBot(botDifficulty: BotDifficulty): RpsBotState {
  const [phase, setPhase] = useState<'lobby' | 'playing' | 'ended'>('lobby');
  const [gameState, setGameState] = useState<RpsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rematchVotes, setRematchVotes] = useState(0);

  const botTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef<RpsState | null>(null);
  const phaseRef = useRef(phase);
  const playerHistoryRef = useRef<import('shared').RpsPick[]>([]);
  const modeRef = useRef<RpsMode>('best_of');
  const bestOfRef = useRef(3);

  gameStateRef.current = gameState;
  phaseRef.current = phase;

  useEffect(() => {
    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const scheduleBotPick = useCallback((state: RpsState) => {
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);

    const delay = randomDelay(BOT_DELAY[botDifficulty]);
    botTimeoutRef.current = setTimeout(() => {
      botTimeoutRef.current = null;
      if (phaseRef.current !== 'playing') return;

      const currentState = gameStateRef.current;
      if (!currentState || currentState.status !== 'ongoing') return;
      // Only pick if bot hasn't picked yet
      if (currentState.hasPicked[1]) return;

      const botPick = getBotPick(botDifficulty, playerHistoryRef.current);
      const newState = applyPick(currentState, botPick, 'bot');
      setGameState(newState);
      gameStateRef.current = newState;

      if (newState.status !== 'ongoing') {
        setPhase('ended');
        phaseRef.current = 'ended';
      }
    }, delay);
  }, [botDifficulty]);

  const startGame = useCallback((mode: RpsMode, bestOf: number) => {
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);

    modeRef.current = mode;
    bestOfRef.current = bestOf;
    playerHistoryRef.current = [];

    const state = createInitialState(mode, bestOf);
    setGameState(state);
    gameStateRef.current = state;
    setPhase('playing');
    phaseRef.current = 'playing';
    setRematchVotes(0);

    // Bot picks simultaneously with a delay
    scheduleBotPick(state);
  }, [scheduleBotPick]);

  const sendAction = useCallback((action: { type: string; pick?: string }) => {
    const state = gameStateRef.current;
    if (!state || phaseRef.current !== 'playing' || state.status !== 'ongoing') return;
    if (action.type !== 'rps_pick' || !action.pick) return;

    const pick = action.pick as import('shared').RpsPick;
    playerHistoryRef.current.push(pick);

    const newState = applyPick(state, pick, 'human');
    setGameState(newState);
    gameStateRef.current = newState;

    if (newState.status !== 'ongoing') {
      setPhase('ended');
      phaseRef.current = 'ended';
      if (botTimeoutRef.current) {
        clearTimeout(botTimeoutRef.current);
        botTimeoutRef.current = null;
      }
      return;
    }

    // If round was resolved (both picked), schedule bot for next round
    if (newState.picks[0] !== null && newState.picks[1] !== null) {
      // Round resolved — picks will be cleared on next state update
      // Actually picks stay revealed; hasPicked resets for next round
      // Schedule bot for next round after a beat
      scheduleBotPick(newState);
    }
    // If bot hasn't picked yet for this round, it's already scheduled
  }, [scheduleBotPick]);

  const leaveGame = useCallback(() => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
    setPhase('lobby');
    phaseRef.current = 'lobby';
    setGameState(null);
    gameStateRef.current = null;
    setRematchVotes(0);
    playerHistoryRef.current = [];
  }, []);

  const requestRematch = useCallback(() => {
    setRematchVotes(1);
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);

    playerHistoryRef.current = [];

    const state = createInitialState(modeRef.current, bestOfRef.current);
    setGameState(state);
    gameStateRef.current = state;
    setPhase('playing');
    phaseRef.current = 'playing';
    setRematchVotes(0);

    scheduleBotPick(state);
  }, [scheduleBotPick]);

  const players: RpsBotPlayer[] = [
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
