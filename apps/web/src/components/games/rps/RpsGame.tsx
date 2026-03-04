'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { RpsState, RpsPick } from 'shared';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import type { GameComponentProps } from '@/lib/gameRegistry';
import { CountdownOverlay } from '@/components/CountdownOverlay';
import { WaitingForConnectionOverlay } from '@/components/WaitingForConnectionOverlay';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { NicknameEditor } from '@/components/NicknameEditor';
import { GameInfoModal } from '@/components/GameInfoModal';
import { useI18n } from '@/components/providers/LanguageProvider';

const PICKS: RpsPick[] = ['rock', 'paper', 'scissors'];

const PICK_ICON: Record<RpsPick, string> = {
  rock:     '🪨',
  paper:    '📄',
  scissors: '✂️',
};

export function RpsGame({ wsUrl, gameId, initialRoomCode, quickPlay: isQuickPlay }: GameComponentProps) {
  const router = useRouter();
  const mp = useMultiplayer<RpsState>(wsUrl, gameId);
  const { t } = useI18n();
  const [joinInput, setJoinInput]         = useState(initialRoomCode ?? '');
  const [copied, setCopied]               = useState(false);
  const [roomVisibility, setRoomVisibility] = useState<'private' | 'public'>('private');
  const [roomName, setRoomName]           = useState('');
  const [showInfo, setShowInfo]           = useState(false);
  const [chatOpen, setChatOpen]           = useState(false);
  const [unread, setUnread]               = useState(0);
  const prevTotalRef = useRef<number | null>(null);
  const autoJoined   = useRef(false);

  // Auto-join from invite link
  useEffect(() => {
    if (mp.connection === 'connected' && initialRoomCode && !autoJoined.current && mp.phase === 'lobby') {
      autoJoined.current = true;
      mp.joinRoom(initialRoomCode);
    }
  }, [mp.connection, initialRoomCode, mp.phase]); // eslint-disable-line

  // Auto quick-play
  useEffect(() => {
    if (mp.connection === 'connected' && isQuickPlay && !autoJoined.current && mp.phase === 'lobby') {
      autoJoined.current = true;
      mp.quickPlay();
    }
  }, [mp.connection, isQuickPlay, mp.phase]); // eslint-disable-line

  // Replace URL with ?room=CODE once matched
  useEffect(() => {
    if (isQuickPlay && mp.roomCode) {
      router.replace(`/games/${gameId}?room=${mp.roomCode}`);
    }
  }, [mp.roomCode]); // eslint-disable-line

  // Track unread messages while chat is collapsed
  useEffect(() => {
    const total = mp.roomMessages.length + mp.globalMessages.length;
    if (prevTotalRef.current === null) { prevTotalRef.current = total; return; }
    if (!chatOpen && total > prevTotalRef.current) {
      setUnread((u) => u + (total - prevTotalRef.current!));
    }
    prevTotalRef.current = total;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp.roomMessages.length, mp.globalMessages.length]);

  const gs    = mp.gameState;
  const myIdx = mp.playerIndex; // 0 | 1 | null

  const p0nick  = mp.players.find((p) => p.index === 0)?.nickname ?? t('game.common.player1');
  const p1nick  = mp.players.find((p) => p.index === 1)?.nickname ?? t('game.common.player2');
  const myNick  = myIdx !== null ? (mp.players.find((p) => p.index === myIdx)?.nickname  ?? `Player ${myIdx + 1}`) : null;
  const oppNick = myIdx !== null ? (mp.players.find((p) => p.index !== myIdx)?.nickname ?? t('game.common.opponent')) : null;

  const PICK_LABEL: Record<RpsPick, string> = {
    rock:     t('rps.pick.rock'),
    paper:    t('rps.pick.paper'),
    scissors: t('rps.pick.scissors'),
  };

  const iHavePicked  = gs !== null && myIdx !== null && gs.hasPicked[myIdx];
  const oppHasPicked = gs !== null && myIdx !== null && gs.hasPicked[myIdx === 0 ? 1 : 0];
  const roundResolved = gs !== null && gs.picks[0] !== null && gs.picks[1] !== null;

  const canPick =
    !mp.isSpectator &&
    mp.phase === 'playing' &&
    mp.roomReady &&
    gs?.status === 'ongoing' &&
    !iHavePicked &&
    mp.matchCountdown === null;

  function handlePick(pick: RpsPick) {
    if (!canPick) return;
    mp.sendAction({ type: 'rps_pick', pick });
  }

  function copyInvite() {
    if (!mp.roomCode) return;
    const url = `${window.location.origin}/games/rps?room=${mp.roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Scoreboard ─────────────────────────────────────────────────────────────
  function Scoreboard() {
    if (!gs) return null;
    const s0 = gs.scores[0];
    const s1 = gs.scores[1];
    return (
      <div className="flex items-center justify-center gap-4 w-full">
        <span className={`text-sm font-semibold truncate max-w-[100px] ${myIdx === 0 ? 'text-indigo-300' : 'text-zinc-300'}`}>
          {p0nick}{myIdx === 0 ? ` ${t('game.common.you')}` : ''}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-3xl font-black tabular-nums ${s0 > s1 ? 'text-indigo-300' : 'text-zinc-400'}`}>{s0}</span>
          <span className="text-zinc-600 text-sm font-medium">—</span>
          <span className={`text-3xl font-black tabular-nums ${s1 > s0 ? 'text-indigo-300' : 'text-zinc-400'}`}>{s1}</span>
        </div>
        <span className={`text-sm font-semibold truncate max-w-[100px] text-right ${myIdx === 1 ? 'text-indigo-300' : 'text-zinc-300'}`}>
          {p1nick}{myIdx === 1 ? ` ${t('game.common.you')}` : ''}
        </span>
      </div>
    );
  }

  // ── Round result reveal ─────────────────────────────────────────────────────
  function RoundReveal() {
    if (!gs || !roundResolved) return null;
    const p0pick = gs.picks[0]!;
    const p1pick = gs.picks[1]!;
    const res = gs.lastRoundResult;

    const leftPick  = myIdx === 1 ? p1pick : p0pick;
    const rightPick = myIdx === 1 ? p0pick : p1pick;
    const iWonRound  = res === (myIdx === 0 ? 'p0_wins' : 'p1_wins');
    const oppWonRound = res === (myIdx === 0 ? 'p1_wins' : 'p0_wins');

    const resultLabel = res === 'draw'
      ? t('game.status.draw')
      : iWonRound
        ? t('rps.roundWin')
        : t('rps.roundLose');

    const resultColor = res === 'draw' ? 'text-zinc-400' : iWonRound ? 'text-emerald-400' : 'text-rose-400';

    // Spectator view
    if (mp.isSpectator || myIdx === null) {
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <span className="text-4xl">{PICK_ICON[p0pick]}</span>
              <span className="text-xs text-zinc-500">{p0nick}</span>
            </div>
            <span className="text-zinc-600 text-sm">vs</span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-4xl">{PICK_ICON[p1pick]}</span>
              <span className="text-xs text-zinc-500">{p1nick}</span>
            </div>
          </div>
          <p className={`text-sm font-semibold ${res === 'draw' ? 'text-zinc-400' : res === 'p0_wins' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {res === 'draw' ? t('game.status.draw') : res === 'p0_wins' ? `${p0nick} ${t('game.status.wins')}` : `${p1nick} ${t('game.status.wins')}`}
          </p>
          <p className="text-xs text-zinc-600">{t('rps.pickNextRound')}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-5xl">{PICK_ICON[leftPick]}</span>
            <span className="text-xs text-zinc-500">{t('rps.you')}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-zinc-600 text-xs uppercase tracking-wider font-semibold">vs</span>
            <span className={`text-xs font-bold ${resultColor}`}>{resultLabel}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-5xl">{PICK_ICON[rightPick]}</span>
            <span className="text-xs text-zinc-500">{oppNick}</span>
          </div>
        </div>
        {gs.status === 'ongoing' && (
          <p className="text-xs text-zinc-500">{t('rps.pickForRoundPre')}{gs.round}…</p>
        )}
      </div>
    );
  }

  // ── Pick buttons ────────────────────────────────────────────────────────────
  function PickButtons() {
    // Always render; canPick drives the enabled/disabled state.
    // Do NOT gate on roundResolved — after resolution hasPicked resets to [false,false]
    // so players must be able to pick for the next round immediately.
    return (
      <div className="flex gap-4">
        {PICKS.map((pick) => (
          <button
            key={pick}
            onClick={() => handlePick(pick)}
            disabled={!canPick}
            className={[
              'flex flex-col items-center gap-2 px-6 py-5 rounded-2xl border-2 transition-all duration-150 select-none',
              canPick
                ? 'border-zinc-700 bg-[var(--card)] hover:border-indigo-500 hover:bg-indigo-950/30 hover:scale-105 cursor-pointer'
                : 'border-zinc-800 bg-zinc-900/40 opacity-50 cursor-not-allowed',
            ].join(' ')}
          >
            <span className="text-4xl">{PICK_ICON[pick]}</span>
            <span className="text-xs font-semibold text-zinc-400">{PICK_LABEL[pick]}</span>
          </button>
        ))}
      </div>
    );
  }

  // ── Status banner ───────────────────────────────────────────────────────────
  function StatusBanner() {
    if (mp.phase === 'lobby') {
      return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.joinPrompt')}</p>;
    }
    if (mp.isSpectator) {
      if (!gs) return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.watching')}</p>;
      if (gs.status === 'win') {
        const winnerIdx = gs.players[0].id === gs.winner ? 0 : 1;
        return <p className="text-lg font-bold text-center text-yellow-400">{winnerIdx === 0 ? p0nick : p1nick} {t('rps.matchWin')}</p>;
      }
      if (gs.status === 'draw') return <p className="text-lg font-bold text-center text-zinc-400">{t('rps.matchDrawn')}</p>;
      return (
        <div className="flex items-center gap-2 text-zinc-400 text-sm justify-center">
          <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
          {t('rps.roundLabel')} {gs.round} {t('rps.ofLabel')} {gs.bestOf}
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
      const iWon = myIdx !== null && gs.winner === gs.players[myIdx]?.id;
      return (
        <p className={`text-xl font-black text-center ${iWon ? 'text-yellow-400' : 'text-zinc-400'}`}>
          {iWon ? `🏆 ${myNick} ${t('rps.matchWin')}` : `${oppNick} ${t('rps.matchWin')}`}
        </p>
      );
    }
    if (gs.status === 'draw') {
      return <p className="text-xl font-black text-center text-zinc-400">{t('rps.matchDrawn')}</p>;
    }
    if (mp.phase === 'ended') {
      return <p className="text-sm text-rose-400 text-center">{t('game.status.opponentDisconnected')}</p>;
    }
    if (iHavePicked && !roundResolved) {
      return (
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-semibold text-zinc-400">
            {t('rps.youPicked')} {PICK_ICON[gs.pendingPick0 && myIdx === 0 ? gs.pendingPick0 : gs.pendingPick1!]}
          </p>
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
            {t('rps.waitingForPre')}{oppNick}…
          </div>
        </div>
      );
    }
    if (!iHavePicked && !roundResolved) {
      return (
        <div className="flex items-center gap-2 text-indigo-400 text-sm justify-center font-medium">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          {t('rps.roundLabel')} {gs.round} {t('rps.ofLabel')} {gs.bestOf}{t('rps.chooseWeapon')}
        </div>
      );
    }
    return null;
  }

  // ── Waiting indicator for opponent who hasn't picked ────────────────────────
  function PickingStatus() {
    if (!gs || roundResolved || gs.status !== 'ongoing' || mp.isSpectator || myIdx === null) return null;
    const oppPicked = oppHasPicked;
    if (iHavePicked && !oppPicked) return null; // already shown in StatusBanner
    return null;
  }

  // ── Layout ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      {/* ── Game area ──────────────────────────────────────────────────────── */}
      <div className="relative flex-1 flex flex-col items-center justify-center gap-6 min-h-[420px]">
        <CountdownOverlay countdown={mp.matchCountdown} />
        <WaitingForConnectionOverlay
          show={mp.phase === 'playing' && !mp.roomReady && !mp.isSpectator}
          label={t('game.ready.waiting')}
        />

        {/* Score + round info */}
        {gs && mp.phase !== 'lobby' && (
          <div className="flex flex-col items-center gap-2 w-full">
            <Scoreboard />
            {gs.status === 'ongoing' && (
              <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider">
                {t('rps.bestOfLabel')} {gs.bestOf} · {t('rps.firstToLabel')} {gs.winsNeeded} {t('rps.winsLabel')}
              </p>
            )}
          </div>
        )}

        <StatusBanner />
        <PickingStatus />

        {/* Main interactive area */}
        {mp.phase === 'playing' && gs && (
          <div className="flex flex-col items-center gap-6">
            {roundResolved ? <RoundReveal /> : null}
            <PickButtons />
          </div>
        )}

        {mp.isSpectator && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-800/60 border border-zinc-700 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            {t('game.status.spectating')}
          </div>
        )}

        {/* Rematch */}
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
            className="mt-2 px-4 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            {t('game.actions.leaveRoom')}
          </button>
        )}
      </div>

      {/* ── Side panel ─────────────────────────────────────────────────────── */}
      <aside className="lg:w-72 flex flex-col gap-3">

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
              <span className="text-xs text-zinc-500">{mp.playerCount}/2</span>
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
                  const p = mp.players.find((pp) => pp.index === idx);
                  if (!p) return null;
                  const isMe = !mp.isSpectator && mp.playerIndex === idx;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className={`font-black text-sm ${idx === 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                        {idx === 0 ? '①' : '②'}
                      </span>
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
            <li>{t('rps.rules.1')}</li>
            <li>{t('rps.rules.2')}</li>
            <li>{t('rps.rules.3')}</li>
            <li>{t('rps.rules.4')}</li>
          </ul>
        }
      />
    </div>
  );
}
