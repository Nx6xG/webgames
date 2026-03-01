'use client';

import { useEffect, type ReactNode } from 'react';
import type { GameStats, Match } from 'shared';
import { StatsCard } from './StatsCard';
import { MatchHistoryCard } from './MatchHistoryCard';

interface GameInfoModalProps {
  open: boolean;
  onClose: () => void;
  stats: GameStats | null;
  playerIndex: 0 | 1 | null;
  rules: ReactNode;
  history: Match[];
  myNickname: string;
}

export function GameInfoModal({
  open,
  onClose,
  stats,
  playerIndex,
  rules,
  history,
  myNickname,
}: GameInfoModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-sm flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
            <span className="font-bold text-sm text-zinc-100">Game Info</span>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body — scrollable */}
          <div className="overflow-y-auto flex flex-col gap-4 p-4">
            {/* Platform Stats */}
            <StatsCard stats={stats} playerIndex={playerIndex} />

            {/* Match History */}
            {history.length > 0 && (
              <MatchHistoryCard history={history} myNickname={myNickname} />
            )}

            {/* Rules */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">Rules</p>
              {rules}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
