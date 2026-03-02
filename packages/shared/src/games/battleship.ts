// ── Battleship — shared types, constants, and initial-state factory ──────────

export const BOARD_SIZE = 10;

export type ShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';
export type Orientation = 'H' | 'V';
export type ShotResult  = 'hit' | 'miss';
export type BsPhase     = 'setup' | 'playing' | 'finished';
/** 'A' = seat 0 (first player),  'B' = seat 1 (second player) */
export type BsSlot      = 'A' | 'B';

export interface ShipDef {
  id:     ShipId;
  /** English display name (i18n uses battleship.ship.<id>) */
  name:   string;
  length: number;
}

/** Classic 5-ship set.  Order matters — placement order follows this array. */
export const SHIP_DEFS: readonly ShipDef[] = [
  { id: 'carrier',    name: 'Carrier',    length: 5 },
  { id: 'battleship', name: 'Battleship', length: 4 },
  { id: 'cruiser',    name: 'Cruiser',    length: 3 },
  { id: 'submarine',  name: 'Submarine',  length: 3 },
  { id: 'destroyer',  name: 'Destroyer',  length: 2 },
] as const;

// ── Coordinate ───────────────────────────────────────────────────────────────

/** x = column 0–9 (left→right),  y = row 0–9 (top→bottom) */
export interface Coord { x: number; y: number }

// ── Per-player ship state ─────────────────────────────────────────────────────

export interface BattleshipShip {
  id:     ShipId;
  /**
   * Cell positions occupied by this ship.
   * Always present in the authoritative engine state.
   * Absent in per-client projected state sent to opponents / spectators.
   */
  cells?: Coord[];
  /**
   * Coords on this ship that have been hit by the opponent.
   * Always present in authoritative state; absent in projected state.
   */
  hits?:  Coord[];
  sunk:   boolean;  // true when hits.length === cells.length
}

export interface BsPlayerState {
  ships: BattleshipShip[];
  ready: boolean;
}

// ── Shot record ───────────────────────────────────────────────────────────────

export interface ShotRecord {
  at:          Coord;
  result:      ShotResult;
  /** Non-null when this shot sunk a ship */
  sunkShipId:  ShipId | null;
  /** Id of the ship that was hit; null when result === 'miss'. Used by clients to colour sunk-ship squares. */
  shipId:      ShipId | null;
}

// ── Full game state ───────────────────────────────────────────────────────────

export interface BattleshipState {
  phase:       BsPhase;
  /** playerIds[0] = slot A,  playerIds[1] = slot B */
  playerIds:   [string, string];
  /** players[0] = slot A board,  players[1] = slot B board */
  players:     [BsPlayerState, BsPlayerState];
  /**
   * shotsFired[0] = shots fired BY slot-A onto slot-B's board.
   * shotsFired[1] = shots fired BY slot-B onto slot-A's board.
   */
  shotsFired:  [ShotRecord[], ShotRecord[]];
  /**
   * playerToken of whoever fires next (playing phase) or slot-A's token (setup phase).
   * Required by the server sanity guard — must always be one of the connected player tokens,
   * matching the convention used by Chess, RPS, TicTacToe, and Connect4.
   */
  currentTurn: string;
  winner:      BsSlot | null;
  /** The most recent shot; null at game start */
  lastShot:    (ShotRecord & { by: BsSlot }) | null;
  /** Mirrors phase for GameEngine.getStatus() compatibility */
  status:      'ongoing' | 'win';
}

// ── Actions ───────────────────────────────────────────────────────────────────

export interface BsPlaceShipAction {
  type:        'BS_PLACE_SHIP';
  shipId:      ShipId;
  origin:      Coord;
  orientation: Orientation;
}

export interface BsResetPlacementAction {
  type: 'BS_RESET_PLACEMENT';
}

export interface BsReadyAction {
  type: 'BS_READY';
}

export interface BsFireAction {
  type: 'BS_FIRE';
  at:   Coord;
}

export type BattleshipAction =
  | BsPlaceShipAction
  | BsResetPlacementAction
  | BsReadyAction
  | BsFireAction;
