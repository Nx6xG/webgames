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
  CfSpeedSetting,
  CfPowerUpDensity,
  CfThickness,
  CfDeathEvent,
  CfKillFeedEntry,
  CfPowerUpType,
  CfPowerUp,
  CfActiveEffect,
  CfObstacle,
  CfRoundStats,
  CfArenaShape,
  CfBotDifficulty,
  CfBotSlot,
  CfMapSize,
  TrailSegment,
} from './games/curvefever';
import { MAP_SIZE_PRESETS as _mapSizePresets } from './games/curvefever';
export const MAP_SIZE_PRESETS = _mapSizePresets;
import { BOT_TOKEN_PREFIX as _botTokenPrefix, isBotToken as _isBotToken } from './games/curvefever';
export const BOT_TOKEN_PREFIX = _botTokenPrefix;
export const isBotToken = _isBotToken;
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
import {
  NC_CARDS as _ncCards,
  NC_CARD_MAP as _ncCardMap,
  NC_CARDS_BY_RARITY as _ncCardsByRarity,
  NC_STARTER_CARDS as _ncStarterCards,
  NC_LANE_MODIFIERS as _ncLaneModifiers,
  NC_DECK_SIZE as _ncDeckSize,
  NC_MAX_COPIES as _ncMaxCopies,
  NC_START_HAND as _ncStartHand,
  NC_DRAW_PER_ROUND as _ncDrawPerRound,
  NC_START_MANA as _ncStartMana,
  NC_MAX_MANA as _ncMaxMana,
  NC_MANA_PER_ROUND as _ncManaPerRound,
  NC_LANES as _ncLanes,
  NC_PUSH_PER_POWER as _ncPushPerPower,
  NC_BREAKTHROUGH_THRESHOLD as _ncBreakthroughThreshold,
  NC_BREAKTHROUGHS_TO_WIN as _ncBreakthroughsToWin,
  NC_MAX_ROUNDS as _ncMaxRounds,
  NC_TURN_TIME_MS as _ncTurnTimeMs,
  NC_STANDARD_PACK_COST as _ncStdPackCost,
  NC_PREMIUM_PACK_COST as _ncPremPackCost,
  NC_CARDS_PER_PACK as _ncCardsPerPack,
  NC_STANDARD_RATES as _ncStdRates,
  NC_PREMIUM_RATES as _ncPremRates,
  NC_DUPLICATE_REFUND as _ncDupRefund,
  NC_DUPLICATE_SHARDS as _ncDupShards,
  NC_SHARD_PRICES as _ncShardPrices,
  NC_WIN_COINS as _ncWinCoins,
  NC_LOSS_COINS as _ncLossCoins,
  NC_DAILY_QUEST_COINS as _ncDailyQuestCoins,
  NC_WEEKLY_QUEST_GEMS as _ncWeeklyQuestGems,
  NC_STARTER_COINS as _ncStarterCoins,
  getNcDailyReward as _getNcDailyReward,
  createDefaultNcProfile as _createDefaultNcProfile,
  NC_BOT_TOKEN_PREFIX as _ncBotTokenPrefix,
  isNcBotToken as _isNcBotToken,
} from './games/nexusclash';
export const NC_CARDS = _ncCards;
export const NC_CARD_MAP = _ncCardMap;
export const NC_CARDS_BY_RARITY = _ncCardsByRarity;
export const NC_STARTER_CARDS = _ncStarterCards;
export const NC_LANE_MODIFIERS = _ncLaneModifiers;
export const NC_DECK_SIZE = _ncDeckSize;
export const NC_MAX_COPIES = _ncMaxCopies;
export const NC_START_HAND = _ncStartHand;
export const NC_DRAW_PER_ROUND = _ncDrawPerRound;
export const NC_START_MANA = _ncStartMana;
export const NC_MAX_MANA = _ncMaxMana;
export const NC_MANA_PER_ROUND = _ncManaPerRound;
export const NC_LANES = _ncLanes;
export const NC_PUSH_PER_POWER = _ncPushPerPower;
export const NC_BREAKTHROUGH_THRESHOLD = _ncBreakthroughThreshold;
export const NC_BREAKTHROUGHS_TO_WIN = _ncBreakthroughsToWin;
export const NC_MAX_ROUNDS = _ncMaxRounds;
export const NC_TURN_TIME_MS = _ncTurnTimeMs;
export const NC_STANDARD_PACK_COST = _ncStdPackCost;
export const NC_PREMIUM_PACK_COST = _ncPremPackCost;
export const NC_CARDS_PER_PACK = _ncCardsPerPack;
export const NC_STANDARD_RATES = _ncStdRates;
export const NC_PREMIUM_RATES = _ncPremRates;
export const NC_DUPLICATE_REFUND = _ncDupRefund;
export const NC_DUPLICATE_SHARDS = _ncDupShards;
export const NC_SHARD_PRICES = _ncShardPrices;
export const NC_WIN_COINS = _ncWinCoins;
export const NC_LOSS_COINS = _ncLossCoins;
export const NC_DAILY_QUEST_COINS = _ncDailyQuestCoins;
export const NC_WEEKLY_QUEST_GEMS = _ncWeeklyQuestGems;
export const NC_STARTER_COINS = _ncStarterCoins;
export const getNcDailyReward = _getNcDailyReward;
export const createDefaultNcProfile = _createDefaultNcProfile;
export const NC_BOT_TOKEN_PREFIX = _ncBotTokenPrefix;
export const isNcBotToken = _isNcBotToken;
export type {
  NcTag,
  NcRarity,
  NcTrigger,
  NcEffectType,
  NcAbility,
  NcCardDef,
  NcCardInstance,
  NcLaneModifier,
  NcLane,
  NcPendingPlay,
  NcPhase,
  NcResolveEvent,
  NexusClashState,
  NcPlaceCardAction,
  NcUndoPlaceAction,
  NcConfirmAction,
  NexusClashAction,
  NcPlayerCollection,
  NcCurrencies,
  NcPackType,
  NcPackResult,
  NcQuestType,
  NcQuestGoal,
  NcQuest,
  NcDeckSlot,
  NcPlayerProfile,
  NcBotDifficulty,
  NcMulliganAction,
} from './games/nexusclash';
export type {
  TournamentId,
  TournamentStatus,
  BracketSize,
  TournamentConfig,
  TournamentMatch,
  TournamentPlayer,
  TournamentState,
  TournamentListItem,
} from './tournament';
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
