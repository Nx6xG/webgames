'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { TicTacToeState } from 'shared';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import type { GameComponentProps } from '@/lib/gameRegistry';
import { TicTacToeBoard } from './TicTacToeBoard';
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
import { ReconnectBanner } from '@/components/ui/ReconnectBanner';
import { ReplayControls } from '@/components/ui/ReplayControls';
import { useReplay } from '@/hooks/useReplay';
import { useAutoJoin } from '@/hooks/useAutoJoin';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

export function TicTacToeGame({ wsUrl, gameId, initialRoomCode, quickPlay: isQuickPlay }: GameComponentProps) {
  const router = useRouter();
  const mp = useMultiplayer<TicTacToeState>(wsUrl, gameId);
  const { t } = useI18n();
  const ach = useAchievements('tictactoe', mp.roomCode);
  const [joinInput, setJoinInput] = useState(initialRoomCode ?? '');
  const [copied, setCopied] = useState(false);
  const [roomVisibility, setRoomVisibility] = useState<'private' | 'public'>('private');
  const [roomName, setRoomName] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const { chatOpen, setChatOpen, unread } = useUnreadMessages(mp);
  const replay = useReplay<TicTacToeState>(mp.stateHistory as TicTacToeState[]);

  useAutoJoin(mp, initialRoomCode, isQuickPlay, 'tictactoe');

  // Replace URL with ?room=CODE once matched (for shareability + refresh)
  useEffect(() => {
    if (isQuickPlay && mp.roomCode) {
      router.replace(`/games/${gameId}?room=${mp.roomCode}`);
    }
  }, [mp.roomCode]); // eslint-disable-line

  // ── Achievement tracking ──────────────────────────────────────────────────
  const prevPhaseRef = useRef(mp.phase);
  useEffect(() => {
    if (prevPhaseRef.current === 'ended' && mp.phase !== 'ended') ach.reset();
    prevPhaseRef.current = mp.phase;
  }, [mp.phase, ach]);

  useEffect(() => {
    if (mp.phase === 'playing' && !mp.isSpectator && mp.gameState?.status === 'ongoing') ach.trackPlay();
  }, [mp.phase, mp.gameState?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const gs = mp.gameState;
    if (gs?.status === 'win' && mp.playerIndex !== null && gs.winner === gs.players[mp.playerIndex]?.id) {
      ach.trackWin();
    }
  }, [mp.gameState?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const gs = mp.gameState;
    if (gs?.status === 'win' && mp.playerIndex !== null && gs.winner !== gs.players[mp.playerIndex]?.id) {
      ach.trackLoss();
    }
  }, [mp.gameState?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const myMark = mp.playerIndex !== null ? (mp.playerIndex === 0 ? 'X' : 'O') : null;
  const gs = mp.gameState;

  // Nickname helpers
  const p0nick = mp.players.find((p) => p.index === 0)?.nickname ?? t('game.common.player1');
  const p1nick = mp.players.find((p) => p.index === 1)?.nickname ?? t('game.common.player2');
  const myNick = mp.playerIndex !== null ? (mp.players.find((p) => p.index === mp.playerIndex)?.nickname ?? `Player ${mp.playerIndex + 1}`) : null;
  const oppNick = mp.playerIndex !== null ? (mp.players.find((p) => p.index !== mp.playerIndex)?.nickname ?? t('game.common.opponent')) : null;

  const isMyTurn =
    !mp.isSpectator &&
    gs !== null &&
    myMark !== null &&
    gs.currentTurn === gs.players[mp.playerIndex!]?.id;

  const boardDisabled =
    mp.isSpectator ||
    mp.phase !== 'playing' ||
    !mp.roomReady ||
    !isMyTurn ||
    gs?.status !== 'ongoing' ||
    mp.matchCountdown !== null;

  function handleCellClick(idx: number) {
    const x = idx % 3;
    const y = Math.floor(idx / 3);
    mp.sendAction({ type: 'place_mark', x, y });
  }

  function copyInvite() {
    if (!mp.roomCode) return;
    const url = `${window.location.origin}/games/tictactoe?room=${mp.roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      ach.trackInvite();
    });
  }

  // ── Status banner ──────────────────────────────────────────────────────────
  function StatusBanner() {
    if (mp.phase === 'lobby') {
      return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.joinPrompt')}</p>;
    }
    if (mp.isSpectator) {
      if (!gs) return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.watching')}</p>;
      if (gs.status === 'win') {
        const winnerIdx = gs.players[0].id === gs.winner ? 0 : 1;
        return <p className="text-lg font-bold text-center text-yellow-400">{winnerIdx === 0 ? p0nick : p1nick} {t('game.status.wins')}</p>;
      }
      if (gs.status === 'draw') return <p className="text-lg font-bold text-center text-zinc-400">{t('game.status.draw')}</p>;
      const turnIdx = gs.players[0].id === gs.currentTurn ? 0 : 1;
      return (
        <div className="flex items-center gap-2 text-zinc-400 text-sm justify-center">
          <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
          {turnIdx === 0 ? p0nick : p1nick}{t('game.status.turnSuffix')}
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
      const iWon = gs.winner === gs.players[mp.playerIndex!]?.id;
      return (
        <p className={`text-lg font-bold text-center ${iWon ? 'text-yellow-400' : 'text-zinc-400'}`}>
          {iWon ? `🏆 ${myNick} ${t('game.status.wins')}` : `${oppNick} ${t('game.status.wins')}`}
        </p>
      );
    }
    if (gs.status === 'draw') {
      return <p className="text-lg font-bold text-center text-zinc-400">{t('game.status.draw')}</p>;
    }
    if (mp.phase === 'ended') {
      return <p className="text-sm text-rose-400 text-center">{t('game.status.opponentDisconnected')}</p>;
    }
    if (isMyTurn) {
      return (
        <div className="flex items-center gap-2 text-indigo-400 text-sm justify-center font-medium">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          {myNick}{t('game.status.turnSuffix')}
          <span className={`font-black ${myMark === 'X' ? 'text-indigo-300' : 'text-rose-300'}`}>({myMark})</span>
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

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] w-full items-start">
      {/* ── Board area ─────────────────────────────────────────────────────── */}
      <div className="relative min-w-0 flex flex-col items-center justify-center gap-6 min-h-[380px]">
        <CountdownOverlay countdown={mp.matchCountdown} />
        <WaitingForConnectionOverlay
          show={mp.phase === 'playing' && !mp.roomReady && !mp.isSpectator}
          label={t('game.ready.waiting')}
        />
        <ReconnectBanner mp={mp} />
        <StatusBanner />
        <TicTacToeBoard
          board={(replay.displayState ?? gs)?.board ?? Array(9).fill(null)}
          winnerCells={replay.isReplaying ? (replay.currentState?.winnerCells ?? undefined) : gs?.winnerCells}
          disabled={boardDisabled || replay.isReplaying}
          onCellClick={handleCellClick}
        />
        {mp.isSpectator && <SpectatorBanner spectatorCount={mp.spectatorCount} />}

        {/* Replay */}
        <ReplayControls<TicTacToeState>
          replay={replay}
          gameEnded={mp.phase === 'ended'}
        />

        {/* Rematch */}
        {!mp.isSpectator && gs && gs.status !== 'ongoing' && mp.playerCount === 2 && !replay.isReplaying && (
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
            className="mt-2 px-4 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            {t('game.actions.leaveRoom')}
          </button>
        )}
      </div>

      {/* ── Side panel ─────────────────────────────────────────────────────── */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-24 h-fit">

        {/* Connection status */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${
              mp.connection === 'connected' ? 'bg-emerald-400' :
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
                  const mark = idx === 0 ? 'X' : 'O';
                  const isMe = !mp.isSpectator && mp.playerIndex === idx;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <AvatarBubble avatarId={p.avatarId} avatarFrame={p.avatarFrame} nickname={p.nickname} size="sm" cosmetics={p.cosmetics} />
                      <span className={`font-black text-sm ${idx === 0 ? 'text-indigo-400' : 'text-rose-400'}`}>{mark}</span>
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
          onOpenChange={setChatOpen}
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
            <li>{t('ttt.rules.1')}</li>
            <li>{t('ttt.rules.2')}</li>
            <li>{t('ttt.rules.3')}</li>
            <li>{t('ttt.rules.4')}</li>
          </ul>
        }
      />
    </div>
  );
}
