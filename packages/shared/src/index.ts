export type { GameManifest } from './manifest';
export type { GameId, SharedGameRegistry } from './registry';
export type {
  GameEngine,
  GameStatus,
  ActionContext,
  StatusResult,
} from './engine';
export type {
  TicTacToeState,
  TicTacToeAction,
  TicTacToePlayer,
  PlaceMarkAction,
  Mark,
  Cell,
} from './games/tictactoe';
export type {
  Connect4State,
  Connect4Action,
  Connect4Player,
  Connect4Cell,
  DropAction,
} from './games/connect4';
export type {
  RpsState,
  RpsPick,
  RpsMode,
  RpsAction,
  RpsPlayer,
  RpsPickAction,
} from './games/rps';
export type {
  ChessColor,
  ChessPieceType,
  ChessPromoPiece,
  ChessPiece,
  ChessCastlingRights,
  ChessMoveRecord,
  ChessState,
  ChessMoveAction,
  ChessResignAction,
  ChessAction,
} from './games/chess';
import { SHIP_DEFS as _shipDefs, BOARD_SIZE as _boardSize } from './games/battleship';
/** Exported as const so CJS output uses direct `exports.X = value` (cjs-module-lexer-friendly). */
export const SHIP_DEFS = _shipDefs;
export const BOARD_SIZE = _boardSize;
export type {
  BattleshipState,
  BattleshipAction,
  BsPlaceShipAction,
  BsResetPlacementAction,
  BsReadyAction,
  BsFireAction,
  BsPlayerState,
  BattleshipShip,
  ShipId,
  ShipDef,
  Coord,
  Orientation,
  ShotResult,
  BsPhase,
  BsSlot,
  ShotRecord,
} from './games/battleship';
import {
  DECK_SIZE as _deckSize,
  HAND_SIZE as _handSize,
  STARTING_LIVES as _startingLives,
  createInitialState as _lbCreateInitialState,
  applyAction as _lbApplyAction,
} from './games/liarsbar';
export const LB_DECK_SIZE = _deckSize;
export const LB_HAND_SIZE = _handSize;
export const LB_STARTING_LIVES = _startingLives;
export const lbCreateInitialState = _lbCreateInitialState;
export const lbApplyAction = _lbApplyAction;
export type {
  LiarsBarState,
  LiarsBarAction,
  LbPlayAction,
  LbCallAction,
  LbPassAction,
  LbStartAction,
  LbPlayer,
  LbPhase,
  LbReveal,
  LbLastClaim,
  LdMode,
  LdRouletteState,
  LdLastPenalty,
  Card,
  CardRank,
} from './games/liarsbar';
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
  ChatScope,
  ChatMessage,
  LeaderboardMode,
  LeaderboardEntry,
  OnlineUser,
  PresenceActivity,
  InvitePayload,
  CosmeticsSlots,
  CosmeticsSelection,
} from './protocol';
