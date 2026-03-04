'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { GameId } from 'shared';
import { useI18n } from '@/components/providers/LanguageProvider';

const INVITE_GAMES: Array<{ id: GameId; titleKey: string }> = [
  { id: 'tictactoe',  titleKey: 'lobby.games.tictactoe.title' },
  { id: 'connect4',   titleKey: 'lobby.games.connect4.title' },
  { id: 'rps',        titleKey: 'lobby.games.rps.title' },
  { id: 'chess',      titleKey: 'lobby.games.chess.title' },
  { id: 'battleship', titleKey: 'lobby.games.battleship.title' },
];

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  target: { token: string; nickname: string } | null;
  onSend: (gameId: GameId) => void;
}

export function InviteDialog({ open, onClose, target, onSend }: InviteDialogProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<GameId>('chess');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !target || !mounted) return null;

  const modal = (
    <div className="fixed inset-0 z-[2000]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Center wrapper */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="px-6 pt-6 pb-5 border-b border-zinc-800 shrink-0 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-0.5">
                {t('invite.title')}
              </p>
              <h3 className="font-bold text-zinc-100 text-lg truncate max-w-[260px]">
                {target.nickname}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 mt-0.5 text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded"
              aria-label={t('common.close')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          {/* Scrollable body */}
          <main className="px-6 py-5 overflow-y-auto min-h-0">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">
              {t('invite.chooseGame')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {INVITE_GAMES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelected(g.id)}
                  className={`w-full rounded-lg border px-3 py-3 text-sm text-left font-medium transition ${
                    selected === g.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {t(g.titleKey)}
                </button>
              ))}
            </div>
          </main>

          {/* Footer */}
          <footer className="px-6 py-4 border-t border-zinc-800 shrink-0 flex justify-end gap-3 bg-zinc-950/80 backdrop-blur">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 text-sm transition"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => { onSend(selected); onClose(); }}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
            >
              {t('invite.send')}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
