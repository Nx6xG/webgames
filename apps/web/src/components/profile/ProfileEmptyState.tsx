'use client';

import Link from 'next/link';

interface Props {
  title: string;
  message: string;
}

export function ProfileEmptyState({ title, message }: Props) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4 opacity-40">👤</div>
        <h1 className="text-xl font-bold text-zinc-200 mb-2">{title}</h1>
        <p className="text-sm text-zinc-500 mb-6">{message}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Startseite
        </Link>
      </div>
    </div>
  );
}
