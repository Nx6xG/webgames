export type { GameManifest } from './manifest.js';
export type { GameId, SharedGameRegistry } from './registry.js';
export type {
  GameEngine,
  GameStatus,
  ActionContext,
  StatusResult,
} from './engine.js';
export type {
  TicTacToeState,
  TicTacToeAction,
  TicTacToePlayer,
  PlaceMarkAction,
  Mark,
  Cell,
} from './games/tictactoe.js';
export type {
  Connect4State,
  Connect4Action,
  Connect4Player,
  Connect4Cell,
  DropAction,
} from './games/connect4.js';
export type {
  AnyGameState,
  AnyGameAction,
  ServerToClientEvents,
  ClientToServerEvents,
  RoomErrorCode,
  ActionErrorCode,
  RematchErrorCode,
  GameStats,
  RoomPlayerInfo,
  OpenRoomInfo,
  PublicRoomListItem,
  RoomVisibility,
  Match,
} from './protocol.js';
