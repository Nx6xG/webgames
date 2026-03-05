'use client';

import { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LiarsBarState, Card, LdMode } from 'shared';
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
import { useAchievements } from '@/hooks/useAchievements';

// ── Compact viewport hook ────────────────────────────────────────────────────
// Fires when viewport height ≤ 800px (covers 1366×768 and similar).

const MQ = '(max-height: 800px)';
function subscribeCompact(cb: () => void) {
  const mql = window.matchMedia(MQ);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}
function getCompactSnapshot() { return window.matchMedia(MQ).matches; }
function getCompactServerSnapshot() { return false; }

function useCompact() {
  return useSyncExternalStore(subscribeCompact, getCompactSnapshot, getCompactServerSnapshot);
}

// ── SVG icons (inline, no deps) ──────────────────────────────────────────────

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5zm0 2h14v2H5v-2z" />
    </svg>
  );
}

// ── Card display ─────────────────────────────────────────────────────────────

const RANK_DISPLAY: Record<string, string> = { A: 'A', K: 'K', Q: 'Q', J: 'J' };

function CardFace({ card, selected, onClick, disabled, compact }: {
  card: Card;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
  compact: boolean;
}) {
  const isKing = card.rank === 'K';
  const sz = compact ? 'w-12 h-[4.25rem] text-lg rounded-lg' : 'w-16 h-24 text-2xl rounded-xl';
  const corner = compact ? 'text-[8px]' : 'text-[10px]';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative border-2 font-black
        flex items-center justify-center transition-all duration-150 select-none
        active:scale-[0.97] ${sz}
        ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:scale-105 hover:-translate-y-0.5'}
        ${selected
          ? `border-indigo-400 bg-indigo-950 text-indigo-200 ${compact ? '-translate-y-2' : '-translate-y-3'} shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400/30`
          : isKing
            ? 'border-amber-700/80 bg-zinc-900 text-amber-400 hover:border-amber-500'
            : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
        }
      `}
    >
      {RANK_DISPLAY[card.rank]}
      <span className={`absolute top-1 left-1.5 ${corner} font-semibold opacity-50`}>
        {RANK_DISPLAY[card.rank]}
      </span>
      <span className={`absolute bottom-1 right-1.5 ${corner} font-semibold opacity-50 rotate-180`}>
        {RANK_DISPLAY[card.rank]}
      </span>
    </button>
  );
}

function CardBack({ compact }: { compact: boolean }) {
  const outer = compact ? 'w-8 h-11 rounded' : 'w-11 h-16 rounded-lg';
  const inner = compact ? 'w-5 h-7 rounded-sm' : 'w-7 h-10 rounded';
  return (
    <div className={`${outer} border border-zinc-700 bg-zinc-800 flex items-center justify-center`}>
      <div className={`${inner} border border-zinc-600/60 bg-zinc-700/40`} />
    </div>
  );
}

// ── Revealed cards ───────────────────────────────────────────────────────────

function RevealedCards({ cards, compact }: { cards: Card[]; compact: boolean }) {
  const sz = compact ? 'w-12 h-[4.25rem] rounded-lg text-lg' : 'w-16 h-24 rounded-xl text-2xl';
  return (
    <div className={`flex ${compact ? 'gap-1.5' : 'gap-2.5'} justify-center`}>
      {cards.map((card, i) => {
        const isKing = card.rank === 'K';
        return (
          <div
            key={card.id}
            className={`${sz} border-2 font-black flex items-center justify-center
              transition-all duration-300 animate-in
              ${isKing
                ? 'border-emerald-500 bg-emerald-950/80 text-emerald-300 shadow-md shadow-emerald-500/20'
                : 'border-rose-500 bg-rose-950/80 text-rose-300 shadow-md shadow-rose-500/20'
              }`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {RANK_DISPLAY[card.rank]}
          </div>
        );
      })}
    </div>
  );
}

// ── Lives display ────────────────────────────────────────────────────────────

function LivesDisplay({ lives, max, compact }: { lives: number; max: number; compact?: boolean }) {
  const safeLives = Math.max(0, lives ?? 0);
  if (compact && max === 1) {
    return (
      <span className={`text-[10px] font-bold uppercase tracking-wider ${safeLives > 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
        {safeLives > 0 ? '1/1' : '0/1'}
      </span>
    );
  }
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`text-sm leading-none transition-all duration-300 ${
            i < safeLives
              ? 'text-rose-400 scale-100 opacity-100'
              : 'text-zinc-700 scale-75 opacity-40'
          }`}
        >
          &#10084;&#65039;
        </span>
      ))}
    </span>
  );
}

// ── Ansage badge ─────────────────────────────────────────────────────────────

function ClaimBadge({ t, compact }: { t: (key: string) => string; compact: boolean }) {
  return (
    <div className={`relative flex flex-col items-center ${compact ? 'gap-0.5 px-4 py-1.5 rounded-xl' : 'gap-1 px-6 py-3 rounded-2xl'} border border-amber-800/40 bg-gradient-to-b from-amber-950/50 to-zinc-900/80 overflow-hidden`}>
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="flex items-center gap-1.5 relative">
        <CrownIcon className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-500/70`} />
        <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold uppercase tracking-[0.15em] text-amber-500/70`}>
          {t('liarsbar.claim')}
        </span>
      </div>
      <span className={`${compact ? 'text-base' : 'text-lg'} font-black text-amber-300 tracking-wide relative`}>
        {t('liarsbar.claimKings')}
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function LiarsBarGame({ wsUrl, gameId, initialRoomCode, quickPlay: isQuickPlay }: GameComponentProps) {
  const router = useRouter();
  const mp = useMultiplayer<LiarsBarState>(wsUrl, gameId);
  const { t } = useI18n();
  const ach = useAchievements('liarsbar');
  const compact = useCompact();
  const [joinInput, setJoinInput] = useState(initialRoomCode ?? '');
  const [copied, setCopied] = useState(false);
  const [roomVisibility, setRoomVisibility] = useState<'private' | 'public'>('private');
  const [roomName, setRoomName] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevTotalRef = useRef<number | null>(null);
  const autoJoined = useRef(false);
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [ldMode, setLdMode] = useState<LdMode>('classic');

  // End-overlay latch — set once per finished match, cleared on rematch
  const lastFinishKeyRef = useRef<string>('');
  const [endOverlay, setEndOverlay] = useState<{ iWon: boolean; winnerNick: string | null } | null>(null);

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

  // Track unread messages
  useEffect(() => {
    const total = mp.roomMessages.length + mp.globalMessages.length;
    if (prevTotalRef.current === null) { prevTotalRef.current = total; return; }
    if (!chatOpen && total > prevTotalRef.current) {
      setUnread((u) => u + (total - prevTotalRef.current!));
    }
    prevTotalRef.current = total;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp.roomMessages.length, mp.globalMessages.length]);

  // ── Achievement tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (mp.phase === 'playing' && !mp.isSpectator) ach.trackPlay();
  }, [mp.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const gs = mp.gameState;
    const myI = mp.playerIndex;
    if (gs?.phase === 'ended' && gs?.winner && myI !== null && gs.winner === gs.players[myI]?.id) {
      ach.trackWin();
    }
  }, [mp.gameState?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear selection when game state changes (new turn, reveal, etc.)
  useEffect(() => {
    setSelectedCards(new Set());
  }, [mp.gameState?.phase, mp.gameState?.turnIndex]);

  const gs = mp.gameState;
  const myIdx = mp.playerIndex;

  const getNickname = (playerToken: string) => {
    const idx = gs?.players.findIndex(p => p.id === playerToken);
    if (idx === undefined || idx === -1) return '?';
    const serverPlayer = mp.players.find(p => p.index === idx);
    return serverPlayer?.nickname ?? `Player ${idx + 1}`;
  };

  // Latch end-overlay exactly once per finished match; clear on phase reset (rematch)
  const finishKey = gs?.phase === 'ended' && gs?.winner && !mp.isSpectator && myIdx !== null
    ? `${mp.roomCode ?? ''}|${gs.winner}`
    : '';

  useEffect(() => {
    if (!finishKey) {
      lastFinishKeyRef.current = '';
      setEndOverlay(null);
      return;
    }
    if (finishKey === lastFinishKeyRef.current) return;
    lastFinishKeyRef.current = finishKey;
    const iWon = gs?.winner != null && myIdx !== null && gs.winner === gs.players[myIdx]?.id;
    const winnerNick = gs?.winner ? getNickname(gs.winner) : null;
    setEndOverlay({ iWon: !!iWon, winnerNick });
  }, [finishKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const myHand: Card[] = (gs && myIdx !== null) ? (gs.hands?.[myIdx] ?? []) : [];

  const isMyTurn =
    !mp.isSpectator &&
    gs !== null &&
    myIdx !== null &&
    gs.phase === 'turn' &&
    gs.currentTurn === gs.players[myIdx]?.id;

  const canCallOrPass =
    !mp.isSpectator &&
    gs !== null &&
    myIdx !== null &&
    gs.phase === 'await_call' &&
    gs.lastClaim !== null &&
    gs.pendingCallerId === gs.players[myIdx]?.id;

  function toggleCard(cardId: number) {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else if (next.size < 3) {
        next.add(cardId);
      }
      return next;
    });
  }

  function handlePlay() {
    if (selectedCards.size === 0) return;
    mp.sendAction({ type: 'lb_play', cardIds: [...selectedCards] });
    setSelectedCards(new Set());
  }

  function handleCall() {
    mp.sendAction({ type: 'lb_call' });
  }

  function handlePass() {
    mp.sendAction({ type: 'lb_pass' });
  }

  function copyInvite() {
    if (!mp.roomCode) return;
    const url = `${window.location.origin}/games/liarsbar?room=${mp.roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      ach.trackInvite();
    });
  }

  const isHost = !mp.isSpectator && myIdx === 0;
  const isGameLobby = gs !== null && gs.phase === 'lobby';
  const canStart = isHost && isGameLobby && gs!.players.length >= 2;
  const inGame = gs !== null && gs.phase !== 'lobby' && gs.phase !== 'ended';

  function handleStart() {
    mp.sendAction({ type: 'lb_start' });
  }

  // Shorthand spacing tokens driven by compact
  const gapMain = compact ? 'gap-2' : 'gap-5';
  const gapSm = compact ? 'gap-1' : 'gap-2';

  // ── Status banner ─────────────────────────────────────────────────────────

  function StatusBanner() {
    const bannerPy = compact ? 'py-1.5 px-3' : 'py-3 px-4';
    const bannerText = compact ? 'text-xs' : 'text-sm';

    if (mp.phase === 'lobby') {
      return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.joinPrompt')}</p>;
    }
    if (isGameLobby) {
      if (isHost) {
        return (
          <div className={`flex flex-col items-center ${compact ? 'gap-2' : 'gap-3'} w-full`}>
            <div className={`flex items-center gap-2 text-amber-400 ${bannerText}`}>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {t('liarsbar.lobbyWaiting')} ({gs!.players.length}/{mp.roomMaxPlayers})
            </div>
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={`${compact ? 'px-6 py-2' : 'px-8 py-3'} rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all active:scale-[0.98] shadow-lg shadow-emerald-900/30`}
            >
              {t('liarsbar.startGame')} {gs!.players.length >= 2 ? '' : `(${t('liarsbar.needPlayers')})`}
            </button>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center gap-1">
          <div className={`flex items-center gap-2 text-amber-400 ${bannerText}`}>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {t('liarsbar.waitingForHost')}
          </div>
          {!compact && <span className="text-[11px] text-zinc-600">{t('liarsdeck.hint.lobby')}</span>}
        </div>
      );
    }
    if (mp.isSpectator) {
      if (!gs) return <p className="text-zinc-500 text-sm text-center">{t('game.lobby.watching')}</p>;
      if (gs.phase === 'ended') {
        const winnerNick = gs.winner ? getNickname(gs.winner) : '?';
        return <p className={`${compact ? 'text-base' : 'text-lg'} font-bold text-center text-yellow-400`}>{winnerNick} {t('game.status.wins')}</p>;
      }
      const activeNick = getNickname(gs.currentTurn);
      return (
        <div className={`flex items-center gap-2 text-zinc-400 ${bannerText} justify-center`}>
          <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
          {activeNick}{t('game.status.turnSuffix')}
        </div>
      );
    }
    if (mp.phase === 'waiting') {
      return (
        <div className={`flex items-center gap-2 text-amber-400 ${bannerText} justify-center`}>
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          {t('game.status.waitingToJoin')}
        </div>
      );
    }
    if (!gs) return null;
    if (gs.phase === 'ended') {
      if (!gs.winner || myIdx === null) {
        return <p className={`${compact ? 'text-base' : 'text-lg'} font-bold text-center text-zinc-400`}>{t('liarsbar.gameOver')}</p>;
      }
      const iWon = gs.winner === gs.players[myIdx]?.id;
      const winnerNick = getNickname(gs.winner);
      return (
        <p className={`${compact ? 'text-base' : 'text-lg'} font-bold text-center ${iWon ? 'text-yellow-400' : 'text-zinc-400'}`}>
          {iWon ? `${t('liarsbar.winner')}!` : `${winnerNick} ${t('game.status.wins')}`}
        </p>
      );
    }
    if (mp.phase === 'ended') {
      return <p className="text-sm text-rose-400 text-center">{t('game.status.opponentDisconnected')}</p>;
    }

    // Active game — rich status banner
    if (isMyTurn) {
      return (
        <div className={`w-full max-w-sm mx-auto rounded-xl border border-indigo-700/50 bg-indigo-950/40 ${bannerPy} flex flex-col items-center gap-0.5`}>
          <div className={`flex items-center gap-2 text-indigo-300 font-bold ${bannerText}`}>
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            {t('liarsdeck.status.yourTurn')}
          </div>
          {!compact && <span className="text-[11px] text-indigo-400/60">{t('liarsdeck.hint.turn')}</span>}
        </div>
      );
    }
    if (canCallOrPass) {
      const claimantNick = gs.lastClaim ? getNickname(gs.lastClaim.claimantId) : '?';
      return (
        <div className={`w-full max-w-sm mx-auto rounded-xl border border-amber-700/50 bg-amber-950/30 ${bannerPy} flex flex-col items-center gap-0.5`}>
          <div className={`flex items-center gap-2 text-amber-300 font-bold ${bannerText}`}>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {claimantNick} {t('liarsbar.play').toLowerCase()}
            {gs.lastClaim ? ` (${gs.lastClaim.count}×)` : ''}
          </div>
          {!compact && <span className="text-[11px] text-amber-400/60">{t('liarsdeck.hint.awaitCall')}</span>}
        </div>
      );
    }
    // Someone else's turn
    const activeNick = getNickname(gs.currentTurn);
    const hint = gs.phase === 'await_call'
      ? `${activeNick} ${t('liarsdeck.hint.canCallPass')}`
      : `${t('liarsdeck.hint.waiting')} ${activeNick}`;
    return (
      <div className={`w-full max-w-sm mx-auto rounded-xl border border-zinc-800 bg-zinc-900/60 ${bannerPy} flex flex-col items-center gap-0.5`}>
        <div className={`flex items-center gap-2 text-zinc-400 ${bannerText}`}>
          <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
          {hint}
        </div>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className={`grid ${compact ? 'gap-3' : 'gap-6'} lg:grid-cols-[1fr_340px] w-full items-start`}>
      {/* ── Game area ────────────────────────────────────────────────────── */}
      <div className={`relative min-w-0 flex flex-col items-center ${gapMain} max-w-2xl mx-auto w-full`}>
        <CountdownOverlay countdown={mp.matchCountdown} />
        <WaitingForConnectionOverlay
          show={mp.phase === 'playing' && !mp.roomReady && !mp.isSpectator}
          label={t('game.ready.waiting')}
        />

        {/* ── End-game overlay (Battleship-style) ────────────────────── */}
        {endOverlay && (
          <>
            <style>{`
              @keyframes ld-win-pop {
                0%   { transform: scale(0.85); opacity: 0; }
                100% { transform: scale(1);    opacity: 1; }
              }
              .ld-win-pop { animation: ld-win-pop 0.25s ease-out forwards; }
              @keyframes ld-confetti-fall {
                0%   { transform: translateY(0)     rotate(0deg);   opacity: 0.9; }
                80%  { opacity: 0.75; }
                100% { transform: translateY(420px) rotate(400deg); opacity: 0; }
              }
            `}</style>
            <div style={{
              position: 'absolute', inset: 0, zIndex: 30,
              backgroundColor: 'rgba(0,0,0,0.50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              {/* Confetti on win */}
              {endOverlay.iWon && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                  {Array.from({ length: 14 }, (_, i) => (
                    <div key={i} style={{
                      position: 'absolute',
                      width: 5 + (i % 3) * 3,
                      height: 5 + (i % 3) * 3,
                      borderRadius: i % 3 === 0 ? '50%' : '2px',
                      backgroundColor: ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#38bdf8'][i % 6],
                      left: `${(i * 7 + 3) % 94}%`,
                      top: '-12px',
                      animation: `ld-confetti-fall ${1.4 + (i % 4) * 0.35}s ease-in ${i * 0.08}s infinite`,
                    }} />
                  ))}
                </div>
              )}
              {/* Rose vignette on loss */}
              {!endOverlay.iWon && (
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: 'radial-gradient(ellipse at center, transparent 30%, rgba(159,18,57,0.28) 100%)',
                }} />
              )}
              {/* Card */}
              <div
                className="ld-win-pop bg-zinc-900/90 backdrop-blur rounded-2xl border border-zinc-700 px-10 py-8 text-center shadow-xl"
                style={{ pointerEvents: 'auto', minWidth: 260, maxWidth: 360 }}
              >
                <p className={`text-4xl font-bold mb-2 ${endOverlay.iWon ? 'text-indigo-400' : 'text-rose-400'}`}>
                  {endOverlay.iWon ? `🏆 ${t('liarsbar.winner')}!` : `💀 ${t('liarsbar.youLose')}`}
                </p>
                {endOverlay.winnerNick && (
                  <p className="text-zinc-400 text-sm mb-1">
                    {endOverlay.iWon ? '' : `${endOverlay.winnerNick} ${t('game.status.wins')}`}
                  </p>
                )}
                {/* Mode badge */}
                {gs && (
                  <div className="flex justify-center mb-5 mt-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      gs.mode === 'roulette'
                        ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                        : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60'
                    }`}>
                      {t(`liarsdeck.badge.${gs.mode}`)}
                    </span>
                  </div>
                )}
                {/* Round summary — remaining lives in classic */}
                {gs && gs.mode === 'classic' && myIdx !== null && endOverlay.iWon && (
                  <p className="text-xs text-zinc-500 mb-4">
                    {gs.players[myIdx] && (
                      <span>{gs.players[myIdx].lives}/{gs.maxLives} ❤️</span>
                    )}
                  </p>
                )}
                {mp.playerCount >= 2 && (
                  <div className="flex flex-col items-center gap-2 mb-3">
                    <button
                      onClick={mp.requestRematch}
                      disabled={mp.myVotedRematch}
                      className="w-full px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                    >
                      {mp.myVotedRematch ? t('game.actions.waitingRematch') : t('game.actions.rematch')}
                    </button>
                    {mp.rematchVotes > 0 && !mp.myVotedRematch && (
                      <p className="text-xs text-amber-400">{t('game.status.opponentRematch')}</p>
                    )}
                    {mp.rematchError && (
                      <p className="text-xs text-rose-400">{mp.rematchError}</p>
                    )}
                  </div>
                )}
                <button
                  onClick={mp.leaveRoom}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  {t('game.actions.leaveRoom')}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Header + Ansage ───────────────────────────────────────────── */}
        {gs && (
          <div className={`flex flex-col items-center ${compact ? 'gap-1' : 'gap-3'} w-full`}>
            <div className="flex items-center gap-2.5">
              <h2 className={`${compact ? 'text-base' : 'text-xl'} font-black text-zinc-100`}>{t('lobby.games.liarsbar.title')}</h2>
              {gs.phase !== 'lobby' && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  gs.mode === 'roulette'
                    ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                    : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60'
                }`}>
                  {t(`liarsdeck.badge.${gs.mode}`)}
                </span>
              )}
            </div>

            {gs.phase !== 'lobby' && gs.phase !== 'ended' && (
              <ClaimBadge t={t} compact={compact} />
            )}
          </div>
        )}

        {/* ── Status banner ─────────────────────────────────────────────── */}
        <StatusBanner />

        {/* ── Roulette cylinders (per-player) ────────────────────────────── */}
        {gs && gs.mode === 'roulette' && gs.revolvers && inGame && (
          <div className={`flex flex-wrap items-center justify-center gap-2 ${compact ? 'gap-1.5' : 'gap-2'}`}>
            {gs.players.filter(p => !p.eliminated).map((player) => {
              const rv = gs.revolvers![player.id];
              if (!rv) return null;
              const isActive = player.id === gs.currentTurn;
              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-1.5 ${compact ? 'px-2 py-0.5' : 'px-2.5 py-1'} rounded-full border transition-colors ${
                    isActive
                      ? 'border-rose-700/60 bg-rose-950/30'
                      : 'border-zinc-800 bg-zinc-900/60'
                  }`}
                >
                  <span className={`text-[10px] font-semibold truncate max-w-[60px] ${isActive ? 'text-rose-300' : 'text-zinc-500'}`}>
                    {getNickname(player.id)}
                  </span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full border transition-all duration-300 ${
                          i < rv.cylinderPos
                            ? 'border-zinc-600 bg-zinc-600'
                            : i === rv.cylinderPos
                              ? isActive
                                ? 'border-rose-500 bg-rose-500/50 shadow-sm shadow-rose-500/30'
                                : 'border-amber-500 bg-amber-500/40'
                              : 'border-zinc-700 bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Turn order strip ─────────────────────────────────────────── */}
        {gs && gs.phase !== 'lobby' && gs.phase !== 'ended' && (
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {gs.players.map((player, idx) => {
              const nick = getNickname(player.id);
              const isActive = gs.currentTurn === player.id;
              const isElim = player.eliminated;
              // Next non-eliminated player after active
              let isNext = false;
              if (!isElim && !isActive) {
                const activeIdx = gs.players.findIndex(p => p.id === gs.currentTurn);
                if (activeIdx !== -1) {
                  let ni = activeIdx;
                  for (let step = 0; step < gs.players.length; step++) {
                    ni = (ni + 1) % gs.players.length;
                    if (!gs.players[ni].eliminated) { isNext = ni === idx; break; }
                  }
                }
              }
              return (
                <span key={player.id} className="flex items-center gap-1">
                  {idx > 0 && (
                    <span className="text-zinc-700 text-[10px]">&rarr;</span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all truncate max-w-[80px] ${
                      isElim
                        ? 'bg-zinc-800/50 text-zinc-600 line-through'
                        : isActive
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/40 ring-1 ring-indigo-400/30'
                          : isNext
                            ? 'bg-zinc-800 text-zinc-200'
                            : 'bg-zinc-800/60 text-zinc-400'
                    }`}
                  >
                    {nick}
                  </span>
                </span>
              );
            })}
          </div>
        )}

        {/* ── Players row ───────────────────────────────────────────────── */}
        {gs && (
          <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2.5'} justify-center w-full`}>
            {/* DEV: verify both clients receive the same lives */}
            {process.env.NODE_ENV === 'development' && gs.phase !== 'lobby' && (() => {
              console.log('[LD lives]', gs.players.map(p => `${p.id.slice(0, 6)}:${p.lives}/${gs.maxLives}${p.eliminated ? ' X' : ''}`));
              return null;
            })()}
            {gs.players.map((player, idx) => {
              const nick = getNickname(player.id);
              const isActive = gs.phase !== 'ended' && gs.phase !== 'lobby' && gs.currentTurn === player.id;
              const isMe = myIdx === idx;
              const isLobby = gs.phase === 'lobby';
              return (
                <div
                  key={player.id}
                  className={`
                    relative flex flex-col items-center ${compact ? 'gap-0.5 px-2.5 py-1.5 min-w-[90px]' : 'gap-1.5 px-4 py-3 min-w-[110px]'} rounded-xl border-2 transition-all duration-200
                    ${player.eliminated
                      ? 'border-zinc-800/50 bg-zinc-900/30 opacity-40 grayscale'
                      : isActive
                        ? 'border-indigo-500/60 bg-indigo-950/30 shadow-md shadow-indigo-500/10'
                        : isMe
                          ? 'border-zinc-700 bg-zinc-900/80'
                          : 'border-zinc-800 bg-zinc-900/60'
                    }
                  `}
                >
                  {isActive && !player.eliminated && (
                    <div className="absolute -inset-px rounded-xl border-2 border-indigo-400/30 animate-pulse pointer-events-none" />
                  )}

                  <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold truncate max-w-[90px] ${isActive ? 'text-indigo-300' : 'text-zinc-300'}`}>
                    {nick}
                    {isMe && <span className="text-zinc-600 text-[10px] ml-1">({t('game.common.you')})</span>}
                    {isLobby && idx === 0 && <span className="text-amber-500 text-[10px] ml-1">&#9733;</span>}
                  </span>

                  {!isLobby && <LivesDisplay key={`${player.id}-${player.lives}`} lives={player.lives} max={gs.maxLives} compact />}

                  {!isLobby && player.eliminated && (
                    <span className="text-[9px] text-rose-400 font-black uppercase tracking-wider bg-rose-950/60 px-1.5 py-px rounded-full">
                      {t('liarsdeck.status.eliminated')}
                    </span>
                  )}
                  {!isLobby && !player.eliminated && isActive && (
                    <span className="text-[9px] text-indigo-400 font-medium">
                      {t('liarsdeck.status.atTurn')}
                    </span>
                  )}
                  {!isLobby && !player.eliminated && !isActive && (
                    <span className="text-[9px] text-zinc-600">
                      {player.handCount} {t('liarsbar.cardsLabel')}
                    </span>
                  )}
                  {isLobby && (
                    <span className="text-[9px] text-emerald-500 font-medium">{t('common.live')}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pile indicator ─────────────────────────────────────────────── */}
        {gs && inGame && gs.pile.length > 0 && (
          <div className={`flex flex-col items-center ${compact ? 'gap-0.5' : 'gap-1.5'}`}>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{t('liarsbar.pile')}</span>
            <div className="flex gap-1">
              {gs.pile.map((_, i) => (
                <CardBack key={i} compact={compact} />
              ))}
            </div>
          </div>
        )}

        {/* ── Reveal + Penalty area ──────────────────────────────────────── */}
        {gs && inGame && (
          <div className="w-full max-w-md">
            {gs.lastReveal ? (
              <div className={`flex flex-col items-center ${compact ? 'gap-1.5 p-3' : 'gap-3 p-5'} rounded-2xl border border-zinc-700/60 bg-zinc-900/70 backdrop-blur-sm`}>
                <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-zinc-400 uppercase tracking-[0.15em] font-semibold`}>
                  {t('liarsdeck.reveal.title')}
                </span>
                <RevealedCards cards={gs.lastReveal.cards} compact={compact} />

                <div className={`${compact ? 'text-xs' : 'text-sm'} text-center font-medium`}>
                  {gs.lastReveal.allKings ? (
                    <span className="text-emerald-400">
                      {t('liarsbar.allKings')} — {getNickname(gs.lastReveal.callerId)}{' '}
                      {gs.mode === 'roulette' ? t('liarsdeck.reveal.trigger') : t('liarsbar.lostLife')}
                    </span>
                  ) : (
                    <span className="text-rose-400">
                      {t('liarsbar.notAllKings')} — {getNickname(gs.lastReveal.playerId)}{' '}
                      {gs.mode === 'roulette' ? t('liarsdeck.reveal.trigger') : t('liarsbar.lostLife')}
                    </span>
                  )}
                </div>

                {gs.lastPenalty && (
                  <div className={`text-[11px] font-bold text-center px-3 py-1 rounded-full ${
                    gs.lastPenalty.fired === true
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                      : gs.lastPenalty.fired === false
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                        : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/60'
                  }`}>
                    {gs.mode === 'roulette'
                      ? (gs.lastPenalty.fired
                          ? `${getNickname(gs.players[gs.lastPenalty.playerIndex]?.id ?? '')} — ${t('liarsdeck.penalty.bang')}`
                          : `${getNickname(gs.players[gs.lastPenalty.playerIndex]?.id ?? '')} — ${t('liarsdeck.penalty.click')}`)
                      : `${getNickname(gs.players[gs.lastPenalty.playerIndex]?.id ?? '')} ${t('liarsbar.lostLife')}`
                    }
                  </div>
                )}
              </div>
            ) : (
              <div className={`flex items-center justify-center ${compact ? 'py-1' : 'py-3'}`}>
                <span className="text-[11px] text-zinc-700 italic">{t('liarsdeck.reveal.none')}</span>
              </div>
            )}
          </div>
        )}

        {/* Standalone penalty display (ended phase) */}
        {gs && !inGame && gs.lastPenalty && (
          <div className={`${compact ? 'text-xs py-1.5' : 'text-sm py-2'} font-semibold text-center px-4 rounded-lg border ${
            gs.lastPenalty.fired === true
              ? 'bg-rose-950/60 border-rose-800 text-rose-300'
              : gs.lastPenalty.fired === false
                ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                : 'bg-zinc-800/60 border-zinc-700 text-zinc-300'
          }`}>
            {gs.mode === 'roulette'
              ? (gs.lastPenalty.fired
                  ? `${getNickname(gs.players[gs.lastPenalty.playerIndex]?.id ?? '')} — ${t('liarsdeck.penalty.bang')}`
                  : `${getNickname(gs.players[gs.lastPenalty.playerIndex]?.id ?? '')} — ${t('liarsdeck.penalty.click')}`)
              : `${getNickname(gs.players[gs.lastPenalty.playerIndex]?.id ?? '')} ${t('liarsbar.lostLife')}`
            }
          </div>
        )}

        {/* ── My hand + actions ──────────────────────────────────────────── */}
        {gs && myIdx !== null && !mp.isSpectator && gs.phase !== 'ended' && !gs.players[myIdx]?.eliminated && (
          <div className={`flex flex-col items-center ${compact ? 'gap-2' : 'gap-4'} w-full max-w-md`}>
            <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-zinc-500 uppercase tracking-[0.15em] font-semibold`}>{t('liarsbar.yourHand')}</span>
            <div className={`flex ${compact ? 'gap-1.5' : 'gap-2'} flex-wrap justify-center`}>
              {myHand.map((card) => (
                <CardFace
                  key={card.id}
                  card={card}
                  selected={selectedCards.has(card.id)}
                  onClick={() => toggleCard(card.id)}
                  disabled={!isMyTurn}
                  compact={compact}
                />
              ))}
            </div>

            {isMyTurn && (
              <button
                onClick={handlePlay}
                disabled={selectedCards.size === 0}
                className={`w-full ${compact ? 'py-2' : 'py-3'} rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-sm transition-all active:scale-[0.98] shadow-lg shadow-indigo-900/40`}
              >
                {t('liarsdeck.playCards')} {selectedCards.size > 0 && `(${selectedCards.size})`}
              </button>
            )}

            {canCallOrPass && (
              <div className={`flex flex-col ${gapSm} w-full`}>
                <button
                  onClick={handleCall}
                  className={`w-full ${compact ? 'py-2' : 'py-3'} rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all active:scale-[0.98] shadow-lg shadow-rose-900/30`}
                >
                  {t('liarsbar.call')}
                </button>
                {!compact && <p className="text-[10px] text-zinc-600 text-center -mt-0.5">{t('liarsdeck.callHint')}</p>}
                <button
                  onClick={handlePass}
                  className={`w-full ${compact ? 'py-1.5' : 'py-2.5'} rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 font-semibold text-sm transition-all active:scale-[0.98]`}
                >
                  {t('liarsbar.pass')}
                </button>
                {!compact && <p className="text-[10px] text-zinc-600 text-center -mt-0.5">{t('liarsdeck.passHint')}</p>}
              </div>
            )}
          </div>
        )}

        {/* Spectator badge */}
        {mp.isSpectator && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-800/60 border border-zinc-700 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            {t('game.status.spectating')}
          </div>
        )}

        {(mp.phase === 'playing' || mp.phase === 'waiting') && (
          <button
            onClick={mp.leaveRoom}
            className={`${compact ? 'mt-0.5' : 'mt-1'} px-4 py-1.5 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors active:scale-[0.98]`}
          >
            {t('game.actions.leaveRoom')}
          </button>
        )}
      </div>

      {/* ── Side panel ──────────────────────────────────────────────────── */}
      <aside className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'} lg:sticky lg:top-24 h-fit`}>

        {/* Connection status */}
        <div className={`rounded-xl border border-zinc-800 bg-zinc-900 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
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
          <div className={`rounded-xl border border-rose-800 bg-rose-950/40 ${compact ? 'p-2' : 'p-3'} text-rose-300 text-sm flex justify-between items-start gap-2`}>
            <span>{mp.error}</span>
            <button onClick={mp.clearError} className="text-rose-400 hover:text-rose-200 text-lg leading-none shrink-0">&times;</button>
          </div>
        )}

        {/* Lobby: quick-play searching OR create / join */}
        {mp.phase === 'lobby' && isQuickPlay ? (
          <div className={`rounded-xl border border-zinc-800 bg-zinc-900 ${compact ? 'p-3' : 'p-4'} flex flex-col items-center gap-3`}>
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {mp.connection !== 'connected' ? t('status.connecting') : t('game.lobby.findingMatch')}
            </div>
            <Link href={`/games/${gameId}`} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              {t('common.cancel')}
            </Link>
          </div>
        ) : mp.phase === 'lobby' ? (
          <div className={`rounded-xl border border-zinc-800 bg-zinc-900 ${compact ? 'p-3' : 'p-4'} flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
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
                className={`bg-zinc-800 border border-zinc-700 rounded-lg px-3 ${compact ? 'py-1.5' : 'py-2'} text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500`}
              />
            )}
            {/* Mode selector */}
            <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}>
              <span className="text-xs text-zinc-500 font-medium">{t('liarsdeck.mode')}</span>
              <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg">
                {(['classic', 'roulette'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setLdMode(m)}
                    className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                      ldMode === m
                        ? m === 'roulette' ? 'bg-rose-900 text-rose-200' : 'bg-zinc-700 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t(`liarsdeck.mode.${m}`)}
                  </button>
                ))}
              </div>
              {!compact && <p className="text-[10px] text-zinc-600">{t(`liarsdeck.modeDesc.${ldMode}`)}</p>}
            </div>
            {/* Player count selector */}
            <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}>
              <span className="text-xs text-zinc-500 font-medium">{t('liarsbar.players')}</span>
              <div className="flex gap-1">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxPlayers(n)}
                    className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                      maxPlayers === n ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => mp.createRoom({ visibility: roomVisibility, roomName: roomName.trim() || undefined, ldConfig: { mode: ldMode }, maxPlayers })}
              disabled={mp.connection !== 'connected'}
              className={`w-full ${compact ? 'py-2' : 'py-2.5'} rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all active:scale-[0.98]`}
            >
              {t('game.lobby.createRoom')}
            </button>
            <div className="flex gap-2">
              <input
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase().slice(0, 6))}
                placeholder={t('game.lobby.roomCode')}
                maxLength={6}
                className={`flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 ${compact ? 'py-1.5' : 'py-2'} text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 uppercase tracking-widest font-mono`}
              />
              <button
                onClick={() => mp.joinRoom(joinInput)}
                disabled={joinInput.length < 4 || mp.connection !== 'connected'}
                className={`px-4 ${compact ? 'py-1.5' : 'py-2'} rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors active:scale-[0.98]`}
              >
                {t('game.lobby.join')}
              </button>
            </div>
          </div>
        ) : null}

        {/* Room info */}
        {mp.roomCode && (
          <div className={`rounded-xl border border-zinc-800 bg-zinc-900 ${compact ? 'p-3' : 'p-4'} flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{t('game.room.title')}</p>
            <div className="flex items-center gap-2">
              <span className={`font-mono ${compact ? 'text-xl' : 'text-2xl'} font-black tracking-widest text-zinc-100`}>{mp.roomCode}</span>
              <span className="text-xs text-zinc-500">{mp.playerCount}/{mp.roomMaxPlayers}</span>
              {mp.spectatorCount > 0 && (
                <span className="text-xs text-zinc-600 ml-1">{mp.spectatorCount} {t('game.room.watching')}</span>
              )}
            </div>
            <button
              onClick={copyInvite}
              className={`w-full ${compact ? 'py-1.5' : 'py-2'} rounded-lg border border-zinc-700 hover:border-indigo-600 text-sm text-zinc-300 hover:text-indigo-300 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]`}
            >
              {copied ? (
                <><svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-emerald-400">{t('game.room.copied')}</span></>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>{t('game.room.copyInvite')}</>
              )}
            </button>
            {mp.players.length > 0 && (
              <div className={`space-y-1 pt-2 border-t border-zinc-800`}>
                {mp.players
                  .slice()
                  .sort((a, b) => a.index - b.index)
                  .map((p) => {
                    const isMe = !mp.isSpectator && mp.playerIndex === p.index;
                    return (
                      <div key={p.index} className="flex items-center gap-2 text-xs">
                        <AvatarBubble avatarId={p.avatarId} avatarFrame={p.avatarFrame} nickname={p.nickname} size="sm" cosmetics={p.cosmetics} />
                        <span className="text-zinc-500 font-mono w-4">{p.index + 1}.</span>
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
            <li>{t('liarsbar.rules.1')}</li>
            <li>{t('liarsbar.rules.2')}</li>
            <li>{t('liarsbar.rules.3')}</li>
            <li>{t('liarsbar.rules.4')}</li>
            <li>{t('liarsbar.rules.5')}</li>
          </ul>
        }
      />
    </div>
  );
}
