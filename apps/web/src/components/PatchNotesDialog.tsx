'use client';

import { useEffect } from 'react';
import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { PATCH_NOTES_VERSION } from '@/content/patch-notes';

interface PatchNotesDialogProps {
  content: string;
  open: boolean;
  onClose: () => void;
}

// ── Markdown component overrides ─────────────────────────────────────────────
// h1 (the top "# Patch Notes" title) is suppressed — the dialog header covers it.
const mdComponents: Components = {
  h1: () => null,

  // h2 = version/date milestone — rendered as a chip + horizontal rule
  h2: ({ children }) => (
    <div className="flex items-center gap-3 mt-0 mb-3">
      <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[11px] font-mono font-semibold text-zinc-300 tracking-wide">
        {children}
      </span>
      <span className="flex-1 h-px bg-zinc-800" aria-hidden="true" />
    </div>
  ),

  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-zinc-300 mt-5 mb-2">{children}</h3>
  ),

  ul: ({ children }) => (
    <ul className="space-y-2 mb-5">{children}</ul>
  ),

  li: ({ children }) => (
    <li className="grid grid-cols-[16px_1fr] gap-x-2 text-sm text-zinc-400 leading-relaxed">
      <span className="mt-[3px] w-4 h-4 flex items-center justify-center rounded-sm bg-indigo-950/50 border border-indigo-900/40 text-indigo-400 text-[10px] font-bold shrink-0 select-none">
        +
      </span>
      <span>{children}</span>
    </li>
  ),

  p: ({ children }) => (
    <p className="text-sm text-zinc-400 mb-3 leading-relaxed">{children}</p>
  ),

  hr: () => <hr className="border-zinc-800 my-6" />,

  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-200">{children}</strong>
  ),

  em: ({ children }) => (
    <em className="not-italic text-zinc-500">{children}</em>
  ),

  code: ({ children }) => (
    <code className="text-[11px] bg-zinc-800 border border-zinc-700 text-indigo-300 px-1.5 py-px rounded font-mono">
      {children}
    </code>
  ),
};

// ── Component ────────────────────────────────────────────────────────────────
export function PatchNotesDialog({ content, open, onClose }: PatchNotesDialogProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Dialog shell ─────────────────────────────────────── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Patch Notes"
          className={[
            'pointer-events-auto',
            'w-full max-w-[780px]',
            'max-h-[72vh]',
            'flex flex-col',
            'bg-zinc-950 border border-zinc-800/80',
            'rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)]',
            'overflow-hidden',
          ].join(' ')}
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="shrink-0 px-6 pt-5 pb-4 border-b border-zinc-800/60 bg-gradient-to-b from-zinc-900 to-zinc-950">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                {/* Title row */}
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[17px] font-bold text-zinc-100 tracking-tight leading-none">
                    Patch Notes
                  </h2>
                  {/* Version chip */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-800/50 text-[11px] font-mono font-semibold text-indigo-400 leading-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
                    {PATCH_NOTES_VERSION}
                  </span>
                </div>
                {/* Subtitle */}
                <p className="text-[13px] text-zinc-500">
                  Letztes Update ·{' '}
                  <span className="text-zinc-400">Was ist neu?</span>
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                aria-label="Schließen"
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-base leading-none mt-0.5"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Scrollable content with fade shadows ─────────────── */}
          <div className="relative flex-1 min-h-0">
            {/* Top fade */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-5 z-10 bg-gradient-to-b from-zinc-950 to-transparent"
              aria-hidden="true"
            />

            <div className="h-full overflow-y-auto px-6 py-5 scroll-smooth">
              <Markdown components={mdComponents}>{content}</Markdown>
            </div>

            {/* Bottom fade */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8 z-10 bg-gradient-to-t from-zinc-950 to-transparent"
              aria-hidden="true"
            />
          </div>

          {/* ── Footer ─────────────────────────────────────────── */}
          <div className="shrink-0 px-6 py-3.5 border-t border-zinc-800/60 bg-zinc-950 flex items-center justify-between gap-4">
            <p className="text-[11px] text-zinc-600 font-mono select-none">
              webgames · v{PATCH_NOTES_VERSION}
            </p>
            <button
              onClick={onClose}
              className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Alles klar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
