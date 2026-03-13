/** Color of a chess piece */
export type ChessColor = 'w' | 'b';

/** Piece type: pawn, knight, bishop, rook, queen, king */
export type ChessPieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/** Promotion piece choices (excludes king and pawn) */
export type ChessPromoPiece = 'q' | 'r' | 'b' | 'n';

export interface ChessPiece {
  type: ChessPieceType;
  color: ChessColor;
}

export interface ChessCastlingRights {
  kingSide: boolean;
  queenSide: boolean;
}

/** One entry in the move history, used for PGN export and client-side replay. */
export interface ChessMoveRecord {
  from: number;
  to: number;
  promotion?: ChessPromoPiece;
  piece: ChessPiece;
  captured?: ChessPiece;
  /** Standard Algebraic Notation */
  san: string;
  /** Remaining clock time (ms) for the moving player after this move. Only present in timed games. */
  clockAfterMs?: number;
}

/** Chess clock configuration. timeSeconds=0 means unlimited (no clock). */
export interface ChessClockConfig {
  timeSeconds: number;
  incrementSeconds: number;
}

/**
 * Flat 64-cell board, row-major from Black's back rank:
 *   index 0  = a8 (Black's queen-rook),  7  = h8
 *   index 56 = a1 (White's queen-rook),  63 = h1
 */
export interface ChessState {
  board: (ChessPiece | null)[];
  /** Color whose turn it is */
  turn: ChessColor;
  /** players[] in seat order (matching mp.playerIndex) */
  players: [{ id: string }, { id: string }];
  /** Which seat index plays White (0 or 1). Used to determine color on client. */
  whiteIndex: 0 | 1;
  /** 'ongoing' while game is in progress, 'win' on checkmate/resign, 'draw' otherwise */
  status: 'ongoing' | 'win' | 'draw';
  /** True when the side-to-move king is currently in check */
  check: boolean;
  /** playerToken of the winner (only set when status === 'win') */
  winner?: string;
  /** How the game ended (for display purposes) */
  termination?: 'checkmate' | 'stalemate' | 'resigned' | 'fifty_move' | 'threefold' | 'timeout';
  /** Squares of the last move (for highlighting) */
  lastMove?: { from: number; to: number; piece: ChessPiece; captured?: ChessPiece };
  /**
   * Required by the server sanity guard.
   * Always the playerToken of whoever should move next (or the winning player if game ended).
   */
  currentTurn: string;

  // ── Stage 2 fields ──────────────────────────────────────────────────────────

  /** Castling availability per color. Lost permanently on king/rook move or rook capture. */
  castling: { w: ChessCastlingRights; b: ChessCastlingRights };

  /**
   * The square index where an en-passant capture may land this turn,
   * or null if no en-passant target exists.
   * Set to the square "behind" a pawn that just moved two squares.
   */
  enPassantTarget: number | null;

  /**
   * Half-move clock for the 50-move rule.
   * Resets to 0 on pawn move or capture; increments on all other moves.
   * Draw when >= 100 (50 moves each side).
   */
  halfmoveClock: number;

  /**
   * Position-occurrence counts for threefold-repetition detection.
   * Key is a deterministic position key (board + turn + castling + EP file).
   */
  positionCounts: Record<string, number>;

  /** Full move history (SAN + metadata) for PGN export and client-side replay. */
  moves: ChessMoveRecord[];

  // ── Clock fields (only present in timed games) ────────────────────────────

  /** True when the game uses a chess clock. */
  timed?: boolean;
  /** Remaining time in ms per player: [white, black]. */
  clockMs?: [number, number];
  /** Server timestamp (Date.now()) when the current player's clock started ticking. */
  lastMoveAt?: number;
  /** Increment per move in ms. */
  incrementMs?: number;
}

export interface ChessMoveAction {
  type: 'chess_move';
  /** Source square index 0–63 */
  from: number;
  /** Destination square index 0–63 */
  to: number;
  /**
   * Required when a pawn reaches the last rank.
   * Server rejects the move with PROMOTION_REQUIRED if omitted.
   */
  promotion?: ChessPromoPiece;
}

export interface ChessResignAction {
  type: 'chess_resign';
}

export type ChessAction = ChessMoveAction | ChessResignAction;
