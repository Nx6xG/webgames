import type {
  ChessState, ChessPiece, ChessColor, ChessPieceType, ChessPromoPiece,
  ChessMoveRecord, ChessClockConfig,
} from 'shared';

// ── Board geometry ─────────────────────────────────────────────────────────────
// Flat 64-cell array, row-major from Black's back rank:
//   index 0  = a8 (Black's queen-rook),  7  = h8
//   index 56 = a1 (White's queen-rook),  63 = h1
// White pieces start on rows 6–7 (ranks 2–1); Black on rows 0–1 (ranks 8–7).

export function rowOf(s: number): number { return Math.floor(s / 8); }
export function colOf(s: number): number { return s % 8; }
export function sqOf(r: number, c: number): number { return r * 8 + c; }
export function sqName(s: number): string { return String.fromCharCode(97 + colOf(s)) + (8 - rowOf(s)); }

// ── Castling square constants ───────────────────────────────────────────────────
//   through: squares king passes through (must not be attacked)
//   empty:   ALL squares between king and rook that must be empty

const CASTLE = {
  w: {
    kingSide:  { kingTo: 62, rookFrom: 63, rookTo: 61, through: [61, 62] as number[], empty: [61, 62] as number[] },
    queenSide: { kingTo: 58, rookFrom: 56, rookTo: 59, through: [59, 58] as number[], empty: [57, 58, 59] as number[] },
  },
  b: {
    kingSide:  { kingTo: 6,  rookFrom: 7,  rookTo: 5,  through: [5,  6]  as number[], empty: [5,  6]  as number[] },
    queenSide: { kingTo: 2,  rookFrom: 0,  rookTo: 3,  through: [3,  2]  as number[], empty: [1,  2,  3]  as number[] },
  },
} as const;

// White king starts at e1=60; Black king at e8=4.
const KING_START = { w: 60, b: 4 } as const;

// ── Attack detection ───────────────────────────────────────────────────────────

/** True when all squares strictly between (r1,c1) and (r2,c2) are empty. */
function pathClear(board: (ChessPiece | null)[], r1: number, c1: number, r2: number, c2: number): boolean {
  const sr = Math.sign(r2 - r1);
  const sc = Math.sign(c2 - c1);
  let r = r1 + sr;
  let c = c1 + sc;
  while (r !== r2 || c !== c2) {
    if (board[sqOf(r, c)] !== null) return false;
    r += sr;
    c += sc;
  }
  return true;
}

/**
 * Can the piece at `from` attack square `to` (pseudo-legal, king-safety excluded)?
 * Does NOT check whether `to` contains a friendly piece — callers do that.
 */
function attacksPseudo(board: (ChessPiece | null)[], from: number, to: number, piece: ChessPiece): boolean {
  if (from === to) return false;
  const r1 = rowOf(from), c1 = colOf(from);
  const r2 = rowOf(to),   c2 = colOf(to);
  const dr = r2 - r1, dc = c2 - c1;

  switch (piece.type) {
    case 'p': {
      const dir = piece.color === 'w' ? -1 : 1;
      return dr === dir && (dc === 1 || dc === -1);
    }
    case 'n': {
      const ar = Math.abs(dr), ac = Math.abs(dc);
      return (ar === 2 && ac === 1) || (ar === 1 && ac === 2);
    }
    case 'b':
      if (Math.abs(dr) !== Math.abs(dc)) return false;
      return pathClear(board, r1, c1, r2, c2);
    case 'r':
      if (dr !== 0 && dc !== 0) return false;
      return pathClear(board, r1, c1, r2, c2);
    case 'q': {
      const diag = Math.abs(dr) === Math.abs(dc);
      const line = dr === 0 || dc === 0;
      if (!diag && !line) return false;
      return pathClear(board, r1, c1, r2, c2);
    }
    case 'k':
      return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
  }
}

/** True when any piece of `attackerColor` can capture square `target`. */
export function isAttackedBy(board: (ChessPiece | null)[], target: number, attackerColor: ChessColor): boolean {
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (p && p.color === attackerColor && attacksPseudo(board, from, target, p)) return true;
  }
  return false;
}

export function findKing(board: (ChessPiece | null)[], color: ChessColor): number {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.type === 'k' && p.color === color) return i;
  }
  return -1;
}

export function isInCheck(board: (ChessPiece | null)[], color: ChessColor): boolean {
  const king = findKing(board, color);
  if (king === -1) return false;
  return isAttackedBy(board, king, color === 'w' ? 'b' : 'w');
}

// ── Move generation ────────────────────────────────────────────────────────────

interface MoveCtx {
  castling: ChessState['castling'];
  enPassantTarget: number | null;
}

function addSliding(
  board: (ChessPiece | null)[],
  r1: number, c1: number,
  dirs: readonly (readonly [number, number])[],
  color: ChessColor,
  dests: number[],
): void {
  const opp = color === 'w' ? 'b' : 'w';
  for (const [dr, dc] of dirs) {
    let r = r1 + dr, c = c1 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const t = board[sqOf(r, c)];
      if (!t) {
        dests.push(sqOf(r, c));
      } else {
        if (t.color === opp) dests.push(sqOf(r, c));
        break;
      }
      r += dr; c += dc;
    }
  }
}

/** All squares a piece can reach, ignoring whether the move leaves the king in check. */
function getPseudoMoves(board: (ChessPiece | null)[], from: number, piece: ChessPiece, ctx?: MoveCtx): number[] {
  const r1 = rowOf(from), c1 = colOf(from);
  const opp = piece.color === 'w' ? 'b' : 'w';
  const dests: number[] = [];

  switch (piece.type) {
    case 'p': {
      const dir      = piece.color === 'w' ? -1 : 1;
      const startRow = piece.color === 'w' ? 6 : 1;
      const r2 = r1 + dir;
      if (r2 >= 0 && r2 < 8 && board[sqOf(r2, c1)] === null) {
        dests.push(sqOf(r2, c1));
        const r3 = r1 + 2 * dir;
        if (r1 === startRow && r3 >= 0 && r3 < 8 && board[sqOf(r3, c1)] === null) {
          dests.push(sqOf(r3, c1));
        }
      }
      // Diagonal captures + en passant
      for (const dc of [-1, 1]) {
        const c2 = c1 + dc;
        if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue;
        const target = sqOf(r2, c2);
        const t = board[target];
        if (t && t.color === opp) {
          dests.push(target);
        } else if (ctx?.enPassantTarget === target) {
          dests.push(target);
        }
      }
      break;
    }
    case 'n': {
      const OFFSETS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]] as const;
      for (const [dr, dc] of OFFSETS) {
        const r2 = r1 + dr, c2 = c1 + dc;
        if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue;
        const t = board[sqOf(r2, c2)];
        if (!t || t.color === opp) dests.push(sqOf(r2, c2));
      }
      break;
    }
    case 'b':
      addSliding(board, r1, c1, [[-1,-1],[-1,1],[1,-1],[1,1]], piece.color, dests);
      break;
    case 'r':
      addSliding(board, r1, c1, [[-1,0],[1,0],[0,-1],[0,1]], piece.color, dests);
      break;
    case 'q':
      addSliding(board, r1, c1, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]], piece.color, dests);
      break;
    case 'k': {
      const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as const;
      for (const [dr, dc] of DIRS) {
        const r2 = r1 + dr, c2 = c1 + dc;
        if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue;
        const t = board[sqOf(r2, c2)];
        if (!t || t.color === opp) dests.push(sqOf(r2, c2));
      }
      // Castling
      if (ctx && from === KING_START[piece.color]) {
        const enemy = opp;
        const rights = ctx.castling[piece.color];
        const kingNotInCheck = !isAttackedBy(board, from, enemy);
        if (kingNotInCheck) {
          for (const side of ['kingSide', 'queenSide'] as const) {
            if (!rights[side]) continue;
            const c = CASTLE[piece.color][side];
            if (c.empty.some(sq => board[sq] !== null)) continue;
            if (c.through.some(sq => isAttackedBy(board, sq, enemy))) continue;
            dests.push(c.kingTo);
          }
        }
      }
      break;
    }
  }
  return dests;
}

/** Apply a move to the board (immutable). Handles castling, en passant, and promotion. */
function applyMove(
  board: (ChessPiece | null)[],
  from: number,
  to: number,
  opts: { promotion?: ChessPromoPiece; enPassantTarget: number | null },
): (ChessPiece | null)[] {
  const nb = [...board];
  const piece = nb[from]!;
  nb[to] = piece;
  nb[from] = null;

  if (piece.type === 'p') {
    // Promotion
    const promoteRank = piece.color === 'w' ? 0 : 7;
    if (rowOf(to) === promoteRank) {
      nb[to] = { type: opts.promotion ?? 'q', color: piece.color };
    }
    // En passant: remove the captured pawn from behind the target square
    if (opts.enPassantTarget === to) {
      const capturedRow = piece.color === 'w' ? rowOf(to) + 1 : rowOf(to) - 1;
      nb[sqOf(capturedRow, colOf(to))] = null;
    }
  }

  // Castling: also move the rook
  if (piece.type === 'k') {
    const dc = colOf(to) - colOf(from);
    if (Math.abs(dc) === 2) {
      const side = dc > 0 ? 'kingSide' : 'queenSide';
      const c = CASTLE[piece.color][side];
      nb[c.rookTo] = nb[c.rookFrom];
      nb[c.rookFrom] = null;
    }
  }

  return nb;
}

/** All legal destinations for a piece (filters moves that leave own king in check). */
export function getLegalMoves(board: (ChessPiece | null)[], from: number, color: ChessColor, ctx?: MoveCtx): number[] {
  const piece = board[from];
  if (!piece || piece.color !== color) return [];
  const epTarget = ctx?.enPassantTarget ?? null;
  return getPseudoMoves(board, from, piece, ctx).filter((to) => {
    return !isInCheck(applyMove(board, from, to, { enPassantTarget: epTarget }), color);
  });
}

function hasAnyLegalMoves(board: (ChessPiece | null)[], color: ChessColor, ctx: MoveCtx): boolean {
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (p && p.color === color && getLegalMoves(board, from, color, ctx).length > 0) return true;
  }
  return false;
}

// ── Castling rights ────────────────────────────────────────────────────────────

function updateCastlingRights(
  castling: ChessState['castling'],
  piece: ChessPiece,
  from: number,
  to: number,
): ChessState['castling'] {
  const c = { w: { ...castling.w }, b: { ...castling.b } };

  // King moves → lose all rights for that color
  if (piece.type === 'k') {
    c[piece.color] = { kingSide: false, queenSide: false };
  }

  // Rook moves from its home square → lose that side's right
  if (piece.type === 'r') {
    if (piece.color === 'w') {
      if (from === CASTLE.w.kingSide.rookFrom)  c.w.kingSide  = false;
      if (from === CASTLE.w.queenSide.rookFrom) c.w.queenSide = false;
    } else {
      if (from === CASTLE.b.kingSide.rookFrom)  c.b.kingSide  = false;
      if (from === CASTLE.b.queenSide.rookFrom) c.b.queenSide = false;
    }
  }

  // Rook captured on its home square → opponent loses that right
  if (to === CASTLE.w.kingSide.rookFrom)  c.w.kingSide  = false;
  if (to === CASTLE.w.queenSide.rookFrom) c.w.queenSide = false;
  if (to === CASTLE.b.kingSide.rookFrom)  c.b.kingSide  = false;
  if (to === CASTLE.b.queenSide.rookFrom) c.b.queenSide = false;

  return c;
}

// ── Position key (for threefold repetition) ────────────────────────────────────

function positionKey(
  board: (ChessPiece | null)[],
  turn: ChessColor,
  castling: ChessState['castling'],
  enPassantTarget: number | null,
): string {
  const brd = board.map(p => p ? p.color + p.type : '--').join('');
  const cst = [
    castling.w.kingSide  ? 'K' : '',
    castling.w.queenSide ? 'Q' : '',
    castling.b.kingSide  ? 'k' : '',
    castling.b.queenSide ? 'q' : '',
  ].join('') || '-';
  const ep = enPassantTarget !== null ? sqName(enPassantTarget) : '-';
  return `${brd}|${turn}|${cst}|${ep}`;
}

// ── SAN generation ─────────────────────────────────────────────────────────────

export const PIECE_LETTER: Record<ChessPieceType, string> = {
  k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: '',
};

function generateSAN(
  board: (ChessPiece | null)[],    // board BEFORE the move
  from: number,
  to: number,
  piece: ChessPiece,
  promotion: ChessPromoPiece | undefined,
  moveCtx: MoveCtx,                // context BEFORE the move (for disambiguation)
  isEnPassant: boolean,
  isCastle: boolean,
  nextInCheck: boolean,
  nextHasMoves: boolean,
): string {
  const suffix = nextInCheck ? (nextHasMoves ? '+' : '#') : '';

  // Castling
  if (isCastle) {
    return (colOf(to) > colOf(from) ? 'O-O' : 'O-O-O') + suffix;
  }

  const capturedOnSquare = board[to];
  const isCapture = capturedOnSquare !== null || isEnPassant;

  // Pawn move
  if (piece.type === 'p') {
    let san = '';
    if (isCapture) san += String.fromCharCode(97 + colOf(from)) + 'x';
    san += sqName(to);
    if (promotion) san += '=' + promotion.toUpperCase();
    return san + suffix;
  }

  // Non-pawn: check for disambiguation
  const ambiguators: number[] = [];
  for (let sq = 0; sq < 64; sq++) {
    if (sq === from) continue;
    const p = board[sq];
    if (!p || p.type !== piece.type || p.color !== piece.color) continue;
    if (getLegalMoves(board, sq, piece.color, moveCtx).includes(to)) ambiguators.push(sq);
  }

  let disambig = '';
  if (ambiguators.length > 0) {
    const fileCollision = ambiguators.some(sq => colOf(sq) === colOf(from));
    const rankCollision = ambiguators.some(sq => rowOf(sq) === rowOf(from));
    if (!fileCollision) {
      disambig = String.fromCharCode(97 + colOf(from));
    } else if (!rankCollision) {
      disambig = String(8 - rowOf(from));
    } else {
      disambig = sqName(from);
    }
  }

  return PIECE_LETTER[piece.type] + disambig + (isCapture ? 'x' : '') + sqName(to) + suffix;
}

// ── Initial position ───────────────────────────────────────────────────────────

export function initialBoard(): (ChessPiece | null)[] {
  const board: (ChessPiece | null)[] = Array(64).fill(null);
  const BACK: ChessPieceType[] = ['r','n','b','q','k','b','n','r'];
  for (let c = 0; c < 8; c++) {
    board[sqOf(0, c)] = { type: BACK[c], color: 'b' }; // rank 8 — Black back rank
    board[sqOf(1, c)] = { type: 'p',     color: 'b' }; // rank 7 — Black pawns
    board[sqOf(6, c)] = { type: 'p',     color: 'w' }; // rank 2 — White pawns
    board[sqOf(7, c)] = { type: BACK[c], color: 'w' }; // rank 1 — White back rank
  }
  return board;
}

// ── Create initial state (for bot games) ────────────────────────────────────────

export function createInitialState(playerColor: ChessColor, config?: ChessClockConfig): ChessState {
  const board    = initialBoard();
  const castling = { w: { kingSide: true, queenSide: true }, b: { kingSide: true, queenSide: true } };

  // players[0] = human, players[1] = bot
  // whiteIndex = which seat plays White
  const whiteIdx: 0 | 1 = playerColor === 'w' ? 0 : 1;
  const whiteToken = whiteIdx === 0 ? 'human' : 'bot';
  const initKey    = positionKey(board, 'w', castling, null);

  const timed = !!(config && config.timeSeconds > 0);
  const timeMs = timed ? config!.timeSeconds * 1000 : 0;
  const incrementMs = timed ? (config!.incrementSeconds ?? 0) * 1000 : 0;

  return {
    board,
    turn:            'w',
    players:         [{ id: 'human' }, { id: 'bot' }],
    whiteIndex:      whiteIdx,
    status:          'ongoing',
    check:           false,
    currentTurn:     whiteToken,
    castling,
    enPassantTarget: null,
    halfmoveClock:   0,
    positionCounts:  { [initKey]: 1 },
    moves:           [],
    ...(timed ? {
      timed: true,
      clockMs: [timeMs, timeMs] as [number, number],
      lastMoveAt: Date.now(),
      incrementMs,
    } : {}),
  };
}

// ── Apply move to state (mirrors server applyAction) ────────────────────────────

export function applyMoveToState(
  state: ChessState,
  action: { type: 'chess_move'; from: number; to: number; promotion?: ChessPromoPiece } | { type: 'chess_resign' },
  playerId: string,
): ChessState {
  if (state.status !== 'ongoing') throw new Error('GAME_OVER: Game is already finished');

  const actorIdx = state.players.findIndex((p) => p.id === playerId);
  if (actorIdx === -1) throw new Error('NOT_IN_ROOM: You are not a player in this match');

  // ── Clock check: if timed, deduct time for the moving player ────────────
  let clockMs = state.clockMs ? [...state.clockMs] as [number, number] : undefined;
  let lastMoveAt = state.lastMoveAt;
  if (state.timed && clockMs && lastMoveAt) {
    const now = Date.now();
    const turnIdx = state.turn === 'w' ? 0 : 1;
    const elapsed = Math.max(0, now - lastMoveAt);
    clockMs[turnIdx] = Math.max(0, clockMs[turnIdx] - elapsed);
    // Time ran out — opponent wins
    if (clockMs[turnIdx] <= 0) {
      const timedOutSeat = state.turn === 'w' ? state.whiteIndex : (1 - state.whiteIndex) as 0 | 1;
      const winnerId = state.players[1 - timedOutSeat].id;
      return {
        ...state,
        status: 'win',
        winner: winnerId,
        termination: 'timeout',
        currentTurn: winnerId,
        clockMs: clockMs as [number, number],
        lastMoveAt: now,
      };
    }
    lastMoveAt = now;
  }

  // ── Resign ────────────────────────────────────────────────────────────────
  if (action.type === 'chess_resign') {
    const oppIdx = 1 - actorIdx;
    const winner = state.players[oppIdx].id;
    return {
      ...state,
      status:      'win',
      check:       false,
      winner,
      termination: 'resigned',
      currentTurn: winner,
      ...(clockMs ? { clockMs, lastMoveAt } : {}),
    };
  }

  // ── Move ──────────────────────────────────────────────────────────────────
  if (action.type !== 'chess_move') throw new Error('INVALID_ACTION: Unknown action type');

  // Turn enforcement: whiteIndex maps seat to color
  const expectedIdx = state.turn === 'w' ? state.whiteIndex : (1 - state.whiteIndex);
  if (actorIdx !== expectedIdx) throw new Error('NOT_YOUR_TURN: Wait for your turn');

  const { from, to, promotion } = action;
  if (from < 0 || from > 63 || to < 0 || to > 63 || from === to) {
    throw new Error('INVALID_POSITION: Square index out of range');
  }

  const piece = state.board[from];
  if (!piece)                      throw new Error('INVALID_ACTION: No piece on that square');
  if (piece.color !== state.turn)  throw new Error('INVALID_ACTION: That is not your piece');

  const moveCtx: MoveCtx = { castling: state.castling, enPassantTarget: state.enPassantTarget };
  const legal = getLegalMoves(state.board, from, state.turn, moveCtx);
  if (!legal.includes(to)) throw new Error('INVALID_ACTION: Illegal move');

  // Promotion validation
  const isPromotion = piece.type === 'p' && (rowOf(to) === 0 || rowOf(to) === 7);
  if (isPromotion && !promotion)  throw new Error('PROMOTION_REQUIRED: Choose a promotion piece (q/r/b/n)');
  if (!isPromotion && promotion)  throw new Error('INVALID_ACTION: Promotion not valid for this move');

  // Detect special moves
  const isCastle    = piece.type === 'k' && Math.abs(colOf(to) - colOf(from)) === 2;
  const isEnPassant = piece.type === 'p' && to === state.enPassantTarget;
  const capturedPiece: ChessPiece | undefined = isEnPassant
    ? { type: 'p', color: state.turn === 'w' ? 'b' : 'w' }
    : (state.board[to] ?? undefined);

  // Apply move
  const newBoard = applyMove(state.board, from, to, { promotion, enPassantTarget: state.enPassantTarget });

  // Update castling rights
  const newCastling = updateCastlingRights(state.castling, piece, from, to);

  // Update en-passant target
  let newEnPassantTarget: number | null = null;
  if (piece.type === 'p' && Math.abs(rowOf(to) - rowOf(from)) === 2) {
    const epRow = (rowOf(from) + rowOf(to)) / 2;
    newEnPassantTarget = sqOf(epRow, colOf(from));
  }

  // Halfmove clock
  const isCapture   = isEnPassant || state.board[to] !== null;
  const newHalfmove = (piece.type === 'p' || isCapture) ? 0 : state.halfmoveClock + 1;

  // Next player context (for hasMoves, threefold key, SAN suffix)
  const nextColor: ChessColor = state.turn === 'w' ? 'b' : 'w';
  const nextPlayerToken       = state.players[1 - actorIdx].id;
  const nextCtx: MoveCtx      = { castling: newCastling, enPassantTarget: newEnPassantTarget };

  // Check / legal-move detection for next player (used for status AND SAN suffix)
  const inCheck  = isInCheck(newBoard, nextColor);
  const hasMoves = hasAnyLegalMoves(newBoard, nextColor, nextCtx);

  // SAN (computed after all context is known)
  const san = generateSAN(
    state.board, from, to, piece, promotion,
    moveCtx, isEnPassant, isCastle,
    inCheck, hasMoves,
  );

  // Apply increment to the player who just moved (before recording)
  if (state.timed && clockMs && state.incrementMs) {
    const turnIdx = state.turn === 'w' ? 0 : 1;
    clockMs[turnIdx] += state.incrementMs;
  }

  // Move record
  const moveRecord: ChessMoveRecord = {
    from, to, piece, san,
    ...(promotion    ? { promotion }    : {}),
    ...(capturedPiece ? { captured: capturedPiece } : {}),
    ...(state.timed && clockMs ? { clockAfterMs: clockMs[state.turn === 'w' ? 0 : 1] } : {}),
  };

  // Threefold repetition: record the resulting position
  const newKey    = positionKey(newBoard, nextColor, newCastling, newEnPassantTarget);
  const newCounts = { ...state.positionCounts, [newKey]: (state.positionCounts[newKey] ?? 0) + 1 };

  // Game-end detection (checkmate / stalemate take priority over draw rules)
  let status:      ChessState['status']      = 'ongoing';
  let winner:      string | undefined;
  let termination: ChessState['termination'];

  if (!hasMoves) {
    if (inCheck) {
      status      = 'win';
      winner      = playerId;
      termination = 'checkmate';
    } else {
      status      = 'draw';
      termination = 'stalemate';
    }
  } else if (newHalfmove >= 100) {
    status      = 'draw';
    termination = 'fifty_move';
  } else if (newCounts[newKey] >= 3) {
    status      = 'draw';
    termination = 'threefold';
  }

  return {
    ...state,
    board:           newBoard,
    turn:            nextColor,
    status,
    check:           status === 'ongoing' && inCheck,
    winner,
    termination,
    lastMove:        { from, to, piece, ...(capturedPiece ? { captured: capturedPiece } : {}) },
    currentTurn:     status !== 'ongoing' ? playerId : nextPlayerToken,
    castling:        newCastling,
    enPassantTarget: newEnPassantTarget,
    halfmoveClock:   newHalfmove,
    positionCounts:  newCounts,
    moves:           [...state.moves, moveRecord],
    ...(state.timed && clockMs ? { clockMs, lastMoveAt } : {}),
  };
}

// ── Get all legal moves for a color ─────────────────────────────────────────────

export function getAllLegalMoves(
  state: ChessState,
  color: ChessColor,
): { from: number; to: number; promotion?: ChessPromoPiece }[] {
  const ctx: MoveCtx = { castling: state.castling, enPassantTarget: state.enPassantTarget };
  const moves: { from: number; to: number; promotion?: ChessPromoPiece }[] = [];

  for (let from = 0; from < 64; from++) {
    const p = state.board[from];
    if (!p || p.color !== color) continue;
    const dests = getLegalMoves(state.board, from, color, ctx);
    for (const to of dests) {
      const isPromotion = p.type === 'p' && (rowOf(to) === 0 || rowOf(to) === 7);
      if (isPromotion) {
        for (const promo of ['q', 'r', 'b', 'n'] as ChessPromoPiece[]) {
          moves.push({ from, to, promotion: promo });
        }
      } else {
        moves.push({ from, to });
      }
    }
  }

  return moves;
}

// ── Bot AI ──────────────────────────────────────────────────────────────────────

export type BotDifficulty = 'easy' | 'medium' | 'hard';

const MATERIAL_SIMPLE: Record<ChessPieceType, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};

const MATERIAL_EVAL: Record<ChessPieceType, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Center squares: d4=35(row4,col3), d5=27(row3,col3), e4=36(row4,col4), e5=28(row3,col4)
const CENTER_SQUARES = new Set([27, 28, 35, 36]);

// Piece-square tables (from White's perspective; mirrored for Black)
// Only pawns and knights for the simplified hard AI
const PAWN_PST = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const KNIGHT_PST = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

function pstIndex(sq: number, color: ChessColor): number {
  // PST is from White's perspective (row 0 = rank 8 = black back rank)
  // For white, the table is already correct (white pawns start row 6, advance towards row 0)
  // For black, mirror vertically
  if (color === 'w') return sq;
  const r = rowOf(sq);
  const c = colOf(sq);
  return sqOf(7 - r, c);
}

function evaluate(board: (ChessPiece | null)[], color: ChessColor): number {
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p) continue;
    const sign = p.color === color ? 1 : -1;
    let value = MATERIAL_EVAL[p.type];
    // Add PST bonus
    if (p.type === 'p') {
      value += PAWN_PST[pstIndex(sq, p.color)];
    } else if (p.type === 'n') {
      value += KNIGHT_PST[pstIndex(sq, p.color)];
    }
    score += sign * value;
  }
  return score;
}

function minimax(
  board: (ChessPiece | null)[],
  castling: ChessState['castling'],
  enPassantTarget: number | null,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  color: ChessColor,
  botColor: ChessColor,
): number {
  const currentColor = maximizing ? botColor : (botColor === 'w' ? 'b' : 'w');
  const ctx: MoveCtx = { castling, enPassantTarget };

  if (depth === 0) {
    return evaluate(board, botColor);
  }

  // Generate all legal moves for currentColor
  const moves: { from: number; to: number; promotion?: ChessPromoPiece }[] = [];
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || p.color !== currentColor) continue;
    const dests = getLegalMoves(board, from, currentColor, ctx);
    for (const to of dests) {
      const isProm = p.type === 'p' && (rowOf(to) === 0 || rowOf(to) === 7);
      if (isProm) {
        // Only consider queen promotion in minimax for performance
        moves.push({ from, to, promotion: 'q' });
      } else {
        moves.push({ from, to });
      }
    }
  }

  if (moves.length === 0) {
    // No legal moves: checkmate or stalemate
    if (isInCheck(board, currentColor)) {
      // Checkmate: worst/best depending on who is mated
      return maximizing ? -100000 + (3 - depth) : 100000 - (3 - depth);
    }
    return 0; // Stalemate
  }

  // Order moves: captures first for better pruning
  moves.sort((a, b) => {
    const capA = board[a.to] ? MATERIAL_EVAL[board[a.to]!.type] : 0;
    const capB = board[b.to] ? MATERIAL_EVAL[board[b.to]!.type] : 0;
    return capB - capA;
  });

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newBoard = applyMove(board, move.from, move.to, {
        promotion: move.promotion,
        enPassantTarget,
      });
      const piece = board[move.from]!;
      const newCastling = updateCastlingRights(castling, piece, move.from, move.to);
      let newEp: number | null = null;
      if (piece.type === 'p' && Math.abs(rowOf(move.to) - rowOf(move.from)) === 2) {
        newEp = sqOf((rowOf(move.from) + rowOf(move.to)) / 2, colOf(move.from));
      }
      const evalScore = minimax(newBoard, newCastling, newEp, depth - 1, alpha, beta, false, currentColor, botColor);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newBoard = applyMove(board, move.from, move.to, {
        promotion: move.promotion,
        enPassantTarget,
      });
      const piece = board[move.from]!;
      const newCastling = updateCastlingRights(castling, piece, move.from, move.to);
      let newEp: number | null = null;
      if (piece.type === 'p' && Math.abs(rowOf(move.to) - rowOf(move.from)) === 2) {
        newEp = sqOf((rowOf(move.from) + rowOf(move.to)) / 2, colOf(move.from));
      }
      const evalScore = minimax(newBoard, newCastling, newEp, depth - 1, alpha, beta, true, currentColor, botColor);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export function getBotMove(
  state: ChessState,
  difficulty: BotDifficulty,
): { from: number; to: number; promotion?: ChessPromoPiece } {
  const botColor = state.turn;
  const allMoves = getAllLegalMoves(state, botColor);

  if (allMoves.length === 0) {
    throw new Error('No legal moves available');
  }

  if (allMoves.length === 1) {
    return allMoves[0];
  }

  switch (difficulty) {
    case 'easy':
      return getBotMoveEasy(state, allMoves);
    case 'medium':
      return getBotMoveMedium(state, allMoves);
    case 'hard':
      return getBotMoveHard(state, allMoves, botColor);
  }
}

function getBotMoveEasy(
  state: ChessState,
  moves: { from: number; to: number; promotion?: ChessPromoPiece }[],
): { from: number; to: number; promotion?: ChessPromoPiece } {
  // Random move with slight preference for captures (30% bonus weight)
  const weights: number[] = moves.map((move) => {
    const target = state.board[move.to];
    return target ? 1.3 : 1.0;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < moves.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return moves[i];
  }
  return moves[moves.length - 1];
}

function getBotMoveMedium(
  state: ChessState,
  moves: { from: number; to: number; promotion?: ChessPromoPiece }[],
): { from: number; to: number; promotion?: ChessPromoPiece } {
  const botColor = state.turn;
  const oppColor: ChessColor = botColor === 'w' ? 'b' : 'w';

  const scored = moves.map((move) => {
    let score = 0;

    // Material capture value
    const target = state.board[move.to];
    if (target) {
      score += MATERIAL_SIMPLE[target.type];
    }

    // En passant capture
    if (state.board[move.from]?.type === 'p' && move.to === state.enPassantTarget) {
      score += MATERIAL_SIMPLE['p'];
    }

    // Check bonus
    const newBoard = applyMove(state.board, move.from, move.to, {
      promotion: move.promotion,
      enPassantTarget: state.enPassantTarget,
    });
    if (isInCheck(newBoard, oppColor)) {
      score += 0.5;
    }

    // Center control bonus
    if (CENTER_SQUARES.has(move.to)) {
      score += 0.3;
    }

    // Penalty for moving into a square attacked by opponent
    if (isAttackedBy(newBoard, move.to, oppColor)) {
      score -= 1.0;
    }

    return { move, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Pick from top 3 weighted by score
  const top = scored.slice(0, Math.min(3, scored.length));
  // Shift scores so minimum is 0, then add 1 for baseline weight
  const minScore = Math.min(...top.map(s => s.score));
  const weights = top.map(s => s.score - minScore + 1);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let rand = Math.random() * totalWeight;
  for (let i = 0; i < top.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return top[i].move;
  }
  return top[top.length - 1].move;
}

function getBotMoveHard(
  state: ChessState,
  moves: { from: number; to: number; promotion?: ChessPromoPiece }[],
  botColor: ChessColor,
): { from: number; to: number; promotion?: ChessPromoPiece } {
  let bestMove = moves[0];
  let bestEval = -Infinity;

  for (const move of moves) {
    const newBoard = applyMove(state.board, move.from, move.to, {
      promotion: move.promotion,
      enPassantTarget: state.enPassantTarget,
    });
    const piece = state.board[move.from]!;
    const newCastling = updateCastlingRights(state.castling, piece, move.from, move.to);
    let newEp: number | null = null;
    if (piece.type === 'p' && Math.abs(rowOf(move.to) - rowOf(move.from)) === 2) {
      newEp = sqOf((rowOf(move.from) + rowOf(move.to)) / 2, colOf(move.from));
    }

    const evalScore = minimax(
      newBoard, newCastling, newEp,
      2, // depth remaining (total depth = 3: this move + 2 more plies)
      -Infinity, Infinity,
      false, // next move is opponent (minimizing)
      botColor,
      botColor,
    );

    if (evalScore > bestEval) {
      bestEval = evalScore;
      bestMove = move;
    }
  }

  return bestMove;
}
