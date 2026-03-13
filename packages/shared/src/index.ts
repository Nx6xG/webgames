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
  ChessClockConfig,
  ChessState,
  ChessMoveAction,
  ChessResignAction,
  ChessAction,
} from './games/chess';
import { SHIP_DEFS as _shipDefs, BOARD_SIZE as _boardSize, FLEET_PRESETS as _fleetPresets } from './games/battleship';
/** Exported as const so CJS output uses direct `exports.X = value` (cjs-module-lexer-friendly). */
export const SHIP_DEFS = _shipDefs;
export const BOARD_SIZE = _boardSize;
export const FLEET_PRESETS = _fleetPresets;
export type {
  BattleshipState,
  BattleshipAction,
  BsPlaceShipAction,
  BsResetPlacementAction,
  BsReadyAction,
  BsFireAction,
  BsAutoPlaceAction,
  BsPlayerState,
  BattleshipShip,
  ShipId,
  ShipDef,
  FleetPreset,
  BoardSize,
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
import {
  ARENA_W as _cfArenaW,
  ARENA_H as _cfArenaH,
  BASE_SPEED as _cfBaseSpeed,
  SPEED_INCREASE_PER_SEC as _cfSpeedInc,
  MAX_SPEED as _cfMaxSpeed,
  TURN_RATE as _cfTurnRate,
  PLAYER_RADIUS as _cfPlayerRadius,
  TICK_INTERVAL as _cfTickInterval,
  TICKS_PER_SEC as _cfTicksPerSec,
  PLAYER_COLORS as _cfPlayerColors,
  POWERUP_SPAWN_INTERVAL_MIN as _cfPuSpawnMin,
  POWERUP_SPAWN_INTERVAL_MAX as _cfPuSpawnMax,
  POWERUP_MAX_ACTIVE as _cfPuMaxActive,
  POWERUP_LIFETIME as _cfPuLifetime,
  POWERUP_PICKUP_RADIUS as _cfPuPickup,
  POWERUP_SPEED_DURATION as _cfPuSpeedDur,
  POWERUP_SPEED_MULTIPLIER as _cfPuSpeedMul,
  POWERUP_SHIELD_DURATION as _cfPuShieldDur,
  POWERUP_PHASE_DURATION as _cfPuPhaseDur,
  KILL_FEED_MAX as _cfKillFeedMax,
} from './games/curvefever';
export const CF_ARENA_W = _cfArenaW;
export const CF_ARENA_H = _cfArenaH;
export const CF_BASE_SPEED = _cfBaseSpeed;
export const CF_SPEED_INCREASE_PER_SEC = _cfSpeedInc;
export const CF_MAX_SPEED = _cfMaxSpeed;
export const CF_TURN_RATE = _cfTurnRate;
export const CF_PLAYER_RADIUS = _cfPlayerRadius;
export const CF_TICK_INTERVAL = _cfTickInterval;
export const CF_TICKS_PER_SEC = _cfTicksPerSec;
export const CF_PLAYER_COLORS = _cfPlayerColors;
export const CF_POWERUP_SPAWN_INTERVAL_MIN = _cfPuSpawnMin;
export const CF_POWERUP_SPAWN_INTERVAL_MAX = _cfPuSpawnMax;
export const CF_POWERUP_MAX_ACTIVE = _cfPuMaxActive;
export const CF_POWERUP_LIFETIME = _cfPuLifetime;
export const CF_POWERUP_PICKUP_RADIUS = _cfPuPickup;
export const CF_POWERUP_SPEED_DURATION = _cfPuSpeedDur;
export const CF_POWERUP_SPEED_MULTIPLIER = _cfPuSpeedMul;
export const CF_POWERUP_SHIELD_DURATION = _cfPuShieldDur;
export const CF_POWERUP_PHASE_DURATION = _cfPuPhaseDur;
export const CF_KILL_FEED_MAX = _cfKillFeedMax;
export type {
  CurveFeverPhase,
  CurveFeverPlayer,
  CurveFeverState,
  CurveFeverAction,
  CurveFeverConfig,
  CfDeathEvent,
  CfKillFeedEntry,
  CfPowerUpType,
  CfPowerUp,
  CfActiveEffect,
  TrailSegment,
} from './games/curvefever';
import { UNO_HAND_SIZE as _unoHandSize, UNO_PENALTY_CARDS as _unoPenalty, UNO_TARGET_SCORES as _unoTargetScores, UNO_DEFAULT_TARGET as _unoDefaultTarget, UNO_DEFAULT_RULES as _unoDefaultRules } from './games/uno';
export const UNO_HAND_SIZE = _unoHandSize;
export const UNO_PENALTY_CARDS = _unoPenalty;
export const UNO_TARGET_SCORES = _unoTargetScores;
export const UNO_DEFAULT_TARGET = _unoDefaultTarget;
export const UNO_DEFAULT_RULES = _unoDefaultRules;
export type {
  UnoColor,
  UnoCardType,
  UnoCard,
  UnoPlayer,
  UnoPhase,
  UnoState,
  UnoAction,
  UnoEngineConfig,
  UnoRuleConfig,
} from './games/uno';
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
  ShowcaseStat,
  ProfileShowcase,
  PresenceActivity,
  InvitePayload,
  CosmeticsSlots,
  CosmeticsSelection,
  PartyState,
  PartyMember,
  PartyInvitePayload,
  PartyErrorCode,
} from './protocol';
