'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useNickname } from '@/components/providers/NicknameProvider';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useClickOutside, useEscape } from '@/hooks/useClickOutside';
import { generateRandomNickname, sanitizeNickname } from '@/lib/nickname';
import { loadQuickStats } from '@/lib/localStats';
import type { QuickStats } from '@/lib/localStats';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { ProfileCard } from '@/components/ui/ProfileCard';
import { CosmeticsStudio } from '@/components/ui/CosmeticsStudio';
import { getNameColorClass } from '@/lib/nameColors';

// ── Theme helpers ──────────────────────────────────────────────────────────────

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

// ── Reset helper ───────────────────────────────────────────────────────────────

function resetAllLocalData() {
  const keysToRemove = [
    'webgames_stats_v1',
    'webgames_achievements_v1',
    'webgames.snake.highscores',
    'webgames.snake.bestScore',
    'webgames.tetris.stats',
    'webgames.2048.highscores',
    'webgames:2048:best',
    'webgames.flappy.highscores',
    'webgames.flappy.bestScore',
    'webgames.sudoku.stats',
  ];
  for (const k of keysToRemove) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconTrophy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m-4.5-8a4.5 4.5 0 019 0v0H7.5zM6 3h12v4a2 2 0 01-2 2h-1.5m-5 0H8a2 2 0 01-2-2V3zm0 0H4a1 1 0 00-1 1v2a3 3 0 003 3m12-6h2a1 1 0 011 1v2a3 3 0 01-3 3" />
    </svg>
  );
}

function IconStats({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v8H3zm6-4h2v12H9zm6-6h2v18h-2zm6 10h2v8h-2z" />
    </svg>
  );
}

function IconChevron({ className, open }: { className?: string; open?: boolean }) {
  return (
    <svg
      className={`${className ?? ''} transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function IconGear({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ProfileMenu() {
  const { nickname, setNickname, avatarId, nameColor, avatarFrame, cosmetics, updateCosmetics } = useNickname();
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);

  // Quick stats (loaded once when dropdown opens)
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);

  // Settings accordion
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Nickname edit mode
  const [editingNick, setEditingNick] = useState(false);
  const [nickValue, setNickValue] = useState('');
  const [nickError, setNickError] = useState<string | null>(null);
  const nickInputRef = useRef<HTMLInputElement>(null);

  // Theme
  const [theme, setTheme] = useState<Theme>('dark');

  // Reset confirm
  const [confirmReset, setConfirmReset] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTheme(getStoredTheme()); }, []);

  function openMenu() {
    setOpen(true);
    setQuickStats(loadQuickStats());
    setEditingNick(false);
    setNickError(null);
    setConfirmReset(false);
  }

  function closeMenu() {
    setOpen(false);
    setEditingNick(false);
    setNickError(null);
    setConfirmReset(false);
  }

  useClickOutside(containerRef, closeMenu, open && !studioOpen);
  useEscape(closeMenu, open && !studioOpen);

  // Auto-focus nick input when entering edit mode
  useEffect(() => {
    if (editingNick) {
      const id = setTimeout(() => nickInputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [editingNick]);

  function startEditNick() {
    setNickValue(nickname);
    setNickError(null);
    setEditingNick(true);
  }

  function saveNick() {
    const clean = sanitizeNickname(nickValue);
    if (clean.length < 2) { setNickError(t('settings.nicknameTooShort')); return; }
    setNickname(clean);
    setEditingNick(false);
    setNickError(null);
  }

  function cancelNick() {
    setEditingNick(false);
    setNickError(null);
  }

  function randomName() {
    const name = generateRandomNickname();
    setNickname(name);
    setNickValue(name);
    setEditingNick(false);
  }

  function handleTheme(th: Theme) {
    applyTheme(th);
    setTheme(th);
  }

  function handleReset() {
    resetAllLocalData();
    setConfirmReset(false);
    setQuickStats(loadQuickStats());
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-label="Open profile menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-zinc-800 transition-colors group"
      >
        <AvatarBubble avatarId={avatarId} avatarFrame={avatarFrame} nickname={nickname} size="md" cosmetics={cosmetics} />
        <span className={`hidden sm:block text-sm transition-colors max-w-[120px] truncate ${getNameColorClass(nameColor) || 'text-zinc-300 group-hover:text-zinc-100'}`}>
          {nickname || '…'}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="fixed top-12 right-3 z-50 w-[300px] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl flex flex-col"
          style={{ maxHeight: 'min(72vh, calc(100dvh - 56px))' }}
        >

          {/* ═══ Header — ProfileCard compact ═══ */}
          <div className="shrink-0 p-2">
            <ProfileCard nickname={nickname} cosmetics={cosmetics} compact />
            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                {t('menu.online')}
              </p>
              <button
                onClick={closeMenu}
                aria-label={t('common.close')}
                className="text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 rounded shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {quickStats && quickStats.playsTotal > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500 px-1">
                <span>{quickStats.playsTotal} {t('menu.gamesCount')}</span>
                <span className="text-zinc-700">&middot;</span>
                <span>{quickStats.winsTotal} {t('menu.winsCount')}</span>
                <span className="text-zinc-700">&middot;</span>
                <Link href="/achievements" onClick={closeMenu} className="hover:text-yellow-400 transition-colors">
                  {quickStats.achievementsUnlocked}/{quickStats.achievementsTotal} {t('menu.achievementsCount')}
                </Link>
              </div>
            )}
          </div>

          {/* ═══ Scrollable body ═══ */}
          <div className="overflow-y-auto overscroll-contain flex-1 min-h-0">

            {/* Customize button */}
            <div className="px-1 py-0.5">
              <button
                onClick={() => setStudioOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors w-full text-left"
              >
                <span className="text-sm shrink-0">🎨</span>
                <span className="text-xs text-zinc-200">{t('studio.customize')}</span>
              </button>
            </div>

            <div className="h-px bg-zinc-800 mx-1.5" />

            {/* Nav links */}
            <div className="px-1 py-0.5">
              <Link href="/profile" onClick={closeMenu} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                <IconUser className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-xs text-zinc-200">{t('nav.profile')}</span>
              </Link>
              <Link href="/achievements" onClick={closeMenu} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                <IconTrophy className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-xs text-zinc-200">{t('menu.achievements')}</span>
              </Link>
              <Link href="/leaderboards" onClick={closeMenu} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                <IconStats className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-xs text-zinc-200">{t('menu.stats')}</span>
              </Link>
            </div>

            <div className="h-px bg-zinc-800 mx-1.5" />

            {/* Settings accordion */}
            <div className="px-1 py-0.5">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                aria-expanded={settingsOpen}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors w-full text-left"
              >
                <IconGear className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-xs text-zinc-200 flex-1">{t('profile.settings')}</span>
                <IconChevron className="w-3 h-3 text-zinc-500 shrink-0" open={settingsOpen} />
              </button>

              {settingsOpen && (
                <div className="px-2.5 pt-1.5 pb-0.5 space-y-2.5">

                  {/* Nickname */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                        {t('settings.nickname')}
                      </span>
                      {!editingNick && (
                        <button onClick={startEditNick} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                          {t('menu.editNickname')}
                        </button>
                      )}
                    </div>
                    {editingNick ? (
                      <div className="space-y-1.5">
                        <input
                          ref={nickInputRef}
                          value={nickValue}
                          onChange={(e) => { setNickValue(e.target.value.slice(0, 18)); setNickError(null); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveNick();
                            if (e.key === 'Escape') cancelNick();
                          }}
                          maxLength={18}
                          placeholder="Enter nickname…"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                        />
                        {nickError && <p className="text-[10px] text-rose-400">{nickError}</p>}
                        <div className="flex gap-1.5">
                          <button onClick={saveNick} className="flex-1 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold transition-colors">
                            {t('common.save')}
                          </button>
                          <button onClick={cancelNick} className="flex-1 py-0.5 rounded-md border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-[10px] transition-colors">
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-300 truncate">{nickname}</p>
                    )}
                  </div>

                  {/* Random name */}
                  <button
                    onClick={randomName}
                    className="flex items-center gap-1.5 w-full px-2 py-1 rounded-md border border-zinc-700/70 hover:border-zinc-600 text-zinc-400 hover:text-zinc-100 text-[10px] font-medium transition-colors text-left"
                  >
                    <IconRefresh className="w-3 h-3 shrink-0" />
                    {t('settings.randomName')}
                  </button>

                  <div className="h-px bg-zinc-800" />

                  {/* Theme toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 font-medium">{t('settings.theme')}</span>
                    <div className="flex gap-0.5 p-0.5 bg-zinc-800 rounded-md">
                      {(['dark', 'light'] as Theme[]).map((th) => (
                        <button
                          key={th}
                          onClick={() => handleTheme(th)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                            theme === th ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {th === 'dark' ? t('settings.dark') : t('settings.light')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 font-medium">{t('profile.language')}</span>
                    <div className="flex gap-0.5 p-0.5 bg-zinc-800 rounded-md">
                      {(['de', 'en'] as const).map((l) => (
                        <button
                          key={l}
                          onClick={() => setLang(l)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase transition-colors ${
                            lang === l ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Support */}
            <div className="h-px bg-zinc-800 mx-1.5" />
            <div className="px-1 py-0.5">
              <a
                href="https://buymeacoffee.com/nx6xg?status=1"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors w-full"
              >
                <span className="text-sm shrink-0 leading-none">☕</span>
                <span className="text-xs text-zinc-200">{t('support.label')}</span>
              </a>
            </div>

            {/* Danger zone */}
            <div className="h-px bg-zinc-800 mx-1.5" />
            <div className="px-1 py-0.5">
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-950/30 transition-colors w-full text-left"
                >
                  <IconTrash className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  <span className="text-[10px] text-zinc-500">{t('menu.resetData')}</span>
                </button>
              ) : (
                <div className="px-2.5 py-1.5 space-y-1.5">
                  <p className="text-[10px] text-rose-400">{t('menu.resetConfirm')}</p>
                  <div className="flex gap-1.5">
                    <button onClick={handleReset} className="flex-1 py-0.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold transition-colors">
                      {t('menu.resetData')}
                    </button>
                    <button onClick={() => setConfirmReset(false)} className="flex-1 py-0.5 rounded-md border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-[10px] transition-colors">
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {studioOpen && (
        <CosmeticsStudio
          initialCosmetics={cosmetics}
          nickname={nickname}
          onSave={(newCosmetics) => updateCosmetics(newCosmetics)}
          onClose={() => setStudioOpen(false)}
        />
      )}
    </div>
  );
}
