import { useState, useCallback, useRef, useEffect } from 'react';
import type { BattleshipState, BattleshipAction, BoardSize, CosmeticsSelection } from 'shared';
import {
  createInitialState, applyAction, autoPlaceShips,
  getBotShot, createBotMemory, updateBotMemory,
  type BotDifficulty,
} from './botEngine';

export type { BotDifficulty };

interface BotPlayer {
  index: number;
  nickname: string;
  playerToken: string;
  avatarId?: string;
  nameColor?: string;
  avatarFrame?: string;
  cosmetics?: CosmeticsSelection;
}

export interface BattleshipBotState {
  phase: 'lobby' | 'playing' | 'ended';
  gameState: BattleshipState | null;
  connection: 'connected';
  playerIndex: number;
  playerCount: number;
  roomMaxPlayers: number;
  isSpectator: boolean;
  spectatorCount: number;
  roomCode: string | null;
  roomReady: boolean;
  countdown: number | null;
  players: BotPlayer[];
  sendAction: (action: BattleshipAction) => void;
  startGame: (config: { fleetPreset: string; boardSize: BoardSize; salvoMode: boolean; shotTimerSec: number }) => void;
  leaveGame: () => void;
  requestRematch: () => void;
  rematchVotes: number;
  myVotedRematch: boolean;
  rematchError: null;
  matchCountdown: null;
  roomMessages: never[];
  globalMessages: never[];
  sendChat: () => void;
  setNickname: () => void;
  error: string | null;
  clearError: () => void;
}

const BOT_DELAY: Record<BotDifficulty, [number, number]> = {
  easy: [400, 1000],
  medium: [300, 800],
  hard: [200, 600],
};

const DIFFICULTY_LABEL: Record<BotDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

function randomDelay(range: [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0]);
}

export function useBattleshipBot(botDifficulty: BotDifficulty): BattleshipBotState {
  const [phase, setPhase] = useState<'lobby' | 'playing' | 'ended'>('lobby');
  const [gameState, setGameState] = useState<BattleshipState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rematchVotes, setRematchVotes] = useState(0);

  const botTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef<BattleshipState | null>(null);
  const phaseRef = useRef(phase);
  const botMemoryRef = useRef(createBotMemory());
  const configRef = useRef<{ fleetPreset: string; boardSize: BoardSize; salvoMode: boolean; shotTimerSec: number } | null>(null);

  gameStateRef.current = gameState;
  phaseRef.current = phase;

  useEffect(() => {
    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
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
    if (errorTimeoutRef.current) { clearTimeout(errorTimeoutRef.current); errorTimeoutRef.current = null; }
  }, []);

  const scheduleBotShot = useCallback((state: BattleshipState) => {
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);

    const delay = randomDelay(BOT_DELAY[botDifficulty]);
    botTimeoutRef.current = setTimeout(() => {
      botTimeoutRef.current = null;
      if (phaseRef.current !== 'playing') return;
      const currentState = gameStateRef.current;
      if (!currentState || currentState.status !== 'ongoing' || currentState.phase !== 'playing') return;
      if (currentState.currentTurn !== 'bot') return;

      try {
        const target = getBotShot(currentState, botDifficulty, botMemoryRef.current);
        const newState = applyAction(currentState, { type: 'BS_FIRE', at: target }, 'bot');

        // Update bot memory with the shot result
        const lastShot = newState.shotsFired[1][newState.shotsFired[1].length - 1];
        if (lastShot) updateBotMemory(botMemoryRef.current, lastShot);

        setGameState(newState);
        gameStateRef.current = newState;

        if (newState.status !== 'ongoing') {
          setPhase('ended');
          phaseRef.current = 'ended';
          return;
        }

        // If still bot's turn (hit in non-salvo, or salvo remaining), fire again
        if (newState.currentTurn === 'bot') {
          scheduleBotShot(newState);
        }
      } catch (e) {
        console.error('Bot shot error:', e);
      }
    }, delay);
  }, [botDifficulty]);

  const startGame = useCallback((config: { fleetPreset: string; boardSize: BoardSize; salvoMode: boolean; shotTimerSec: number }) => {
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    configRef.current = config;
    botMemoryRef.current = createBotMemory();

    const state = createInitialState(config);

    // Bot auto-places ships immediately
    const botShips = autoPlaceShips(state.shipDefs, state.boardSize);
    const newPlayers: [typeof state.players[0], typeof state.players[1]] = [
      state.players[0],
      { ships: botShips, ready: true },
    ];
    const stateWithBotReady = { ...state, players: newPlayers };

    setGameState(stateWithBotReady);
    gameStateRef.current = stateWithBotReady;
    setPhase('playing');
    phaseRef.current = 'playing';
    setRematchVotes(0);
  }, []);

  const sendAction = useCallback((action: BattleshipAction) => {
    const state = gameStateRef.current;
    if (!state || phaseRef.current !== 'playing') return;

    try {
      let newState = applyAction(state, action, 'human');

      // If human just marked ready and bot is already ready → game starts
      if (action.type === 'BS_READY' && newState.phase === 'playing') {
        // Human is ready, bot was already ready, game transitions to playing
      }

      setGameState(newState);
      gameStateRef.current = newState;

      if (newState.status !== 'ongoing') {
        setPhase('ended');
        phaseRef.current = 'ended';
        return;
      }

      // If it's now the bot's turn, schedule bot shot
      if (newState.phase === 'playing' && newState.currentTurn === 'bot') {
        scheduleBotShot(newState);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid action';
      setErrorWithAutoClear(msg);
    }
  }, [scheduleBotShot, setErrorWithAutoClear]);

  const leaveGame = useCallback(() => {
    if (botTimeoutRef.current) { clearTimeout(botTimeoutRef.current); botTimeoutRef.current = null; }
    setPhase('lobby');
    phaseRef.current = 'lobby';
    setGameState(null);
    gameStateRef.current = null;
    setRematchVotes(0);
  }, []);

  const requestRematch = useCallback(() => {
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    setRematchVotes(1);
    botMemoryRef.current = createBotMemory();

    const cfg = configRef.current;
    if (!cfg) return;

    const state = createInitialState(cfg);
    const botShips = autoPlaceShips(state.shipDefs, state.boardSize);
    const newPlayers: [typeof state.players[0], typeof state.players[1]] = [
      state.players[0],
      { ships: botShips, ready: true },
    ];
    const stateWithBotReady = { ...state, players: newPlayers };

    setGameState(stateWithBotReady);
    gameStateRef.current = stateWithBotReady;
    setPhase('playing');
    phaseRef.current = 'playing';
    setRematchVotes(0);
  }, []);

  const players: BotPlayer[] = [
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
    myVotedRematch: false,
    rematchError: null,
    matchCountdown: null,
    roomMessages: [],
    globalMessages: [],
    sendChat: () => {},
    setNickname: () => {},
    error,
    clearError,
  };
}
