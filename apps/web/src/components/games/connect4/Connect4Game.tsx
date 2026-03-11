'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Connect4Cell, Connect4State } from 'shared';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import type { GameComponentProps } from '@/lib/gameRegistry';
import { CountdownOverlay } from '@/components/CountdownOverlay';
import { WaitingForConnectionOverlay } from '@/components/WaitingForConnectionOverlay';
import { ChatPanelWithProfile as ChatPanel } from '@/components/chat/ChatPanelWithProfile';
import { NicknameEditor } from '@/components/NicknameEditor';
import { GameInfoModal } from '@/components/GameInfoModal';
import { useI18n } from '@/components/providers/LanguageProvider';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { getNameColorClass } from '@/lib/nameColors';
import { RoomInviteButton } from '@/components/social/RoomInviteButton';
import { useAchievements } from '@/hooks/useAchievements';
import { SpectatorBanner } from '@/components/ui/SpectatorBanner';
import { ReplayControls } from '@/components/ui/ReplayControls';

const ROWS = 6;
const COLS = 7;

const PIECE_COLORS = {
  bg: { 1: '#ca8a04', 2: '#e11d48' },
  glow: { 1: 'rgba(234,179,8,0.55)', 2: 'rgba(244,63,94,0.55)' },
  hover: { 1: 'rgba(202,138,4,0.22)', 2: 'rgba(225,29,72,0.22)' },
} as const;

export function Connect4Game({ wsUrl, gameId, initialRoomCode, quickPlay: isQuickPlay }: GameComponentProps) {
  const router = useRouter();
  const mp = useMultiplayer<Connect4State>(wsUrl, gameId);
  const { t } = useI18n();
  const ach = useAchievements('connect4');
  const [joinInput, setJoinInput] = useState(initialRoomCode ?? '');
  const [copied, setCopied] = useState(false);
  const [roomVisibility, setRoomVisibility] = useState<'private' | 'public'>('private');
  const [roomName, setRoomName] = useState('');
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [fallingCell, setFallingCell] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [replayState, setReplayState] = useState<Connect4State | null>(null);
  const [replayMode, setReplayMode] = useState(false);
  const prevTotalRef = useRef<number | null>(null);
  const prevBoardRef = useRef<Connect4Cell[][] | null>(null);
  const autoJoined = useRef(false);

  useEffect(() => {
    if (mp.connection === 'connected' && initialRoomCode && !autoJoined.current && mp.phase === 'lobby') {
      autoJoined.current = true;
      mp.joinRoom(initialRoomCode);
    }
  }, [mp.connection, initialRoomCode, mp.phase]); // eslint-disable-line

  // Auto quick-play when ?quickplay=true
  useEffect(() => {
    if (mp.connection === 'connected' && isQuickPlay && !autoJoined.current && mp.phase === 'lobby') {
      autoJoined.current = true;
      mp.quickPlay();
    }
  }, [mp.connection, isQuickPlay, mp.phase]); // eslint-disable-line

  // Replace URL with ?room=CODE once matched (for shareability + refresh)
  useEffect(() => {
    if (isQuickPlay && mp.roomCode) {
      router.replace(`/games/${gameId}?room=${mp.roomCode}`);
    }
  }, [mp.roomCode]); // eslint-disable-line

  // Track unread messages while chat is collapsed
  useEffect(() => {
    const total = mp.roomMessages.length + mp.globalMessages.length;
    if (prevTotalRef.current === null) {
      prevTotalRef.current = total;
      return;
    }
    if (!chatOpen && total > prevTotalRef.current) {
      setUnread((u) => u + (total - prevTotalRef.current!));
    }
    prevTotalRef.current = total;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp.roomMessages.length, mp.globalMessages.length]);

  // ── Achievement tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (mp.phase === 'playing' && !mp.isSpectator && mp.gameState?.status === 'ongoing') ach.trackPlay();
  }, [mp.phase, mp.gameState?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const gs = mp.gameState;
    if (gs?.status === 'win' && mp.playerIndex !== null && gs.winner === gs.players[mp.playerIndex]?.id) {
      ach.trackWin();
    }
  }, [mp.gameState?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const gs = mp.gameState;
  const myPiece = mp.playerIndex !== null ? ([1, 2][mp.playerIndex] as 1 | 2) : null;

  // Nickname helpers
  const p0nick = mp.players.find((p) => p.index === 0)?.nickname ?? t('game.common.player1');
  const p1nick = mp.players.find((p) => p.index === 1)?.nickname ?? t('game.common.player2');
  const myNick = mp.playerIndex !== null ? (mp.players.find((p) => p.index === mp.playerIndex)?.nickname ?? `Player ${mp.playerIndex + 1}`) : null;
  const oppNick = mp.playerIndex !== null ? (mp.players.find((p) => p.index !== mp.playerIndex)?.nickname ?? t('game.common.opponent')) : null;

  const isMyTurn =
    !mp.isSpectator &&
    gs !== null &&
    myPiece !== null &&
    gs.currentPlayer === gs.players[mp.playerIndex!]?.id;

  const boardDisabled =
    replayMode || mp.isSpectator || mp.phase !== 'playing' || !mp.roomReady || !isMyTurn || gs?.status !== 'ongoing' || mp.matchCountdown !== null;

  // Detect newly placed piece to trigger fall animation (local + remote moves)
  useEffect(() => {
    if (!gs?.board) { prevBoardRef.current = null; return; }
    const curr = gs.board;
    const prev = prevBoardRef.current;
    if (prev !== null) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (prev[r][c] === 0 && curr[r][c] !== 0) {
            setFallingCell(`${r},${c}`);
            const t = setTimeout(() => setFallingCell(null), 120 + r * 55);
            prevBoardRef.current = curr;
            return () => clearTimeout(t);
          }
        }
      }
    }
    prevBoardRef.current = curr;
  }, [gs?.board]); // eslint-disable-line

  const winSet = useMemo(
    () => new Set<string>(gs?.winnerCells?.map(([r, c]) => `${r},${c}`) ?? []),
    [gs?.winnerCells],
  );

  // Preview: which row would the piece land in on hover?
  const previewRow = useMemo(() => {
    if (hoveredCol === null || !gs?.board || boardDisabled) return null;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (gs.board[r][hoveredCol] === 0) return r;
    }
    return null; // column full
  }, [hoveredCol, gs?.board, boardDisabled]);

  const displayGs = replayMode && replayState ? replayState : gs;
  const board = displayGs?.board ?? Array.from({ length: ROWS }, () => Array<0>(COLS).fill(0));
  const displayWinSet = replayMode && replayState
    ? new Set<string>(replayState.winnerCells?.map(([r, c]: [number, number]) => `${r},${c}`) ?? [])
    : winSet;

  function handleDrop(col: number) {
    if (boardDisabled) return;
    mp.sendAction({ type: 'drop', column: col });
  }

  function copyInvite() {
    if (!mp.roomCode) return;
    const url = `${window.location.origin}/games/connect4?room=${mp.roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      ach.trackInvite();
    });
  }

  // ── Status ─────────────────────────────────────────────────────────────────
  function StatusBanner() {
    if (mp.phase === 'lobby') return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.joinPrompt')}</p>;

    if (mp.isSpectator) {
      if (!gs) return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.watching')}</p>;
      if (gs.status === 'win') {
        const winnerIdx = gs.players[0].id === gs.winner ? 0 : 1;
        const winnerNick = winnerIdx === 0 ? p0nick : p1nick;
        const p = gs.players[winnerIdx]?.piece;
        return <p className="text-lg font-bold text-center" style={{ color: p ? PIECE_COLORS.bg[p] : undefined }}>{winnerNick} {t('game.status.wins')}</p>;
      }
      if (gs.status === 'draw') return <p className="text-lg font-bold text-center text-zinc-400">{t('game.status.draw')}</p>;
      const turnIdx = gs.players[0].id === gs.currentPlayer ? 0 : 1;
      const turnNick = turnIdx === 0 ? p0nick : p1nick;
      const p = gs.players[turnIdx]?.piece;
      return (
        <div className="flex items-center gap-2 text-zinc-400 text-sm justify-center">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: p ? PIECE_COLORS.bg[p] : '#71717a' }} />
          {turnNick}{t('game.status.turnSuffix')}
        </div>
      );
    }

    if (mp.phase === 'waiting') return (
      <div className="flex items-center gap-2 text-amber-400 text-sm justify-center">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        {t('game.status.waiting')}
      </div>
    );

    if (!gs) return null;

    if (gs.status === 'win') {
      const iWon = gs.winner === gs.players[mp.playerIndex!]?.id;
      return <p className={`text-lg font-bold text-center ${iWon ? 'text-yellow-400' : 'text-zinc-400'}`}>{iWon ? `🏆 ${myNick} ${t('game.status.wins')}` : `${oppNick} ${t('game.status.wins')}`}</p>;
    }
    if (gs.status === 'draw') return <p className="text-lg font-bold text-center text-zinc-400">{t('game.status.draw')}</p>;
    if (mp.phase === 'ended') return <p className="text-sm text-rose-400 text-center">{t('game.status.opponentDisconnected')}</p>;

    if (isMyTurn) {
      const color = myPiece ? PIECE_COLORS.bg[myPiece] : '#818cf8';
      return (
        <div className="flex items-center gap-2 text-sm justify-center font-medium" style={{ color }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          {myNick}{t('game.status.turnSuffix')}
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

  // ── Board ──────────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] w-full items-start">
      {/* Board area */}
      <div className="relative min-w-0 flex flex-col items-center justify-center gap-5 min-h-[480px]">
        <CountdownOverlay countdown={mp.matchCountdown} />
        <WaitingForConnectionOverlay
          show={mp.phase === 'playing' && !mp.roomReady && !mp.isSpectator}
          label={t('game.ready.waiting')}
        />
        <StatusBanner />

        <div
          className="select-none"
          onMouseLeave={() => setHoveredCol(null)}
        >
          {/* Column drop buttons — show ghost piece above board; also set hover column */}
          <div
            className="grid mb-1"
            style={{ gridTemplateColumns: `repeat(${COLS}, 44px)`, gap: '6px', paddingInline: '10px' }}
          >
            {Array.from({ length: COLS }, (_, col) => (
              <button
                key={col}
                onClick={() => handleDrop(col)}
                disabled={boardDisabled}
                onMouseEnter={() => setHoveredCol(col)}
                aria-label={`Drop in column ${col + 1}`}
                className="h-8 rounded-lg flex items-center justify-center transition-colors disabled:cursor-default"
                style={{
                  backgroundColor:
                    !boardDisabled && hoveredCol === col && myPiece
                      ? PIECE_COLORS.hover[myPiece]
                      : 'transparent',
                }}
              >
                {!boardDisabled && hoveredCol === col && myPiece && (
                  <div
                    className="rounded-full"
                    style={{
                      width: 34,
                      height: 34,
                      backgroundColor: PIECE_COLORS.bg[myPiece],
                      opacity: 0.7,
                      boxShadow: `0 0 10px 3px ${PIECE_COLORS.glow[myPiece]}`,
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Board — relative so the overlay can be positioned inside it */}
          <div
            className="relative rounded-2xl shadow-2xl overflow-hidden"
            style={{ backgroundColor: '#1e1b5e', padding: '10px' }}
          >
            {/* Grid cells (visual only — pointer events handled by overlay below) */}
            <div
              style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 44px)`, gap: '6px' }}
            >
              {Array.from({ length: ROWS }, (_, row) =>
                Array.from({ length: COLS }, (_, col) => {
                  const cell = board[row]?.[col] ?? 0;
                  const isWin = displayWinSet.has(`${row},${col}`);
                  const isPreview = !cell && row === previewRow && col === hoveredCol && myPiece;

                  let bg = '#09050f'; // empty cell
                  if (cell === 1 || cell === 2) bg = PIECE_COLORS.bg[cell];
                  else if (isPreview && myPiece) bg = PIECE_COLORS.hover[myPiece];

                  const isFalling = fallingCell === `${row},${col}`;
                  const fallFrom = `${-(row * 50 + 54)}px`;

                  return (
                    <div
                      key={`${row},${col}`}
                      className="rounded-full"
                      style={{
                        width: 44,
                        height: 44,
                        backgroundColor: bg,
                        boxShadow: isWin && cell
                          ? `0 0 16px 5px ${PIECE_COLORS.glow[cell as 1 | 2]}`
                          : cell
                          ? 'inset 0 2px 5px rgba(0,0,0,0.45)'
                          : 'inset 0 3px 7px rgba(0,0,0,0.6)',
                        transform: isFalling ? undefined : isWin ? 'scale(1.08)' : 'scale(1)',
                        transition: isFalling ? 'none' : 'background-color 0.1s',
                        animation: isFalling
                          ? `c4drop ${120 + row * 55}ms ease-in forwards`
                          : isWin && cell
                          ? 'c4pulse 1.1s ease-in-out infinite'
                          : undefined,
                        ...( isFalling ? { '--c4-from': fallFrom } as React.CSSProperties : {}),
                      } as React.CSSProperties}
                    />
                  );
                }),
              )}
            </div>

            {/* Full-height column overlay — covers entire board height so hover + click
                work no matter where in the column the cursor is */}
            <div
              className="absolute inset-0 z-10"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                padding: '10px',
              }}
            >
              {Array.from({ length: COLS }, (_, col) => {
                const colFull = gs?.board ? gs.board[0][col] !== 0 : false;
                const isDisabled = boardDisabled || colFull;
                return (
                  <div
                    key={col}
                    onMouseEnter={() => setHoveredCol(col)}
                    onClick={() => { if (!isDisabled) handleDrop(col); }}
                    style={{ cursor: !isDisabled ? 'pointer' : 'default' }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {mp.isSpectator && <SpectatorBanner spectatorCount={mp.spectatorCount} />}

        {/* Replay */}
        <ReplayControls<Connect4State>
          history={mp.stateHistory as Connect4State[]}
          gameEnded={mp.phase === 'ended'}
          onStep={(state) => setReplayState(state)}
          onToggle={(active) => { setReplayMode(active); if (!active) setReplayState(null); }}
        />

        {/* Rematch */}
        {!mp.isSpectator && gs && gs.status !== 'ongoing' && mp.playerCount === 2 && !replayMode && (
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

      {/* Side panel */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-24 h-fit">
        {/* Connection */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${
              mp.connection === 'connected' ? 'bg-emerald-400' :
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

        {/* Lobby: quick-play searching OR create / join */}
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
            <RoomInviteButton
              playerIndex={mp.playerIndex}
              playerCount={mp.playerCount}
              maxPlayers={mp.roomMaxPlayers}
              onlineUsers={mp.onlineUsers}
              onInvite={mp.sendRoomInvite}
              onRefreshUsers={mp.fetchOnlineUsers}
              playerNicknames={mp.players.map(p => p.nickname)}
            />
            {mp.players.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-zinc-800">
                {([0, 1] as const).map((idx) => {
                  const p = mp.players.find((pp) => pp.index === idx);
                  if (!p) return null;
                  const piece = (idx + 1) as 1 | 2;
                  const isMe = !mp.isSpectator && mp.playerIndex === idx;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <AvatarBubble avatarId={p.avatarId} avatarFrame={p.avatarFrame} nickname={p.nickname} size="sm" cosmetics={p.cosmetics} />
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIECE_COLORS.bg[piece] }} />
                      <span className={`truncate ${getNameColorClass(p.cosmetics?.nameColor ?? p.nameColor) || 'text-zinc-300'}`}>{p.nickname}</span>
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

        {/* Chat — collapsible */}
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

        {/* Game Info button */}
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

      {/* Game Info modal (Stats + Rules + History) */}
      <GameInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        stats={mp.stats}
        playerIndex={mp.isSpectator ? null : mp.playerIndex}
        history={mp.history}
        myNickname={mp.myNickname}
        rules={
          <ul className="text-sm text-zinc-400 space-y-1.5 list-disc list-inside">
            <li>{t('connect4.rules.1')}</li>
            <li>{t('connect4.rules.2')}</li>
            <li>{t('connect4.rules.3')}</li>
            <li>{t('connect4.rules.4')}</li>
            <li>{t('connect4.rules.5')}</li>
          </ul>
        }
      />
    </div>
  );
}
