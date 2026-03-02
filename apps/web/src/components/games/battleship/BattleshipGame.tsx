'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { BattleshipState, Coord, Orientation, ShipId, BsSlot } from 'shared';
import { SHIP_DEFS, BOARD_SIZE } from 'shared';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import type { GameComponentProps } from '@/lib/gameRegistry';
import { CountdownOverlay } from '@/components/CountdownOverlay';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { NicknameEditor } from '@/components/NicknameEditor';
import { GameInfoModal } from '@/components/GameInfoModal';
import { useI18n } from '@/components/providers/LanguageProvider';

// ── Cell display types ────────────────────────────────────────────────────────

type CellView =
  | 'empty'         // dark, nothing there
  | 'ship'          // own board: ship cell, not hit
  | 'hit'           // own board: enemy hit this ship cell
  | 'sunk'          // own board: entire ship is sunk (all cells)
  | 'miss-rx'       // own board: enemy shot here, missed
  | 'preview-ok'    // setup: valid hover preview
  | 'preview-bad'   // setup: invalid hover preview
  | 'shot-hit'      // opp board: I hit here
  | 'shot-sunk'     // opp board: I hit here and ship is sunk
  | 'shot-miss';    // opp board: I missed here

// ── Pure helpers (mirrored from engine for client-side computation) ──────────

function coordEq(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

function shipCellsFromOrigin(origin: Coord, orientation: Orientation, length: number): Coord[] {
  return Array.from({ length }, (_, i) =>
    orientation === 'H'
      ? { x: origin.x + i, y: origin.y }
      : { x: origin.x,     y: origin.y + i },
  );
}

function inBounds(c: Coord): boolean {
  return c.x >= 0 && c.x < BOARD_SIZE && c.y >= 0 && c.y < BOARD_SIZE;
}

// ── Board cell builders ───────────────────────────────────────────────────────

/** 100-entry CellView array for the setup grid (own board, placement phase). */
function buildSetupCells(
  placedShips: BattleshipState['players'][0]['ships'],
  previewCells: Coord[],
  previewValid: boolean,
): CellView[] {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, idx): CellView => {
    const coord: Coord = { x: idx % BOARD_SIZE, y: Math.floor(idx / BOARD_SIZE) };

    for (const ship of placedShips) {
      if ((ship.cells ?? []).some((c) => coordEq(c, coord))) return 'ship';
    }
    if (previewCells.some((c) => coordEq(c, coord))) {
      return previewValid ? 'preview-ok' : 'preview-bad';
    }
    return 'empty';
  });
}

/** 100-entry CellView array for the player's own board during play. */
function buildOwnCells(player: BattleshipState['players'][0]): CellView[] {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, idx): CellView => {
    const coord: Coord = { x: idx % BOARD_SIZE, y: Math.floor(idx / BOARD_SIZE) };

    for (const ship of player.ships) {
      if ((ship.cells ?? []).some((c) => coordEq(c, coord))) {
        if ((ship.hits ?? []).some((c) => coordEq(c, coord))) {
          return ship.sunk ? 'sunk' : 'hit';
        }
        return 'ship';
      }
    }
    return 'empty';
  });
}

/**
 * 100-entry CellView array for a board viewed from the "attacker" perspective.
 * Combines two sources of truth:
 *  - shot records (always present) for hit / miss markers
 *  - sunk ship cells (revealed by server after sinking) for a full outline
 * The cell-based check is the primary path for sunk ships so the whole ship
 * body lights up as 'shot-sunk' — not just the individual shot markers.
 */
function buildOppCells(
  myShots: BattleshipState['shotsFired'][0],
  oppShips: BattleshipState['players'][0]['ships'],
): CellView[] {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, idx): CellView => {
    const coord: Coord = { x: idx % BOARD_SIZE, y: Math.floor(idx / BOARD_SIZE) };

    // 1. Sunk-ship reveal: if cells are present (server sends them only after sinking)
    //    show the full outline in 'shot-sunk' color.
    for (const ship of oppShips) {
      if (ship.sunk && ship.cells && ship.cells.some((c) => coordEq(c, coord))) {
        return 'shot-sunk';
      }
    }

    // 2. Shot record fallback (handles non-sunk hits and misses; also covers sunk ships
    //    when cells are absent, e.g. spectator view where cells are always stripped).
    const shot = myShots.find((s) => coordEq(s.at, coord));
    if (!shot) return 'empty';
    if (shot.result === 'miss') return 'shot-miss';
    const hitShip = oppShips.find((s) => s.id === shot.shipId);
    return hitShip?.sunk ? 'shot-sunk' : 'shot-hit';
  });
}

// ── Cell background colour ────────────────────────────────────────────────────

function cellBg(view: CellView): string {
  switch (view) {
    case 'ship':        return '#4338ca'; // indigo-700
    case 'hit':         return '#e11d48'; // rose-600
    case 'sunk':        return '#9f1239'; // rose-900
    case 'miss-rx':     return '#27272a'; // zinc-800
    case 'preview-ok':  return '#6366f1'; // indigo-500
    case 'preview-bad': return '#f43f5e'; // rose-400
    case 'shot-hit':    return '#e11d48'; // rose-600
    case 'shot-sunk':   return '#9f1239'; // rose-900
    case 'shot-miss':   return '#3f3f46'; // zinc-700
    case 'empty':
    default:            return '#18181b'; // zinc-900
  }
}

// ── BsGrid ────────────────────────────────────────────────────────────────────

interface BsGridProps {
  cells:       CellView[];
  onCell?:     (coord: Coord) => void;
  onHover?:    (coord: Coord | null) => void;
  disabled?:   boolean;
  hoverCoord?: Coord | null;
  cellSize?:   number;
  label?:      string;
}

function BsGrid({ cells, onCell, onHover, disabled, hoverCoord, cellSize = 28, label }: BsGridProps) {
  const boardPx = BOARD_SIZE * cellSize + (BOARD_SIZE - 1) * 2; // cells + 2px gaps

  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && (
        <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">{label}</p>
      )}
      <div
        style={{ width: boardPx }}
        onMouseLeave={() => onHover?.(null)}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
            gap: '2px',
            userSelect: 'none',
          }}
        >
          {cells.map((view, idx) => {
            const x = idx % BOARD_SIZE;
            const y = Math.floor(idx / BOARD_SIZE);
            const coord: Coord = { x, y };
            const isHovered = hoverCoord ? coordEq(hoverCoord, coord) : false;
            const canClick   = !disabled && (view === 'empty' || view === 'preview-ok' || view === 'preview-bad');

            return (
              <div
                key={idx}
                onClick={() => canClick && onCell?.(coord)}
                onMouseEnter={() => onHover?.(coord)}
                title={`${String.fromCharCode(65 + x)}${y + 1}`}
                style={{
                  width:           cellSize,
                  height:          cellSize,
                  backgroundColor: cellBg(view),
                  borderRadius:    3,
                  cursor:          canClick ? 'pointer' : 'default',
                  position:        'relative',
                  outline:         isHovered && !disabled ? '2px solid rgba(99,102,241,0.7)' : 'none',
                  outlineOffset:   '-1px',
                  transition:      'background-color 0.08s',
                  flexShrink:      0,
                }}
              >
                {/* Hit / Sunk marker */}
                {(view === 'hit' || view === 'sunk' || view === 'shot-hit' || view === 'shot-sunk') && (
                  <svg
                    viewBox="0 0 10 10"
                    style={{ position: 'absolute', inset: '15%', pointerEvents: 'none' }}
                    aria-hidden="true"
                  >
                    <line x1="1" y1="1" x2="9" y2="9" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <line x1="9" y1="1" x2="1" y2="9" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {/* Miss marker */}
                {(view === 'shot-miss' || view === 'miss-rx') && (
                  <svg
                    viewBox="0 0 10 10"
                    style={{ position: 'absolute', inset: '20%', pointerEvents: 'none' }}
                    aria-hidden="true"
                  >
                    <circle cx="5" cy="5" r="3.5" stroke="#a1a1aa" strokeWidth="1.5" fill="none" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── ShipRoster (setup sidebar) ────────────────────────────────────────────────

interface ShipRosterProps {
  placedIds:     Set<ShipId>;
  activeShipId:  ShipId | null;
  onSelect:      (id: ShipId) => void;
  orientation:   Orientation;
  onRotate:      () => void;
  onReset:       () => void;
  onReady:       () => void;
  canReady:      boolean;
  isReady:       boolean;
  oppReady:      boolean;
  disabled:      boolean;
  t:             (k: string) => string;
}

function ShipRoster({ placedIds, activeShipId, onSelect, orientation, onRotate, onReset, onReady, canReady, isReady, oppReady, disabled, t }: ShipRosterProps) {
  const allPlaced = placedIds.size >= SHIP_DEFS.length;

  return (
    <div className="flex flex-col gap-2 min-w-[180px]">
      <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">
        {t('battleship.setup.title')}
      </p>

      {SHIP_DEFS.map((def) => {
        const placed   = placedIds.has(def.id);
        const isActive = activeShipId === def.id && !isReady;

        return (
          <button
            key={def.id}
            onClick={() => !disabled && !isReady && onSelect(def.id)}
            disabled={disabled || isReady}
            className={[
              'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium text-left transition-colors',
              isActive
                ? 'border-indigo-500 bg-indigo-950/60 text-indigo-200'
                : placed
                ? 'border-zinc-700 bg-zinc-800/50 text-zinc-400'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600',
              (disabled || isReady) ? 'cursor-default' : 'cursor-pointer',
            ].join(' ')}
          >
            {/* Length pips */}
            <div className="flex gap-0.5 shrink-0">
              {Array.from({ length: def.length }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: isActive ? '#6366f1' : placed ? '#4338ca' : '#3f3f46',
                  }}
                />
              ))}
            </div>
            <span className="flex-1 truncate">{t(`battleship.ship.${def.id}`)}</span>
            {placed && (
              <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        );
      })}

      {/* Action buttons */}
      {!isReady && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={onRotate}
            disabled={disabled}
            className="flex-1 py-1.5 text-xs rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 transition-colors"
          >
            {t('battleship.setup.rotate')} {orientation === 'H' ? '→' : '↓'}
          </button>
          <button
            onClick={onReset}
            disabled={disabled || placedIds.size === 0}
            className="flex-1 py-1.5 text-xs rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 transition-colors"
          >
            {t('battleship.setup.reset')}
          </button>
        </div>
      )}

      {canReady && !isReady && (
        <button
          onClick={onReady}
          className="mt-1 w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-colors"
        >
          {t('battleship.setup.ready')}
        </button>
      )}

      {isReady && (
        <div className="mt-1 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {t('battleship.setup.ready')}
          </div>
          {!oppReady && (
            <p className="text-xs text-zinc-500">{t('battleship.setup.waitOpponent')}</p>
          )}
          {oppReady && (
            <p className="text-xs text-amber-400">{t('battleship.setup.opponentReady')}</p>
          )}
        </div>
      )}

      {!isReady && allPlaced && (
        <p className="text-xs text-zinc-500 text-center">{t('battleship.setup.allPlaced')}</p>
      )}
    </div>
  );
}

const DEV = process.env.NODE_ENV !== 'production';

// ── Main component ────────────────────────────────────────────────────────────

export function BattleshipGame({ wsUrl, gameId, initialRoomCode, quickPlay: isQuickPlay }: GameComponentProps) {
  const router    = useRouter();
  const mp        = useMultiplayer<BattleshipState>(wsUrl, gameId);
  const { t }     = useI18n();

  const [joinInput,       setJoinInput]       = useState(initialRoomCode ?? '');
  const [copied,          setCopied]           = useState(false);
  const [roomVisibility,  setRoomVisibility]   = useState<'private' | 'public'>('private');
  const [roomName,        setRoomName]         = useState('');
  const [showInfo,        setShowInfo]         = useState(false);
  const [chatOpen,        setChatOpen]         = useState(false);
  const [unread,          setUnread]           = useState(0);
  const [placeError,      setPlaceError]       = useState<string | null>(null);
  const placeErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Setup phase state (client-only)
  const [orientation,   setOrientation]  = useState<Orientation>('H');
  const [hoverCoord,    setHoverCoord]   = useState<Coord | null>(null);
  const [activeShipId,  setActiveShipId] = useState<ShipId>('carrier');

  const autoJoined      = useRef(false);
  const prevTotalRef    = useRef<number | null>(null);

  // ── Connection effects ──────────────────────────────────────────────────────

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

  // Track unread chat messages
  useEffect(() => {
    const total = mp.roomMessages.length + mp.globalMessages.length;
    if (prevTotalRef.current === null) { prevTotalRef.current = total; return; }
    if (!chatOpen && total > prevTotalRef.current) {
      setUnread((u) => u + (total - prevTotalRef.current!));
    }
    prevTotalRef.current = total;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp.roomMessages.length, mp.globalMessages.length]);

  // Auto-advance activeShipId to the next unplaced ship after a successful placement
  const myIdx: 0 | 1 | null = mp.playerIndex as 0 | 1 | null;
  const oppIdx: 0 | 1 | null = myIdx !== null ? (myIdx === 0 ? 1 : 0) : null;
  const mySlot: BsSlot | null = myIdx !== null ? (myIdx === 0 ? 'A' : 'B') : null;
  const gs = mp.gameState;

  const ownShipsLen = gs?.players[myIdx ?? 0]?.ships.length ?? 0;

  useEffect(() => {
    if (!gs || myIdx === null || gs.phase !== 'setup') return;
    const placedIds = new Set(gs.players[myIdx].ships.map((s) => s.id));
    setActiveShipId((prev) => {
      if (!placedIds.has(prev)) return prev; // not yet placed, keep current
      const next = SHIP_DEFS.find((d) => !placedIds.has(d.id));
      return next?.id ?? prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownShipsLen, myIdx]);

  // Reset activeShipId on rematch (gs goes null then back to a fresh state)
  useEffect(() => {
    if (gs?.phase === 'setup' && ownShipsLen === 0) {
      setActiveShipId('carrier');
    }
  }, [gs?.phase, ownShipsLen]);

  // Mirror server action errors to the inline placement banner during setup
  useEffect(() => {
    if (mp.error && gs?.phase === 'setup') {
      showPlaceError(mp.error);
      mp.clearError();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp.error]);

  // ── Derived state ───────────────────────────────────────────────────────────

  const p0nick = mp.players.find((p) => p.index === 0)?.nickname ?? t('game.common.player1');
  const p1nick = mp.players.find((p) => p.index === 1)?.nickname ?? t('game.common.player2');
  const myNick  = myIdx !== null ? (mp.players.find((p) => p.index === myIdx)?.nickname ?? `Player ${myIdx + 1}`) : null;
  const oppNick = myIdx !== null ? (mp.players.find((p) => p.index !== myIdx)?.nickname ?? t('game.common.opponent')) : null;

  // currentTurn is now a player token (UUID), not a BsSlot.
  const myPlayerId = gs && myIdx !== null ? gs.playerIds[myIdx] : null;
  const isMyTurn = !mp.isSpectator && gs?.phase === 'playing' && myPlayerId !== null && gs.currentTurn === myPlayerId;
  const canFire  = isMyTurn && mp.matchCountdown === null;

  const placedIds = useMemo(
    () => new Set(gs?.players[myIdx ?? 0]?.ships.map((s) => s.id) ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ownShipsLen, myIdx],
  );

  const isMyReady  = myIdx !== null ? (gs?.players[myIdx]?.ready ?? false) : false;
  const isOppReady = oppIdx !== null ? (gs?.players[oppIdx]?.ready ?? false) : false;
  const canReady   = !isMyReady && placedIds.size >= SHIP_DEFS.length && !mp.isSpectator;

  // Preview cells for setup hover
  const previewCells = useMemo((): Coord[] => {
    if (!hoverCoord || isMyReady || mp.isSpectator || !gs || gs.phase !== 'setup') return [];
    const def = SHIP_DEFS.find((d) => d.id === activeShipId);
    if (!def) return [];
    return shipCellsFromOrigin(hoverCoord, orientation, def.length);
  }, [hoverCoord, activeShipId, orientation, isMyReady, mp.isSpectator, gs?.phase]); // eslint-disable-line

  const isPreviewValid = useMemo((): boolean => {
    if (previewCells.length === 0) return false;
    if (!previewCells.every(inBounds)) return false;
    const others = gs?.players[myIdx ?? 0]?.ships.filter((s) => s.id !== activeShipId) ?? [];
    const occupied = others.flatMap((s) => s.cells ?? []);
    return !previewCells.some((c) => occupied.some((o) => coordEq(c, o)));
  }, [previewCells, gs, myIdx, activeShipId]);

  // Board cell arrays
  const setupCells = useMemo((): CellView[] => {
    if (!gs || myIdx === null) return Array(BOARD_SIZE * BOARD_SIZE).fill('empty') as CellView[];
    return buildSetupCells(gs.players[myIdx].ships, previewCells, isPreviewValid);
  }, [gs, myIdx, previewCells, isPreviewValid]);

  const ownCells = useMemo((): CellView[] => {
    if (!gs || myIdx === null) return Array(BOARD_SIZE * BOARD_SIZE).fill('empty') as CellView[];
    return buildOwnCells(gs.players[myIdx]);
  }, [gs, myIdx]);

  const oppCells = useMemo((): CellView[] => {
    if (!gs || myIdx === null || oppIdx === null) return Array(BOARD_SIZE * BOARD_SIZE).fill('empty') as CellView[];
    return buildOppCells(gs.shotsFired[myIdx], gs.players[oppIdx].ships);
  }, [gs, myIdx, oppIdx]);

  // Spectator boards: show shots landing ON each player's grid.
  // specP0Cells = player 1's shots onto player 0's board.
  // specP1Cells = player 0's shots onto player 1's board.
  // (ship cells are always stripped in spectator projection, so no ship positions leak)
  const specP0Cells = useMemo(
    () => gs ? buildOppCells(gs.shotsFired[1], gs.players[0].ships) : Array(100).fill('empty') as CellView[],
    [gs],
  );
  const specP1Cells = useMemo(
    () => gs ? buildOppCells(gs.shotsFired[0], gs.players[1].ships) : Array(100).fill('empty') as CellView[],
    [gs],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handlePlaceShip(coord: Coord) {
    if (DEV) console.log('[BS] click place', {
      coord,
      orientation,
      selectedShipId: activeShipId,
      phase: gs?.phase,
      ready: isMyReady,
      playerIndex: myIdx,
      isPreviewValid,
    });
    if (!activeShipId || isMyReady || mp.isSpectator) return;
    if (!isPreviewValid) {
      if (DEV) console.log('[BS] placement blocked client-side: preview invalid');
      return;
    }
    const action = { type: 'BS_PLACE_SHIP' as const, shipId: activeShipId, origin: coord, orientation };
    if (DEV) console.log('[BS] dispatch', action);
    mp.sendAction(action);
  }

  function showPlaceError(msg: string) {
    setPlaceError(msg);
    if (placeErrorTimerRef.current) clearTimeout(placeErrorTimerRef.current);
    placeErrorTimerRef.current = setTimeout(() => setPlaceError(null), 3000);
  }

  function handleFire(coord: Coord) {
    if (!canFire) return;
    mp.sendAction({ type: 'BS_FIRE', at: coord });
  }

  function handleReset() {
    mp.sendAction({ type: 'BS_RESET_PLACEMENT' });
    setActiveShipId('carrier');
  }

  function copyInvite() {
    if (!mp.roomCode) return;
    navigator.clipboard.writeText(`${window.location.origin}/games/${gameId}?room=${mp.roomCode}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Status banner ───────────────────────────────────────────────────────────

  function StatusBanner() {
    if (mp.phase === 'lobby') return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.joinPrompt')}</p>;

    if (mp.isSpectator) {
      if (!gs) return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.watching')}</p>;
      if (gs.phase === 'setup') return <p className="text-zinc-500 text-sm text-center">{t('battleship.setup.title')}</p>;
      if (gs.phase === 'finished') {
        const winSlot = gs.winner!;
        const winNick = winSlot === 'A' ? p0nick : p1nick;
        return <p className="text-lg font-bold text-center text-yellow-400">{winNick} {t('game.status.wins')}</p>;
      }
      const turnNick = gs.currentTurn === gs.playerIds[0] ? p0nick : p1nick;
      return (
        <div className="flex items-center gap-2 text-zinc-400 text-sm justify-center">
          <span className="w-2 h-2 rounded-full animate-pulse bg-zinc-400" />
          {turnNick}{t('game.status.turnSuffix')}
        </div>
      );
    }

    if (mp.phase === 'waiting') return (
      <div className="flex items-center gap-2 text-amber-400 text-sm justify-center">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        {t('game.status.waitingToJoin')}
      </div>
    );

    if (!gs) return null;

    if (gs.phase === 'setup') {
      if (isMyReady) return (
        <div className="flex items-center gap-2 text-emerald-400 text-sm justify-center">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          {t('battleship.setup.waitOpponent')}
        </div>
      );
      const def = SHIP_DEFS.find((d) => d.id === activeShipId);
      if (def) return (
        <p className="text-sm text-zinc-300 text-center">
          {t('battleship.setup.placing')}{' '}
          <span className="font-semibold text-indigo-400">{t(`battleship.ship.${def.id}`)}</span>
          <span className="text-zinc-600"> ({def.length})</span>
        </p>
      );
      return <p className="text-sm text-zinc-500 text-center">{t('battleship.setup.allPlaced')}</p>;
    }

    if (gs.phase === 'finished') {
      const iWon = gs.winner !== null && gs.winner === mySlot;
      return (
        <p className={`text-lg font-bold text-center ${iWon ? 'text-yellow-400' : 'text-zinc-400'}`}>
          {iWon ? `🏆 ${myNick} ${t('game.status.wins')}` : `${oppNick} ${t('game.status.wins')}`}
        </p>
      );
    }

    if (mp.phase === 'ended') return <p className="text-sm text-rose-400 text-center">{t('game.status.opponentDisconnected')}</p>;

    if (isMyTurn) return (
      <div className="flex items-center gap-2 text-indigo-300 text-sm justify-center font-medium">
        <span className="w-2 h-2 rounded-full animate-pulse bg-indigo-400" />
        {t('battleship.play.yourTurn')}
      </div>
    );

    return (
      <div className="flex items-center gap-2 text-zinc-400 text-sm justify-center">
        <span className="w-2 h-2 rounded-full animate-pulse bg-zinc-400" />
        {oppNick}{t('game.status.turnSuffix')}
      </div>
    );
  }

  // Last shot result banner
  function LastShotBanner() {
    if (!gs?.lastShot || gs.phase === 'setup') return null;
    const { lastShot } = gs;
    const byNick = lastShot.by === 'A' ? p0nick : p1nick;
    const isMine = lastShot.by === mySlot;
    const byLabel = isMine ? t('rps.you') : byNick;

    let msg: string;
    if (lastShot.sunkShipId) {
      msg = `${t('battleship.shot.sunk')} ${t(`battleship.ship.${lastShot.sunkShipId}`)}`;
    } else if (lastShot.result === 'hit') {
      msg = t('battleship.shot.hit');
    } else {
      msg = t('battleship.shot.miss');
    }

    const isHit = lastShot.result === 'hit';

    return (
      <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border ${
        isHit
          ? 'text-rose-300 bg-rose-950/50 border-rose-800/60'
          : 'text-zinc-400 bg-zinc-800/50 border-zinc-700/60'
      }`}>
        <span className="text-zinc-500 text-xs">{byLabel}:</span>
        <span className="font-semibold">{msg}</span>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      {/* ── Game area ──────────────────────────────────────────────────────── */}
      <div className="relative flex-1 flex flex-col items-center gap-4 min-h-[400px]">
        <CountdownOverlay countdown={mp.matchCountdown} />
        <StatusBanner />

        {/* ── Setup phase ──────────────────────────────────────────────────── */}
        {gs?.phase === 'setup' && !mp.isSpectator && myIdx !== null && (
          <div className="flex flex-col sm:flex-row gap-6 items-start justify-center w-full">
            <div className="flex flex-col items-center gap-2">
              <BsGrid
                cells={setupCells}
                onCell={handlePlaceShip}
                onHover={setHoverCoord}
                disabled={isMyReady}
                hoverCoord={isMyReady ? null : hoverCoord}
                cellSize={30}
              />
              {placeError && (
                <div className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800/60 rounded-lg px-3 py-1.5 w-full text-center">
                  {placeError}
                </div>
              )}
            </div>
            <ShipRoster
              placedIds={placedIds}
              activeShipId={isMyReady ? null : activeShipId}
              onSelect={setActiveShipId}
              orientation={orientation}
              onRotate={() => setOrientation((o) => (o === 'H' ? 'V' : 'H'))}
              onReset={handleReset}
              onReady={() => mp.sendAction({ type: 'BS_READY' })}
              canReady={canReady}
              isReady={isMyReady}
              oppReady={isOppReady}
              disabled={mp.matchCountdown !== null}
              t={t}
            />
          </div>
        )}

        {/* ── Spectator banner (shown in all phases) ───────────────────────── */}
        {mp.isSpectator && (
          <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded-lg px-3 py-2 w-full justify-center">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {t('battleship.spectator.banner')}
          </div>
        )}

        {/* ── Spectator during setup ────────────────────────────────────────── */}
        {gs?.phase === 'setup' && mp.isSpectator && (
          <p className="text-sm text-zinc-500 text-center">{t('battleship.spectator.setup')}</p>
        )}

        {/* ── Playing / Finished phase ──────────────────────────────────────── */}
        {gs && (gs.phase === 'playing' || gs.phase === 'finished') && (
          <div className="flex flex-col items-center gap-4 w-full">
            <LastShotBanner />

            {/* Two boards */}
            <div className="flex flex-col sm:flex-row gap-6 items-start justify-center w-full overflow-x-auto">
              {mp.isSpectator ? (
                <>
                  <BsGrid
                    cells={specP0Cells}
                    label={`${p0nick} ${t('game.room.watching')}`}
                    disabled
                    cellSize={26}
                  />
                  <BsGrid
                    cells={specP1Cells}
                    label={`${p1nick} ${t('game.room.watching')}`}
                    disabled
                    cellSize={26}
                  />
                </>
              ) : (
                <>
                  <BsGrid
                    cells={ownCells}
                    disabled
                    cellSize={26}
                    label={t('battleship.play.yourBoard')}
                  />
                  <BsGrid
                    cells={oppCells}
                    onCell={handleFire}
                    onHover={canFire ? setHoverCoord : undefined}
                    disabled={!canFire}
                    hoverCoord={canFire ? hoverCoord : null}
                    cellSize={26}
                    label={t('battleship.play.enemyBoard')}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Rematch / Leave ──────────────────────────────────────────────── */}
        {!mp.isSpectator && gs?.phase === 'finished' && mp.playerCount === 2 && (
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

        {(mp.phase === 'playing' || mp.phase === 'ended') && (
          <button
            onClick={mp.leaveRoom}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            {t('game.actions.leaveRoom')}
          </button>
        )}
      </div>

      {/* ── Side panel ─────────────────────────────────────────────────────── */}
      <aside className="lg:w-72 flex flex-col gap-3">
        {/* Connection */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${
              mp.connection === 'connected'  ? 'bg-emerald-400' :
              mp.connection === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'
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
              <span className="text-xs text-zinc-500">{mp.playerCount}/2</span>
              {mp.spectatorCount > 0 && <span className="text-xs text-zinc-600 ml-1">{mp.spectatorCount} {t('game.room.watching')}</span>}
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
                  const p = mp.players.find((pp) => pp.index === idx);
                  if (!p) return null;
                  const isMe = !mp.isSpectator && mp.playerIndex === idx;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
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

        {/* Stats & Rules */}
        <button
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors self-start px-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('game.info.statsRules')}
        </button>
      </aside>

      {/* Game Info Modal */}
      <GameInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        stats={mp.stats}
        playerIndex={mp.isSpectator ? null : mp.playerIndex}
        history={mp.history}
        myNickname={mp.myNickname}
        rules={
          <ul className="text-sm text-zinc-400 space-y-1.5 list-disc list-inside">
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n}>{t(`battleship.rules.${n}`)}</li>
            ))}
          </ul>
        }
      />
    </div>
  );
}
