'use client';

import { useState, useEffect, useCallback } from 'react';
import { isPatchNotesNew, markPatchNotesSeen } from '@/lib/patchNotes';
import { PatchNotesDialog } from './PatchNotesDialog';

export function PatchNotesFloatingButton() {
  const [open, setOpen] = useState(false);
  // Start false (SSR-safe); update after mount once localStorage is available.
  const [isNew, setIsNew] = useState(false);
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch('/patch-notes.md')
      .then((r) => r.text())
      .then(setContent)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const newVersion = isPatchNotesNew();
    setIsNew(newVersion);
    if (newVersion) setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    markPatchNotesSeen();
    setIsNew(false);
    setOpen(false);
  }, []);

  return (
    <>
      {/* ── Floating pill button ─────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Patch Notes öffnen"
        className={[
          // Position
          'fixed bottom-5 left-5 z-40',
          // Layout
          'relative flex items-center gap-2',
          'pl-3 pr-3.5 py-1.5',
          // Shape
          'rounded-full',
          // Colors
          'bg-zinc-900/75 hover:bg-zinc-800/90',
          'backdrop-blur-md',
          'border border-zinc-700/50 hover:border-zinc-600/70',
          'text-zinc-500 hover:text-zinc-200',
          // Typography
          'text-[11px] font-medium tracking-wide',
          // Effects
          'shadow-md hover:shadow-lg',
          'transition-all duration-200 active:scale-95',
          'select-none',
        ].join(' ')}
      >
        {/* Pulsing dot — corner indicator when there's a new version */}
        {isNew && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-500 border border-zinc-900" />
          </span>
        )}

        {/* Changelog icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className="shrink-0 opacity-60"
        >
          <rect x="0" y="0.75" width="12" height="1.5" rx="0.75" fill="currentColor" />
          <rect x="0" y="4.5"  width="8"  height="1.5" rx="0.75" fill="currentColor" />
          <rect x="0" y="8.25" width="10" height="1.5" rx="0.75" fill="currentColor" />
        </svg>

        <span>Letztes Update</span>

        {/* Inline NEU badge */}
        {isNew && (
          <span className="inline-flex items-center px-1.5 py-px rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[9px] font-bold text-indigo-400 uppercase tracking-widest leading-none">
            NEU
          </span>
        )}
      </button>

      <PatchNotesDialog content={content} open={open} onClose={handleClose} />
    </>
  );
}
