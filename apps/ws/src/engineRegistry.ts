import type { GameId, GameEngine } from 'shared';
import { ticTacToeEngine } from './engines/tictactoe.js';
import { connect4Engine } from './engines/connect4.js';
import { rpsEngine } from './engines/rps.js';
import { chessEngine } from './engines/chess.js';
import { battleshipEngine } from './engines/battleship.js';
import { liarsBarEngine } from './engines/liarsbar.js';
import { curveFeverEngine } from './engines/curvefever.js';

/**
 * Maps every GameId to its authoritative server-side engine.
 * Adding a new game: import its engine and add one line here.
 *
 * Typed as `Record<GameId, GameEngine<any, any>>` because each game uses its own
 * state/action types — the per-game engine files enforce those types internally.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const engineRegistry: Record<GameId, GameEngine<any, any>> = {
  tictactoe:  ticTacToeEngine,
  connect4:   connect4Engine,
  rps:        rpsEngine,
  chess:      chessEngine,
  battleship: battleshipEngine,
  liarsbar:   liarsBarEngine,
  curvefever: curveFeverEngine,
};
