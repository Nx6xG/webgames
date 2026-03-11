'use client';

import { useState, useCallback } from 'react';

const FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSddoaaDwXNt7FugGEi8kONWp3XopmCCYC79vqedEIiXavm10g/viewform?embedded=true';

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* ── Floating feedback button ─────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Feedback geben"
        className={[
          'fixed bottom-5 right-5 z-40',
          'flex items-center gap-2',
          'pl-3 pr-3.5 py-1.5',
          'rounded-full',
          'bg-purple-600/80 hover:bg-purple-500/90',
          'backdrop-blur-md',
          'border border-purple-500/40 hover:border-purple-400/60',
          'text-white/90 hover:text-white',
          'text-[11px] font-medium tracking-wide',
          'shadow-md hover:shadow-lg shadow-purple-900/30',
          'transition-all duration-200 active:scale-95',
          'select-none cursor-pointer',
        ].join(' ')}
      >
        {/* Chat-bubble icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="shrink-0 opacity-80"
        >
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
        <span>Feedback</span>
      </button>

      {/* ── Modal backdrop + dialog ──────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="relative w-[90vw] max-w-md rounded-xl bg-zinc-900 border border-zinc-700/60 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-base font-semibold text-zinc-100">
                Gib uns dein Feedback
              </h2>
              <button
                onClick={handleClose}
                aria-label="Schließen"
                className="text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>

            {/* Embedded Google Form */}
            <div className="px-5 pb-2">
              <iframe
                src={FORM_URL}
                width="100%"
                height="377"
                frameBorder="0"
                marginHeight={0}
                marginWidth={0}
                title="Feedback-Formular"
                className="rounded-lg bg-white"
              >
                Wird geladen…
              </iframe>
            </div>

            {/* Footer */}
            <div className="flex justify-end px-5 pb-4 pt-1">
              <button
                onClick={handleClose}
                className="px-4 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
