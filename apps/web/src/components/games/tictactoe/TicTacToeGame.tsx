'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { TicTacToeState } from 'shared';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import type { GameComponentProps } from '@/lib/gameRegistry';
import { TicTacToeBoard } from './TicTacToeBoard';
import { StatsCard } from '@/components/StatsCard';
import { MatchHistoryCard } from '@/components/MatchHistoryCard';
import { CountdownOverlay } from '@/components/CountdownOverlay';

export function TicTacToeGame({ wsUrl, gameId, initialRoomCode, quickPlay: isQuickPlay }: GameComponentProps) {
  const router = useRouter();
  const mp = useMultiplayer<TicTacToeState>(wsUrl, gameId);
  const [joinInput, setJoinInput] = useState(initialRoomCode ?? '');
  const [copied, setCopied] = useState(false);
  const autoJoined = useRef(false);

  // Auto-join when arriving from invite link
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

  const myMark = mp.playerIndex !== null ? (mp.playerIndex === 0 ? 'X' : 'O') : null;
  const gs = mp.gameState;

  // Nickname helpers
  const p0nick = mp.players.find((p) => p.index === 0)?.nickname ?? 'Player 1';
  const p1nick = mp.players.find((p) => p.index === 1)?.nickname ?? 'Player 2';
  const myNick = mp.playerIndex !== null ? (mp.players.find((p) => p.index === mp.playerIndex)?.nickname ?? `Player ${mp.playerIndex + 1}`) : null;
  const oppNick = mp.playerIndex !== null ? (mp.players.find((p) => p.index !== mp.playerIndex)?.nickname ?? 'Opponent') : null;

  const isMyTurn =
    !mp.isSpectator &&
    gs !== null &&
    myMark !== null &&
    gs.currentTurn === gs.players[mp.playerIndex!]?.id;

  const boardDisabled =
    mp.isSpectator ||
    mp.phase !== 'playing' ||
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
    });
  }

  // ── Status banner ──────────────────────────────────────────────────────────
  function StatusBanner() {
    if (mp.phase === 'lobby') {
      return <p className="text-zinc-500 text-sm text-center">Create or join a room to play.</p>;
    }
    if (mp.isSpectator) {
      if (!gs) return <p className="text-zinc-500 text-sm text-center">Watching…</p>;
      if (gs.status === 'win') {
        const winnerIdx = gs.players[0].id === gs.winner ? 0 : 1;
        return <p className="text-lg font-bold text-center text-yellow-400">{winnerIdx === 0 ? p0nick : p1nick} wins!</p>;
      }
      if (gs.status === 'draw') return <p className="text-lg font-bold text-center text-zinc-400">Draw!</p>;
      const turnIdx = gs.players[0].id === gs.currentTurn ? 0 : 1;
      return (
        <div className="flex items-center gap-2 text-zinc-400 text-sm justify-center">
          <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
          {turnIdx === 0 ? p0nick : p1nick}&apos;s turn
        </div>
      );
    }
    if (mp.phase === 'waiting') {
      return (
        <div className="flex items-center gap-2 text-amber-400 text-sm justify-center">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Waiting for opponent to join…
        </div>
      );
    }
    if (!gs) return null;
    if (gs.status === 'win') {
      const iWon = gs.winner === gs.players[mp.playerIndex!]?.id;
      return (
        <p className={`text-lg font-bold text-center ${iWon ? 'text-yellow-400' : 'text-zinc-400'}`}>
          {iWon ? `🏆 ${myNick} wins!` : `${oppNick} wins!`}
        </p>
      );
    }
    if (gs.status === 'draw') {
      return <p className="text-lg font-bold text-center text-zinc-400">It&apos;s a draw!</p>;
    }
    if (mp.phase === 'ended') {
      return <p className="text-sm text-rose-400 text-center">Opponent disconnected.</p>;
    }
    if (isMyTurn) {
      return (
        <div className="flex items-center gap-2 text-indigo-400 text-sm justify-center font-medium">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          {myNick}&apos;s turn
          <span className={`font-black ${myMark === 'X' ? 'text-indigo-300' : 'text-rose-300'}`}>({myMark})</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-zinc-400 text-sm justify-center">
        <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
        {oppNick}&apos;s turn
      </div>
    );
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      {/* ── Board area ─────────────────────────────────────────────────────── */}
      <div className="relative flex-1 flex flex-col items-center justify-center gap-6 min-h-[380px]">
        <CountdownOverlay countdown={mp.matchCountdown} />
        <StatusBanner />
        <TicTacToeBoard
          board={gs?.board ?? Array(9).fill(null)}
          winnerCells={gs?.winnerCells}
          disabled={boardDisabled}
          onCellClick={handleCellClick}
        />
        {mp.isSpectator && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-800/60 border border-zinc-700 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            Spectating
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
              {mp.myVotedRematch ? 'Waiting for opponent…' : 'Rematch'}
            </button>
            {mp.rematchVotes > 0 && !mp.myVotedRematch && (
              <p className="text-xs text-amber-400">Opponent wants a rematch!</p>
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
            Leave room
          </button>
        )}
      </div>

      {/* ── Side panel ─────────────────────────────────────────────────────── */}
      <aside className="lg:w-72 flex flex-col gap-4">

        {/* Connection status */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${
              mp.connection === 'connected' ? 'bg-emerald-400' :
              mp.connection === 'connecting' ? 'bg-amber-400 animate-pulse' :
              'bg-rose-500'
            }`} />
            <span className="text-zinc-400 capitalize">{mp.connection}</span>
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
              {mp.connection !== 'connected' ? 'Connecting…' : 'Finding a match…'}
            </div>
            <Link
              href={`/games/${gameId}`}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </Link>
          </div>
        ) : mp.phase === 'lobby' ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-4">
            <button
              onClick={mp.createRoom}
              disabled={mp.connection !== 'connected'}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
            >
              Create Room
            </button>
            <div className="flex gap-2">
              <input
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="Room code"
                maxLength={6}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 uppercase tracking-widest font-mono"
              />
              <button
                onClick={() => mp.joinRoom(joinInput)}
                disabled={joinInput.length < 4 || mp.connection !== 'connected'}
                className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                Join
              </button>
            </div>
          </div>
        ) : null}

        {/* Room info */}
        {mp.roomCode && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Room</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-black tracking-widest text-zinc-100">
                {mp.roomCode}
              </span>
              <span className="text-xs text-zinc-500">{mp.playerCount}/2</span>
              {mp.spectatorCount > 0 && (
                <span className="text-xs text-zinc-600 ml-1">
                  {mp.spectatorCount} watching
                </span>
              )}
            </div>
            <button
              onClick={copyInvite}
              className="w-full py-2 rounded-lg border border-zinc-700 hover:border-indigo-600 text-sm text-zinc-300 hover:text-indigo-300 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy invite link
                </>
              )}
            </button>
            {mp.players.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-zinc-800">
                {([0, 1] as const).map((idx) => {
                  const p = mp.players.find((pp) => pp.index === idx);
                  if (!p) return null;
                  const mark = idx === 0 ? 'X' : 'O';
                  const isMe = !mp.isSpectator && mp.playerIndex === idx;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className={`font-black text-sm ${idx === 0 ? 'text-indigo-400' : 'text-rose-400'}`}>{mark}</span>
                      <span className="text-zinc-300 truncate">{p.nickname}</span>
                      {isMe && <span className="text-zinc-600 shrink-0">(you)</span>}
                    </div>
                  );
                })}
                {mp.isSpectator && <p className="text-xs text-zinc-600">Spectator — view only</p>}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <StatsCard
          stats={mp.stats}
          playerIndex={mp.isSpectator ? null : mp.playerIndex}
        />

        {/* Match history */}
        <MatchHistoryCard history={mp.history} myNickname={mp.myNickname} />

        {/* Rules */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">Rules</p>
          <ul className="text-sm text-zinc-400 space-y-1.5 list-disc list-inside">
            <li>Two players take turns placing marks</li>
            <li>First to get 3 in a row wins</li>
            <li>Rows, columns, and diagonals count</li>
            <li>If the board fills up with no winner, it&apos;s a draw</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
