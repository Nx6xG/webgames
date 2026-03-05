'use client';

import { useEffect, useRef, useState } from 'react';
import { useNickname } from '@/components/providers/NicknameProvider';
import { useI18n } from '@/components/providers/LanguageProvider';
import { generateRandomNickname, sanitizeNickname } from '@/lib/nickname';

const THEME_KEY = 'webgames:theme';
type Theme = 'dark' | 'light';

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}

function applyTheme(th: Theme) {
  document.documentElement.dataset.theme = th;
  localStorage.setItem(THEME_KEY, th);
}

/**
 * Shared settings panel used in both the header dropdown and the /profile page.
 *
 * @param autoFocus  — auto-focus nickname input on mount (dropdown: true, profile page: false)
 * @param onDone    — called after save / random-name / cancel (dropdown uses this to close)
 */
export function UserSettingsPanel({
  autoFocus = false,
  onDone,
}: {
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const { nickname, setNickname } = useNickname();
  const { lang, setLang, t } = useI18n();
  const [value, setValue] = useState(nickname);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTheme(getStoredTheme()); }, []);

  // Keep value in sync when nickname changes externally
  useEffect(() => { setValue(nickname); }, [nickname]);

  useEffect(() => {
    if (autoFocus) {
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [autoFocus]);

  function handleSave() {
    const clean = sanitizeNickname(value);
    if (clean.length < 2) {
      setError(t('settings.nicknameTooShort'));
      return;
    }
    setNickname(clean);
    setError(null);
    onDone?.();
  }

  function handleRandomName() {
    const name = generateRandomNickname();
    setNickname(name);
    setValue(name);
    onDone?.();
  }

  function handleCancel() {
    setValue(nickname);
    setError(null);
    onDone?.();
  }

  function handleTheme(th: Theme) {
    applyTheme(th);
    setTheme(th);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Nickname ── */}
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
        {t('settings.nickname')}
      </p>

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => { setValue(e.target.value.slice(0, 18)); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') handleCancel();
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
          {t('common.save')}
        </button>
        <button
          onClick={handleCancel}
          className="flex-1 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold shrink-0">
          {t('profile.settings')}
        </span>
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
        {t('settings.randomName')}
      </button>

      {/* ── Theme toggle ── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-medium">{t('settings.theme')}</span>
        <div className="flex gap-0.5 p-0.5 bg-zinc-800 rounded-lg">
          {(['dark', 'light'] as Theme[]).map((th) => (
            <button
              key={th}
              onClick={() => handleTheme(th)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                theme === th
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {th === 'dark' ? t('settings.dark') : t('settings.light')}
            </button>
          ))}
        </div>
      </div>

      {/* ── Language toggle ── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-medium">{t('profile.language')}</span>
        <div className="flex gap-0.5 p-0.5 bg-zinc-800 rounded-lg">
          {(['de', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 rounded-md text-xs font-semibold uppercase transition-colors ${
                lang === l
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
