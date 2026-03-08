'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/components/providers/LanguageProvider';
import { ProgressionTrack } from '@/components/profile/ProgressionTrack';
import { useProgression } from '@/components/providers/ProgressionProvider';
import { TokenIcon } from '@/components/ui/TokenIcon';

interface Props {
  onClose: () => void;
}

export function ProgressionModal({ onClose }: Props) {
  const { t } = useI18n();
  const backdropRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Wait for client mount so document.body is available
  useEffect(() => { setMounted(true); }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const { levelProgress: prog } = useProgression();

  if (!mounted) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[85dvh] flex flex-col rounded-2xl border border-zinc-700/60 bg-zinc-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header (sticky) */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-6 pb-5 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <span className="text-indigo-300 font-black text-base">{prog.level}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-100 leading-normal">{t('progression.track.title')}</h2>
              <p className="text-[11px] leading-normal text-indigo-400/80 mt-1">
                {t(`progression.rank.${prog.rank.toLowerCase()}`)}
                <span className="text-zinc-600 mx-1.5">&middot;</span>
                <span className="text-zinc-500 tabular-nums">{prog.currentXp}/{prog.requiredXp} {t('progression.xp')}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
          {/* XP Progress bar */}
          <div className="px-5 pt-3 pb-1">
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-500"
                style={{ width: `${Math.max(2, prog.progress * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-zinc-600">Lv. {prog.level}</span>
              <span className="text-[10px] text-zinc-600">Lv. {prog.level + 1}</span>
            </div>
          </div>

          {/* Track */}
          <div className="px-5 py-4">
            <ProgressionTrack />
          </div>
        </div>

        {/* Footer (sticky) */}
        <div className="shrink-0 px-5 py-3 border-t border-zinc-800 flex items-center gap-4 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <TokenIcon size="sm" /> <span className="text-amber-400 font-medium">{prog.totalTokens}</span> {t('progression.tokens')}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
