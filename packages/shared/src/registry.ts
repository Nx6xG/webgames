import type { GameManifest } from './manifest.js';

/**
 * Union of every supported game ID.
 * Adding a new game: add its string literal here, then implement engine + UI.
 */
export type GameId = 'tictactoe' | 'connect4' | 'rps' | 'chess';

/**
 * Compile-time check that every GameId has a manifest entry.
 * Used by the web registry; the WS engine registry has its own parallel type.
 */
export type SharedGameRegistry = Record<GameId, GameManifest>;
