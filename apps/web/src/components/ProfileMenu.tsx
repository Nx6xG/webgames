'use client';

import { useEffect, useRef, useState } from 'react';
import { useNickname } from '@/components/providers/NicknameProvider';
import { generateRandomNickname, sanitizeNickname } from '@/lib/nickname';

const THEME_KEY = 'webgames:theme';
type Theme = 'dark' | 'light';

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}

function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem(THEME_KEY, t);
}

export function ProfileMenu() {
  const { nickname, setNickname } = useNickname();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync theme state with localStorage on mount
  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function openMenu() {
    setValue(nickname);
    setError(null);
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    setError(null);
  }

  function handleSave() {
    const clean = sanitizeNickname(value);
    if (clean.length < 2) {
      setError('Must be at least 2 characters.');
      return;
    }
    setNickname(clean);
    closeMenu();
  }

  function handleRandomName() {
    setNickname(generateRandomNickname());
    closeMenu();
  }

  function handleTheme(t: Theme) {
    applyTheme(t);
    setTheme(t);
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Auto-focus input when panel opens
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  const initial = nickname.charAt(0).toUpperCase() || '?';

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={openMenu}
        aria-label="Open profile menu"
        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-zinc-800 transition-colors group"
      >
        <span className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white shrink-0 select-none">
          {initial}
        </span>
        <span className="hidden sm:block text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors max-w-[120px] truncate">
          {nickname || '…'}
        </span>
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={closeMenu} aria-hidden />
      )}

      {/* Dropdown panel */}
      {open && (
        <div className="fixed top-14 right-4 z-50 w-72 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-4 flex flex-col gap-3">

          {/* ── Nickname section ── */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Nickname</p>
            <button
              onClick={closeMenu}
              aria-label="Close"
              className="text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 rounded"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <input
            ref={inputRef}
            value={value}
            onChange={(e) => { setValue(e.target.value.slice(0, 18)); setError(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') closeMenu();
            }}
            maxLength={18}
            placeholder="Enter nickname…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
          />

          {error && <p className="text-xs text-rose-400 -mt-1">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              Save
            </button>
            <button
              onClick={closeMenu}
              className="flex-1 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* ── Divider ── */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold shrink-0">Settings</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* ── Random name ── */}
          <button
            onClick={handleRandomName}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-100 text-xs font-medium transition-colors text-left"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Random name
          </button>

          {/* ── Theme toggle ── */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-medium">Theme</span>
            <div className="flex gap-0.5 p-0.5 bg-zinc-800 rounded-lg">
              {(['dark', 'light'] as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTheme(t)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                    theme === t
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
