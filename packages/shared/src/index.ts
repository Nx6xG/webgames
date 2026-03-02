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
export { SHIP_DEFS, BOARD_SIZE } from './games/battleship';
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
} from './protocol';
