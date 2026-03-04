'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ChessState, ChessPiece, ChessColor, ChessPieceType, ChessPromoPiece } from 'shared';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import type { GameComponentProps } from '@/lib/gameRegistry';
import { CountdownOverlay } from '@/components/CountdownOverlay';
import { WaitingForConnectionOverlay } from '@/components/WaitingForConnectionOverlay';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { NicknameEditor } from '@/components/NicknameEditor';
import { GameInfoModal } from '@/components/GameInfoModal';
import { useI18n } from '@/components/providers/LanguageProvider';

// ── Piece rendering ────────────────────────────────────────────────────────────

const PIECE_CHAR: Record<ChessColor, Record<ChessPieceType, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

// ── Material values & captured-piece helpers ───────────────────────────────────

const PIECE_VALUES: Partial<Record<ChessPieceType, number>> = {
  p: 1, n: 3, b: 3, r: 5, q: 9,
};

/** Descending value order for display: queen first, pawns last. */
const CAPTURED_ORDER: ChessPieceType[] = ['q', 'r', 'b', 'n', 'p'];

/** Derive captures from the stored move history (handles en passant correctly). */
function getCapturedFromMoves(
  moves: ChessState['moves'],
  upToStep?: number,
): {
  capturedByWhite: Partial<Record<ChessPieceType, number>>;
  capturedByBlack: Partial<Record<ChessPieceType, number>>;
} {
  const slice = upToStep !== undefined ? moves.slice(0, upToStep) : moves;
  const capturedByWhite: Partial<Record<ChessPieceType, number>> = {};
  const capturedByBlack: Partial<Record<ChessPieceType, number>> = {};
  for (const m of slice) {
    if (!m.captured) continue;
    const dict = m.piece.color === 'w' ? capturedByWhite : capturedByBlack;
    dict[m.captured.type] = (dict[m.captured.type] ?? 0) + 1;
  }
  return { capturedByWhite, capturedByBlack };
}

function materialScore(captures: Partial<Record<ChessPieceType, number>>): number {
  return (Object.keys(captures) as ChessPieceType[]).reduce(
    (sum, type) => sum + (PIECE_VALUES[type] ?? 0) * (captures[type] ?? 0),
    0,
  );
}

// ── Client-side move generation (for highlighting + replay) ───────────────────
// Mirrors the server engine. Server is authoritative — these are display hints.

function rowOf(s: number) { return Math.floor(s / 8); }
function colOf(s: number) { return s % 8; }
function sqOf(r: number, c: number) { return r * 8 + c; }

function pathClearCl(board: (ChessPiece | null)[], r1: number, c1: number, r2: number, c2: number): boolean {
  const sr = Math.sign(r2 - r1), sc = Math.sign(c2 - c1);
  let r = r1 + sr, c = c1 + sc;
  while (r !== r2 || c !== c2) {
    if (board[sqOf(r, c)] !== null) return false;
    r += sr; c += sc;
  }
  return true;
}

function attacksCl(board: (ChessPiece | null)[], from: number, to: number, piece: ChessPiece): boolean {
  if (from === to) return false;
  const r1 = rowOf(from), c1 = colOf(from), r2 = rowOf(to), c2 = colOf(to);
  const dr = r2 - r1, dc = c2 - c1;
  switch (piece.type) {
    case 'p': { const d = piece.color === 'w' ? -1 : 1; return dr === d && (dc === 1 || dc === -1); }
    case 'n': { const ar = Math.abs(dr), ac = Math.abs(dc); return (ar===2&&ac===1)||(ar===1&&ac===2); }
    case 'b': return Math.abs(dr)===Math.abs(dc) && pathClearCl(board,r1,c1,r2,c2);
    case 'r': return (dr===0||dc===0) && pathClearCl(board,r1,c1,r2,c2);
    case 'q': return (Math.abs(dr)===Math.abs(dc)||dr===0||dc===0) && pathClearCl(board,r1,c1,r2,c2);
    case 'k': return Math.abs(dr)<=1 && Math.abs(dc)<=1;
  }
}

function isAttackedByCl(board: (ChessPiece | null)[], target: number, attackerColor: ChessColor): boolean {
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (p && p.color === attackerColor && attacksCl(board, from, target, p)) return true;
  }
  return false;
}

function isInCheckCl(board: (ChessPiece | null)[], color: ChessColor): boolean {
  let king = -1;
  for (let i = 0; i < 64; i++) { const p = board[i]; if (p && p.type==='k' && p.color===color) { king=i; break; } }
  if (king === -1) return false;
  return isAttackedByCl(board, king, color === 'w' ? 'b' : 'w');
}

function addSlidingCl(board: (ChessPiece | null)[], r1: number, c1: number, dirs: readonly (readonly [number,number])[], color: ChessColor, dests: number[]) {
  const opp = color==='w'?'b':'w';
  for (const [dr,dc] of dirs) {
    let r=r1+dr, c=c1+dc;
    while (r>=0&&r<8&&c>=0&&c<8) {
      const t = board[sqOf(r,c)];
      if (!t) { dests.push(sqOf(r,c)); } else { if (t.color===opp) dests.push(sqOf(r,c)); break; }
      r+=dr; c+=dc;
    }
  }
}

const CASTLE_CL = {
  w: {
    kingSide:  { kingFrom: 60, kingTo: 62, rookFrom: 63, rookTo: 61, through: [61, 62] as number[], empty: [61, 62] as number[] },
    queenSide: { kingFrom: 60, kingTo: 58, rookFrom: 56, rookTo: 59, through: [59, 58] as number[], empty: [57, 58, 59] as number[] },
  },
  b: {
    kingSide:  { kingFrom: 4, kingTo: 6,  rookFrom: 7,  rookTo: 5,  through: [5,  6]  as number[], empty: [5,  6]  as number[] },
    queenSide: { kingFrom: 4, kingTo: 2,  rookFrom: 0,  rookTo: 3,  through: [3,  2]  as number[], empty: [1,  2,  3]  as number[] },
  },
} as const;

interface ClientMoveCtx {
  castling: ChessState['castling'];
  enPassantTarget: number | null;
}

function getPseudoCl(board: (ChessPiece | null)[], from: number, piece: ChessPiece, ctx?: ClientMoveCtx): number[] {
  const r1=rowOf(from), c1=colOf(from), opp=piece.color==='w'?'b':'w', dests:number[]=[];
  switch (piece.type) {
    case 'p': {
      const dir=piece.color==='w'?-1:1, sr=piece.color==='w'?6:1, r2=r1+dir;
      if (r2>=0&&r2<8&&board[sqOf(r2,c1)]===null) {
        dests.push(sqOf(r2,c1));
        const r3=r1+2*dir;
        if (r1===sr&&r3>=0&&r3<8&&board[sqOf(r3,c1)]===null) dests.push(sqOf(r3,c1));
      }
      for (const dc of [-1,1]) {
        const c2=c1+dc;
        if (r2<0||r2>7||c2<0||c2>7) continue;
        const target=sqOf(r2,c2), t=board[target];
        if (t && t.color===opp) { dests.push(target); }
        else if (ctx?.enPassantTarget === target) { dests.push(target); }
      }
      break;
    }
    case 'n':
      for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]] as const) {
        const r2=r1+dr, c2=c1+dc; if (r2<0||r2>7||c2<0||c2>7) continue;
        const t=board[sqOf(r2,c2)]; if (!t||t.color===opp) dests.push(sqOf(r2,c2));
      }
      break;
    case 'b': addSlidingCl(board,r1,c1,[[-1,-1],[-1,1],[1,-1],[1,1]],piece.color,dests); break;
    case 'r': addSlidingCl(board,r1,c1,[[-1,0],[1,0],[0,-1],[0,1]],piece.color,dests); break;
    case 'q': addSlidingCl(board,r1,c1,[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]],piece.color,dests); break;
    case 'k': {
      for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as const) {
        const r2=r1+dr, c2=c1+dc; if (r2<0||r2>7||c2<0||c2>7) continue;
        const t=board[sqOf(r2,c2)]; if (!t||t.color===opp) dests.push(sqOf(r2,c2));
      }
      if (ctx && from === CASTLE_CL[piece.color].kingSide.kingFrom) {
        const enemy = opp;
        const rights = ctx.castling[piece.color];
        if (!isAttackedByCl(board, from, enemy)) {
          for (const side of ['kingSide', 'queenSide'] as const) {
            if (!rights[side]) continue;
            const c = CASTLE_CL[piece.color][side];
            if (c.empty.some(sq => board[sq] !== null)) continue;
            if (c.through.some(sq => isAttackedByCl(board, sq, enemy))) continue;
            dests.push(c.kingTo);
          }
        }
      }
      break;
    }
  }
  return dests;
}

function applyMoveCl(
  board: (ChessPiece | null)[],
  from: number,
  to: number,
  opts?: { promotion?: ChessPromoPiece; enPassantTarget?: number | null },
): (ChessPiece | null)[] {
  const nb=[...board]; const piece=nb[from]!; nb[to]=piece; nb[from]=null;
  if (piece.type==='p') {
    const promoteRank = piece.color==='w' ? 0 : 7;
    if (rowOf(to)===promoteRank) {
      nb[to] = { type: opts?.promotion ?? 'q', color: piece.color };
    }
    const epTarget = opts?.enPassantTarget;
    if (epTarget !== null && epTarget !== undefined && to === epTarget) {
      const capturedRow = piece.color==='w' ? rowOf(to)+1 : rowOf(to)-1;
      nb[sqOf(capturedRow, colOf(to))] = null;
    }
  }
  if (piece.type==='k' && Math.abs(colOf(to)-colOf(from))===2) {
    const side = colOf(to) > colOf(from) ? 'kingSide' : 'queenSide';
    const c = CASTLE_CL[piece.color][side];
    nb[c.rookTo] = nb[c.rookFrom];
    nb[c.rookFrom] = null;
  }
  return nb;
}

function getClientLegalMoves(board: (ChessPiece | null)[], from: number, color: ChessColor, ctx?: ClientMoveCtx): number[] {
  const piece=board[from]; if (!piece||piece.color!==color) return [];
  const epTarget = ctx?.enPassantTarget ?? null;
  return getPseudoCl(board, from, piece, ctx).filter(to =>
    !isInCheckCl(applyMoveCl(board, from, to, { enPassantTarget: epTarget }), color)
  );
}

/** Rebuild the board from scratch by replaying the first `steps` moves. */
function buildReplayBoard(moves: ChessState['moves'], steps: number): (ChessPiece | null)[] {
  const BACK: ChessPieceType[] = ['r','n','b','q','k','b','n','r'];
  let board: (ChessPiece | null)[] = Array(64).fill(null);
  for (let c = 0; c < 8; c++) {
    board[sqOf(0, c)] = { type: BACK[c], color: 'b' };
    board[sqOf(1, c)] = { type: 'p', color: 'b' };
    board[sqOf(6, c)] = { type: 'p', color: 'w' };
    board[sqOf(7, c)] = { type: BACK[c], color: 'w' };
  }
  let epTarget: number | null = null;
  for (let i = 0; i < steps && i < moves.length; i++) {
    const m = moves[i];
    board = applyMoveCl(board, m.from, m.to, { promotion: m.promotion, enPassantTarget: epTarget });
    if (m.piece.type === 'p' && Math.abs(rowOf(m.to) - rowOf(m.from)) === 2) {
      epTarget = sqOf((rowOf(m.from) + rowOf(m.to)) / 2, colOf(m.from));
    } else {
      epTarget = null;
    }
  }
  return board;
}

// ── PGN export ─────────────────────────────────────────────────────────────────

function buildPGN(gs: ChessState, p0nick: string, p1nick: string): string {
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const result = gs.status === 'win'
    ? (gs.winner === gs.players[0].id ? '1-0' : '0-1')
    : gs.status === 'draw' ? '1/2-1/2' : '*';
  const header = [
    `[Event "WebGames Chess"]`,
    `[Date "${date}"]`,
    `[White "${p0nick}"]`,
    `[Black "${p1nick}"]`,
    `[Result "${result}"]`,
  ].join('\n');
  let moveText = '';
  for (let i = 0; i < gs.moves.length; i++) {
    if (i % 2 === 0) moveText += `${Math.floor(i / 2) + 1}. `;
    moveText += gs.moves[i].san + ' ';
  }
  moveText += result;
  return `${header}\n\n${moveText.trim()}`;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ChessGame({ wsUrl, gameId, initialRoomCode, quickPlay: isQuickPlay }: GameComponentProps) {
  const router = useRouter();
  const mp = useMultiplayer<ChessState>(wsUrl, gameId);
  const { t } = useI18n();
  const [joinInput, setJoinInput]               = useState(initialRoomCode ?? '');
  const [copied, setCopied]                     = useState(false);
  const [pgnCopied, setPgnCopied]               = useState(false);
  const [roomVisibility, setRoomVisibility]     = useState<'private' | 'public'>('private');
  const [roomName, setRoomName]                 = useState('');
  const [showInfo, setShowInfo]                 = useState(false);
  const [chatOpen, setChatOpen]                 = useState(false);
  const [unread, setUnread]                     = useState(0);
  const [selectedSq, setSelectedSq]             = useState<number | null>(null);
  const [legalHighlights, setLegalHighlights]   = useState<number[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: number; to: number } | null>(null);
  const [replayMode, setReplayMode]             = useState(false);
  const [replayStep, setReplayStep]             = useState(0);

  const prevTotalRef    = useRef<number | null>(null);
  const autoJoined      = useRef(false);
  const moveListRef     = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // ── Auto-join / quick-play effects ──────────────────────────────────────────

  useEffect(() => {
    if (mp.connection === 'connected' && initialRoomCode && !autoJoined.current && mp.phase === 'lobby') {
      autoJoined.current = true;
      mp.joinRoom(initialRoomCode);
    }
  }, [mp.connection, initialRoomCode, mp.phase]); // eslint-disable-line

  useEffect(() => {
    if (mp.connection === 'connected' && isQuickPlay && !autoJoined.current && mp.phase === 'lobby') {
      autoJoined.current = true;
      mp.quickPlay();
    }
  }, [mp.connection, isQuickPlay, mp.phase]); // eslint-disable-line

  useEffect(() => {
    if (isQuickPlay && mp.roomCode) {
      router.replace(`/games/${gameId}?room=${mp.roomCode}`);
    }
  }, [mp.roomCode]); // eslint-disable-line

  // ── Unread chat tracking ─────────────────────────────────────────────────────

  useEffect(() => {
    const total = mp.roomMessages.length + mp.globalMessages.length;
    if (prevTotalRef.current === null) { prevTotalRef.current = total; return; }
    if (!chatOpen && total > prevTotalRef.current) {
      setUnread((u) => u + (total - prevTotalRef.current!));
    }
    prevTotalRef.current = total;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp.roomMessages.length, mp.globalMessages.length]);

  // ── Reset selection on state update; sync replay step to latest move ─────────

  useEffect(() => {
    setSelectedSq(null);
    setLegalHighlights([]);
    if (!replayMode && mp.gameState) {
      setReplayStep(mp.gameState.moves.length);
    }
  }, [mp.gameState]); // eslint-disable-line

  // ── Exit replay when leaving room ─────────────────────────────────────────────

  useEffect(() => {
    if (mp.phase === 'lobby') {
      setReplayMode(false);
      setReplayStep(0);
      userScrolledRef.current = false;
    }
  }, [mp.phase]);

  // ── Auto-scroll the move list ────────────────────────────────────────────────

  useEffect(() => {
    const el = moveListRef.current;
    if (!el) return;
    if (replayMode && replayStep > 0) {
      const target = el.querySelector<HTMLElement>(`[data-move-idx="${replayStep - 1}"]`);
      target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (replayMode && replayStep === 0) {
      el.scrollTop = 0;
    } else if (!userScrolledRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [replayMode, replayStep, mp.gameState?.moves.length]); // eslint-disable-line

  // ── Derived values ───────────────────────────────────────────────────────────

  const gs      = mp.gameState;
  const myIdx   = mp.playerIndex;
  const myColor: ChessColor | null = myIdx === null ? null : myIdx === 0 ? 'w' : 'b';
  const flipped = myColor === 'b';

  const p0nick  = mp.players.find((p) => p.index === 0)?.nickname ?? t('chess.white');
  const p1nick  = mp.players.find((p) => p.index === 1)?.nickname ?? t('chess.black');
  const myNick  = myIdx !== null ? (mp.players.find((p) => p.index === myIdx)?.nickname  ?? `Player ${myIdx + 1}`) : null;
  const oppNick = myIdx !== null ? (mp.players.find((p) => p.index !== myIdx)?.nickname ?? t('game.common.opponent')) : null;

  const promoLabels: Record<ChessPromoPiece, string> = {
    q: t('chess.piece.queen'),
    r: t('chess.piece.rook'),
    b: t('chess.piece.bishop'),
    n: t('chess.piece.knight'),
  };

  const isMyTurn      = gs !== null && myColor !== null && gs.turn === myColor && gs.status === 'ongoing';
  const boardDisabled = replayMode || mp.isSpectator || mp.phase !== 'playing' || !mp.roomReady || !isMyTurn || mp.matchCountdown !== null;

  // Captured pieces (respects replay step when in replay mode)
  const { capturedByWhite, capturedByBlack } = useMemo(() => {
    if (!gs) return { capturedByWhite: {}, capturedByBlack: {} };
    const step = replayMode ? replayStep : undefined;
    return getCapturedFromMoves(gs.moves, step);
  }, [gs, replayMode, replayStep]);

  // Material difference: positive = white ahead, negative = black ahead
  const materialDiff = materialScore(capturedByWhite) - materialScore(capturedByBlack);

  // Board shown in replay mode
  const replayBoard = useMemo(() => {
    if (!gs || !replayMode) return null;
    return buildReplayBoard(gs.moves, replayStep);
  }, [gs?.moves, replayMode, replayStep]); // eslint-disable-line

  const activeBoard = replayMode && replayBoard ? replayBoard : (gs?.board ?? null);

  const clientCtx: ClientMoveCtx | undefined = gs
    ? { castling: gs.castling, enPassantTarget: gs.enPassantTarget }
    : undefined;

  // ── Replay navigation helpers ────────────────────────────────────────────────

  function jumpToMove(step: number) {
    if (!gs) return;
    const maxStep = gs.moves.length;
    if (step >= maxStep) {
      setReplayMode(false);
      setReplayStep(maxStep);
    } else {
      setReplayMode(true);
      setReplayStep(step);
    }
    userScrolledRef.current = false;
  }

  function goToStart() {
    if (!gs || gs.moves.length === 0) return;
    setReplayMode(true);
    setReplayStep(0);
    userScrolledRef.current = false;
  }

  function goBack() {
    if (!gs || gs.moves.length === 0) return;
    if (!replayMode) {
      // Enter replay from the second-to-last position
      setReplayMode(true);
      setReplayStep(gs.moves.length - 1);
    } else {
      setReplayStep(s => Math.max(0, s - 1));
    }
    userScrolledRef.current = false;
  }

  function goForward() {
    if (!gs || !replayMode) return;
    const maxStep = gs.moves.length;
    if (replayStep >= maxStep) return;
    if (replayStep + 1 >= maxStep) {
      setReplayMode(false);
      setReplayStep(maxStep);
    } else {
      setReplayStep(s => s + 1);
    }
    userScrolledRef.current = false;
  }

  function goToEnd() {
    if (!gs) return;
    setReplayMode(false);
    setReplayStep(gs.moves.length);
    userScrolledRef.current = false;
  }

  function handleMoveListScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    userScrolledRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 20;
  }

  // ── Interaction ──────────────────────────────────────────────────────────────

  function handleSquareClick(sq: number) {
    if (boardDisabled || !gs || !myColor) return;
    const piece = gs.board[sq];

    if (selectedSq !== null) {
      if (legalHighlights.includes(sq)) {
        const movingPiece = gs.board[selectedSq];
        if (movingPiece?.type === 'p' && (rowOf(sq) === 0 || rowOf(sq) === 7)) {
          setPendingPromotion({ from: selectedSq, to: sq });
          setSelectedSq(null);
          setLegalHighlights([]);
          return;
        }
        mp.sendAction({ type: 'chess_move', from: selectedSq, to: sq });
        setSelectedSq(null);
        setLegalHighlights([]);
        return;
      }
      if (piece && piece.color === myColor) {
        setSelectedSq(sq);
        setLegalHighlights(getClientLegalMoves(gs.board, sq, myColor, clientCtx));
        return;
      }
      setSelectedSq(null);
      setLegalHighlights([]);
      return;
    }

    if (piece && piece.color === myColor) {
      setSelectedSq(sq);
      setLegalHighlights(getClientLegalMoves(gs.board, sq, myColor, clientCtx));
    }
  }

  function sendPromotion(promo: ChessPromoPiece) {
    if (!pendingPromotion) return;
    mp.sendAction({ type: 'chess_move', from: pendingPromotion.from, to: pendingPromotion.to, promotion: promo });
    setPendingPromotion(null);
  }

  function copyInvite() {
    if (!mp.roomCode) return;
    const url = `${window.location.origin}/games/chess?room=${mp.roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function exportPGN() {
    if (!gs) return;
    navigator.clipboard.writeText(buildPGN(gs, p0nick, p1nick)).then(() => {
      setPgnCopied(true);
      setTimeout(() => setPgnCopied(false), 2000);
    });
  }

  // ── Board ────────────────────────────────────────────────────────────────────

  function Board() {
    const board    = activeBoard ?? (Array(64).fill(null) as (ChessPiece | null)[]);
    const replayFrom = replayMode && replayStep > 0 ? gs?.moves[replayStep - 1]?.from : undefined;
    const replayTo   = replayMode && replayStep > 0 ? gs?.moves[replayStep - 1]?.to   : undefined;
    const hlFrom = replayMode ? replayFrom : gs?.lastMove?.from;
    const hlTo   = replayMode ? replayTo   : gs?.lastMove?.to;

    let checkKingSq: number | null = null;
    if (!replayMode && gs?.check && gs.status === 'ongoing') {
      for (let i = 0; i < 64; i++) {
        const p = board[i];
        if (p && p.type === 'k' && p.color === gs.turn) { checkKingSq = i; break; }
      }
    }

    return (
      <div className="relative">
        <div className="grid grid-cols-8 aspect-square border border-zinc-600 rounded overflow-hidden shadow-xl" style={{ width: 'min(92vw, 760px, calc(100vh - 220px))' }}>
          {Array.from({ length: 64 }, (_, vi) => {
            const boardSq = flipped ? 63 - vi : vi;
            const r       = rowOf(boardSq), c = colOf(boardSq);
            const isLight = (r + c) % 2 === 0;
            const piece   = board[boardSq] as ChessPiece | null;

            const isSelected  = !replayMode && selectedSq === boardSq;
            const isLegalDest = !replayMode && legalHighlights.includes(boardSq);
            const isLastMove  = boardSq === hlFrom || boardSq === hlTo;
            const isCheck     = boardSq === checkKingSq;

            let bg = isLight ? '#f0d9b5' : '#b58863';
            if (isLastMove)  bg = isLight ? '#cdd16f' : '#aaa23a';
            if (isSelected)  bg = '#7fc97f';
            if (isCheck)     bg = '#e74c3c';

            const showRank = flipped ? c === 7 : c === 0;
            const showFile = flipped ? r === 0 : r === 7;

            return (
              <div
                key={boardSq}
                style={{ backgroundColor: bg }}
                onClick={() => handleSquareClick(boardSq)}
                className="aspect-square w-full relative flex items-center justify-center leading-none text-3xl cursor-pointer select-none"
              >
                {isLegalDest && !piece && (
                  <div className="w-[32%] h-[32%] rounded-full bg-black/20 pointer-events-none" />
                )}
                {isLegalDest && piece && (
                  <div className="absolute inset-0 border-[3px] border-black/30 rounded-sm pointer-events-none" />
                )}
                {piece && (
                  <span
                    className={[
                      'leading-none select-none z-10',
                      piece.color === 'w'
                        ? 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,1),0_0_6px_rgba(0,0,0,0.8)]'
                        : 'text-zinc-900 [text-shadow:0_1px_1px_rgba(255,255,255,0.4)]',
                    ].join(' ')}
                  >
                    {PIECE_CHAR[piece.color][piece.type]}
                  </span>
                )}
                {showRank && (
                  <span
                    className="absolute top-[2px] left-[2px] text-[0.45rem] font-bold leading-none select-none pointer-events-none"
                    style={{ color: isLight ? '#b58863' : '#f0d9b5' }}
                  >
                    {8 - r}
                  </span>
                )}
                {showFile && (
                  <span
                    className="absolute bottom-[2px] right-[2px] text-[0.45rem] font-bold leading-none select-none pointer-events-none"
                    style={{ color: isLight ? '#b58863' : '#f0d9b5' }}
                  >
                    {String.fromCharCode(97 + c)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Promotion picker overlay */}
        {pendingPromotion && myColor && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 rounded">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 flex flex-col items-center gap-3 shadow-2xl">
              <p className="text-sm text-zinc-300 font-semibold">{t('chess.promoteTitle')}</p>
              <div className="flex gap-2">
                {(['q', 'r', 'b', 'n'] as const).map((pt) => (
                  <button
                    key={pt}
                    onClick={() => sendPromotion(pt)}
                    className="w-14 h-14 rounded-lg bg-zinc-800 hover:bg-indigo-700 border border-zinc-600 hover:border-indigo-500 flex flex-col items-center justify-center gap-0.5 transition-colors"
                    title={promoLabels[pt]}
                  >
                    <span className="text-2xl leading-none">{PIECE_CHAR[myColor][pt]}</span>
                    <span className="text-[0.6rem] text-zinc-400">{promoLabels[pt]}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPendingPromotion(null)}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Player label with captured pieces + material advantage ───────────────────

  function PlayerLabel({ color }: { color: ChessColor }) {
    const nick    = color === 'w' ? p0nick : p1nick;
    const isMe    = myColor === color;
    const isTurn  = !replayMode && gs?.turn === color && gs?.status === 'ongoing';

    // Pieces this player has captured (they belong to the opponent)
    const captures     = color === 'w' ? capturedByWhite : capturedByBlack;
    const capturedColor: ChessColor = color === 'w' ? 'b' : 'w';

    // Positive value means this color is ahead in material
    const myAdvantage  = color === 'w' ? materialDiff : -materialDiff;
    const hasCaptured  = CAPTURED_ORDER.some(pt => (captures[pt] ?? 0) > 0);

    return (
      <div className="w-full" style={{ maxWidth: 'min(92vw, 760px, calc(100vh - 220px))' }}>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-4 h-4 rounded-sm border shrink-0 ${
              color === 'w' ? 'bg-white border-zinc-400' : 'bg-zinc-900 border-zinc-600'
            }`}
          />
          <span className={`font-semibold truncate ${isMe ? 'text-indigo-300' : 'text-zinc-300'}`}>
            {nick}{isMe ? ` ${t('game.common.you')}` : ''}
          </span>
          {isTurn && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />}
          {myAdvantage > 0 && (
            <span className="text-xs font-semibold text-emerald-400 shrink-0" aria-label={`+${myAdvantage} material`}>
              +{myAdvantage}
            </span>
          )}
        </div>
        {hasCaptured && (
          <div className="flex items-center gap-0.5 mt-0.5 ml-6 flex-wrap min-h-[1.25rem]">
            {CAPTURED_ORDER.map(type => {
              const count = captures[type] ?? 0;
              if (!count) return null;
              const cls = capturedColor === 'w'
                ? 'text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]'
                : 'text-zinc-300 [text-shadow:0_0_3px_rgba(0,0,0,0.5)]';
              return Array.from({ length: count }, (_, i) => (
                <span key={`${type}-${i}`} className={`text-sm leading-none select-none ${cls}`} aria-hidden="true">
                  {PIECE_CHAR[capturedColor][type]}
                </span>
              ));
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Move history panel ────────────────────────────────────────────────────────

  function MoveHistoryPanel() {
    const moves    = gs?.moves ?? [];
    const maxStep  = moves.length;
    const isEmpty  = maxStep === 0;

    // 0-based index of the currently "active" move in the list
    const currentIdx = replayMode ? replayStep - 1 : maxStep - 1;

    // Navigation enabled states
    const canGoBack    = maxStep > 0 && !(replayMode && replayStep === 0);
    const canGoForward = replayMode && replayStep < maxStep;
    const canGoToStart = replayMode && replayStep > 0;
    const canGoToEnd   = replayMode;

    const btnBase =
      'p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm leading-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none';

    // Build move pairs for display
    const pairs: Array<{
      moveNum: number;
      white: { san: string; idx: number };
      black: { san: string; idx: number } | null;
    }> = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        moveNum: Math.floor(i / 2) + 1,
        white: { san: moves[i].san, idx: i },
        black: i + 1 < moves.length ? { san: moves[i + 1].san, idx: i + 1 } : null,
      });
    }

    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 flex flex-col">
        {/* Header */}
        <div className="px-3 py-2 flex items-center justify-between border-b border-zinc-800 gap-2">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider shrink-0">
            {replayMode ? `${t('chess.replayMoveLabel')} ${replayStep}/${maxStep}` : t('chess.replayMovesLabel')}
          </span>
          <div className="flex items-center gap-0.5">
            <button onClick={goToStart}   disabled={!canGoToStart} title="Go to start"   className={btnBase} aria-label="Go to start">⏮</button>
            <button onClick={goBack}      disabled={!canGoBack}    title="Previous move"  className={btnBase} aria-label="Previous move">◀</button>
            <button onClick={goForward}   disabled={!canGoForward} title="Next move"      className={btnBase} aria-label="Next move">▶</button>
            <button onClick={goToEnd}     disabled={!canGoToEnd}   title="Go to end"      className={btnBase} aria-label="Go to end (live)">⏭</button>
            {replayMode ? (
              <button
                onClick={goToEnd}
                className="ml-1 px-2 py-0.5 text-xs rounded border border-indigo-700 text-indigo-400 hover:border-indigo-500 hover:text-indigo-200 transition-colors focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                Live
              </button>
            ) : (
              <button
                onClick={() => { if (maxStep > 0) { setReplayMode(true); setReplayStep(maxStep); } }}
                disabled={isEmpty}
                className="ml-1 px-2 py-0.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                {t('chess.replay')}
              </button>
            )}
          </div>
        </div>

        {/* Move list */}
        <div
          ref={moveListRef}
          onScroll={handleMoveListScroll}
          className="overflow-y-auto max-h-52 py-1"
          role="list"
          aria-label="Move history"
        >
          {isEmpty ? (
            <p className="text-xs text-zinc-600 px-4 py-2">{t('chess.noMoves')}</p>
          ) : (
            pairs.map(({ moveNum, white, black }) => (
              <div key={moveNum} className="flex items-center" role="listitem">
                <span className="w-8 shrink-0 text-right pr-1.5 text-zinc-600 text-xs tabular-nums select-none">
                  {moveNum}.
                </span>
                {/* White's move */}
                <button
                  data-move-idx={white.idx}
                  onClick={() => jumpToMove(white.idx + 1)}
                  className={[
                    'flex-1 text-left px-1.5 py-0.5 rounded font-mono text-xs transition-colors',
                    'focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none',
                    white.idx === currentIdx
                      ? 'bg-indigo-600/30 text-indigo-200 font-semibold'
                      : 'text-zinc-300 hover:bg-zinc-800',
                  ].join(' ')}
                  aria-current={white.idx === currentIdx ? 'true' : undefined}
                >
                  {white.san}
                </button>
                {/* Black's move */}
                {black ? (
                  <button
                    data-move-idx={black.idx}
                    onClick={() => jumpToMove(black.idx + 1)}
                    className={[
                      'flex-1 text-left px-1.5 py-0.5 rounded font-mono text-xs transition-colors',
                      'focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none',
                      black.idx === currentIdx
                        ? 'bg-indigo-600/30 text-indigo-200 font-semibold'
                        : 'text-zinc-300 hover:bg-zinc-800',
                    ].join(' ')}
                    aria-current={black.idx === currentIdx ? 'true' : undefined}
                  >
                    {black.san}
                  </button>
                ) : (
                  <span className="flex-1" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Draw reason helper ────────────────────────────────────────────────────────

  function drawReason(term: ChessState['termination']) {
    if (term === 'stalemate')  return t('chess.termination.stalemate');
    if (term === 'fifty_move') return t('chess.termination.fiftyMove');
    if (term === 'threefold')  return t('chess.termination.threefold');
    return t('chess.termination.draw');
  }

  // ── Status banner ─────────────────────────────────────────────────────────────

  function StatusBanner() {
    if (replayMode && gs) {
      const totalMoves = gs.moves.length;
      return (
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-xs text-indigo-300 font-medium">
            {t('chess.replayHeaderPre')} {replayStep} / {totalMoves}
          </p>
          {replayStep > 0 && (
            <p className="text-xs text-zinc-500 font-mono">{gs.moves[replayStep - 1]?.san}</p>
          )}
        </div>
      );
    }
    if (mp.phase === 'lobby') {
      return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.joinPrompt')}</p>;
    }
    if (mp.isSpectator) {
      if (!gs) return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.watching')}</p>;
      if (gs.status === 'win') {
        const winColor = gs.players[0].id === gs.winner ? 'w' : 'b';
        const winName  = winColor === 'w' ? p0nick : p1nick;
        const reason   = gs.termination === 'checkmate' ? ` ${t('chess.byCheckmate')}` : gs.termination === 'resigned' ? ` ${t('chess.byResignation')}` : '';
        return <p className="text-lg font-bold text-center text-yellow-400">{winName} {t('chess.winsVerb')}{reason}!</p>;
      }
      if (gs.status === 'draw') {
        return <p className="text-lg font-bold text-center text-zinc-400">{t('chess.drawByPre')}{drawReason(gs.termination)}!</p>;
      }
      const turnName = gs.turn === 'w' ? p0nick : p1nick;
      return (
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
            {turnName} {t('chess.toMove')}
          </div>
          {gs.check && <p className="text-amber-400 text-xs font-semibold">{t('chess.check')}</p>}
        </div>
      );
    }
    if (mp.phase === 'waiting') {
      return (
        <div className="flex items-center gap-2 text-amber-400 text-sm justify-center">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          {t('game.status.waitingToJoin')}
        </div>
      );
    }
    if (!gs) return null;
    if (gs.status === 'win') {
      const iWon   = myIdx !== null && gs.winner === gs.players[myIdx]?.id;
      const reason = gs.termination === 'checkmate' ? ` (${t('chess.byCheckmate')})` : gs.termination === 'resigned' ? ` (${t('chess.byResignation')})` : '';
      return (
        <p className={`text-lg font-black text-center ${iWon ? 'text-yellow-400' : 'text-zinc-400'}`}>
          {iWon ? `🏆 ${myNick} ${t('chess.winsVerb')}${reason}!` : `${oppNick} ${t('chess.winsVerb')}${reason}.`}
        </p>
      );
    }
    if (gs.status === 'draw') {
      return <p className="text-xl font-black text-center text-zinc-400">{t('chess.drawByPre')}{drawReason(gs.termination)}!</p>;
    }
    if (mp.phase === 'ended') {
      return <p className="text-sm text-rose-400 text-center">{t('game.status.opponentDisconnected')}</p>;
    }
    if (gs.check) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-rose-400 font-bold text-sm">{t('chess.check')}</p>
          <p className="text-xs text-zinc-500">
            {isMyTurn ? t('chess.mustEscapeCheck') : `${oppNick} ${t('chess.mustEscapeCheckSuffix')}`}
          </p>
        </div>
      );
    }
    if (isMyTurn) {
      return (
        <div className="flex items-center gap-2 text-indigo-400 text-sm justify-center font-medium">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          {t('chess.yourTurn')} ({myColor === 'w' ? t('chess.white') : t('chess.black')}) — {t('chess.clickPiece')}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-zinc-400 text-sm justify-center">
        <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
        {oppNick}{t('game.status.turnSuffix')}
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 w-full items-start">
      {/* ── Game area ───────────────────────────────────────────────────── */}
      <div className="relative min-w-0 flex flex-col items-center justify-center gap-2 min-h-[520px]">
        <CountdownOverlay countdown={mp.matchCountdown} />
        <WaitingForConnectionOverlay
          show={mp.phase === 'playing' && !mp.roomReady && !mp.isSpectator}
          label={t('game.ready.waiting')}
        />

        {mp.phase !== 'lobby' && <PlayerLabel color={flipped ? 'w' : 'b'} />}
        {mp.phase !== 'lobby' && <Board />}
        {mp.phase !== 'lobby' && myColor && <PlayerLabel color={myColor} />}

        <StatusBanner />

        {mp.isSpectator && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-800/60 border border-zinc-700 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            {t('game.status.spectating')}
          </div>
        )}

        {!replayMode && !mp.isSpectator && gs && gs.status === 'ongoing' && mp.phase === 'playing' && (
          <button
            onClick={() => mp.sendAction({ type: 'chess_resign' })}
            className="px-4 py-1.5 text-xs rounded-lg border border-rose-800/60 text-rose-500 hover:border-rose-600 hover:text-rose-300 transition-colors"
          >
            {t('chess.resign')}
          </button>
        )}

        {!mp.isSpectator && gs && gs.status !== 'ongoing' && mp.playerCount === 2 && (
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={mp.requestRematch}
              disabled={mp.myVotedRematch}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
            >
              {mp.myVotedRematch ? t('game.actions.waitingRematch') : t('game.actions.rematch')}
            </button>
            {mp.rematchVotes > 0 && !mp.myVotedRematch && (
              <p className="text-xs text-amber-400">{t('game.status.opponentRematch')}</p>
            )}
            {mp.rematchError && (
              <p className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 rounded-lg px-3 py-1.5">{mp.rematchError}</p>
            )}
          </div>
        )}

        {(mp.phase === 'ended' || mp.phase === 'playing') && (
          <button
            onClick={mp.leaveRoom}
            className="mt-1 px-4 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            {t('game.actions.leaveRoom')}
          </button>
        )}
      </div>

      {/* ── Side panel ──────────────────────────────────────────────────── */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-24 h-fit">

        {/* Connection status */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${
              mp.connection === 'connected'  ? 'bg-emerald-400' :
              mp.connection === 'connecting' ? 'bg-amber-400 animate-pulse' :
              'bg-rose-500'
            }`} />
            <span className="text-zinc-400">{t(`status.${mp.connection}`)}</span>
          </div>
        </div>

        {/* Error */}
        {mp.error && (
          <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-rose-300 text-sm flex justify-between items-start gap-2">
            <span>{mp.error}</span>
            <button onClick={mp.clearError} className="text-rose-400 hover:text-rose-200 text-lg leading-none shrink-0">×</button>
          </div>
        )}

        {/* Lobby */}
        {mp.phase === 'lobby' && isQuickPlay ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {mp.connection !== 'connected' ? t('status.connecting') : t('game.lobby.findingMatch')}
            </div>
            <Link href={`/games/${gameId}`} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              {t('common.cancel')}
            </Link>
          </div>
        ) : mp.phase === 'lobby' ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3">
            <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg">
              {(['private', 'public'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setRoomVisibility(v)}
                  className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                    roomVisibility === v ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t(`game.lobby.${v}`)}
                </button>
              ))}
            </div>
            {roomVisibility === 'public' && (
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value.slice(0, 24))}
                placeholder={t('game.lobby.roomName')}
                maxLength={24}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            )}
            <button
              onClick={() => mp.createRoom({ visibility: roomVisibility, roomName: roomName.trim() || undefined })}
              disabled={mp.connection !== 'connected'}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
            >
              {t('game.lobby.createRoom')}
            </button>
            <div className="flex gap-2">
              <input
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase().slice(0, 6))}
                placeholder={t('game.lobby.roomCode')}
                maxLength={6}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 uppercase tracking-widest font-mono"
              />
              <button
                onClick={() => mp.joinRoom(joinInput)}
                disabled={joinInput.length < 4 || mp.connection !== 'connected'}
                className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {t('game.lobby.join')}
              </button>
            </div>
          </div>
        ) : null}

        {/* Room info */}
        {mp.roomCode && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{t('game.room.title')}</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-black tracking-widest text-zinc-100">{mp.roomCode}</span>
              <span className="text-xs text-zinc-500">{mp.playerCount}/{mp.roomMaxPlayers}</span>
              {mp.spectatorCount > 0 && (
                <span className="text-xs text-zinc-600 ml-1">{mp.spectatorCount} {t('game.room.watching')}</span>
              )}
            </div>
            <button
              onClick={copyInvite}
              className="w-full py-2 rounded-lg border border-zinc-700 hover:border-indigo-600 text-sm text-zinc-300 hover:text-indigo-300 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <><svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-emerald-400">{t('game.room.copied')}</span></>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>{t('game.room.copyInvite')}</>
              )}
            </button>
            {mp.players.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-zinc-800">
                {([0, 1] as const).map((idx) => {
                  const p    = mp.players.find((pp) => pp.index === idx);
                  if (!p) return null;
                  const isMe = !mp.isSpectator && mp.playerIndex === idx;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className={`w-3 h-3 rounded-sm border ${idx === 0 ? 'bg-white border-zinc-400' : 'bg-zinc-900 border-zinc-600'}`} />
                      <span className="text-zinc-300 truncate">{p.nickname}</span>
                      {isMe && <span className="text-zinc-600 shrink-0">{t('game.common.you')}</span>}
                    </div>
                  );
                })}
                {mp.isSpectator && <p className="text-xs text-zinc-600">{t('game.room.spectatorLabel')}</p>}
              </div>
            )}
          </div>
        )}

        {/* Move history — shown once in a game */}
        {mp.phase !== 'lobby' && <MoveHistoryPanel />}

        {/* Nickname */}
        <NicknameEditor nickname={mp.myNickname} onSave={mp.setNickname} />

        {/* Chat */}
        <ChatPanel
          mode="both"
          roomCode={mp.roomCode}
          roomMessages={mp.roomMessages}
          globalMessages={mp.globalMessages}
          chatError={mp.chatError}
          onSend={mp.sendChat}
          collapsible
          defaultOpen={false}
          open={chatOpen}
          onOpenChange={(o) => { setChatOpen(o); if (o) setUnread(0); }}
          showUnreadBadge
          unreadCount={unread}
          className="rounded-xl border border-zinc-800 bg-zinc-900"
        />

        {/* PGN export */}
        {gs && gs.moves.length > 0 && (
          <button
            onClick={exportPGN}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors self-start px-1"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            {pgnCopied ? t('chess.pgn.copied') : t('chess.exportPgn')}
          </button>
        )}

        {/* Stats & Rules */}
        <button
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors self-start px-1"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('game.info.statsRules')}
        </button>
      </aside>

      {/* Game Info modal */}
      <GameInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        stats={mp.stats}
        playerIndex={mp.isSpectator ? null : mp.playerIndex}
        history={mp.history}
        myNickname={mp.myNickname}
        rules={
          <ul className="text-sm text-zinc-400 space-y-1.5 list-disc list-inside">
            <li>{t('chess.rules.1')}</li>
            <li>{t('chess.rules.2')}</li>
            <li>{t('chess.rules.3')}</li>
            <li>{t('chess.rules.4')}</li>
            <li>{t('chess.rules.5')}</li>
            <li>{t('chess.rules.6')}</li>
            <li>{t('chess.rules.7')}</li>
            <li>{t('chess.rules.8')}</li>
            <li>{t('chess.rules.9')}</li>
          </ul>
        }
      />
    </div>
  );
}
