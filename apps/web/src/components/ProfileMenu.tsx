'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useNickname } from '@/components/providers/NicknameProvider';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useClickOutside, useEscape } from '@/hooks/useClickOutside';
import { generateRandomNickname, sanitizeNickname } from '@/lib/nickname';
import { loadQuickStats } from '@/lib/localStats';
import type { QuickStats } from '@/lib/localStats';
import { useProgression } from '@/components/providers/ProgressionProvider';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { ProfileCard } from '@/components/ui/ProfileCard';
import { CosmeticsStudio } from '@/components/ui/CosmeticsStudio';
import { ShowcaseEditor } from '@/components/ui/ShowcaseEditor';
import { getNameColorClass } from '@/lib/nameColors';
import { trackAchievementEvent } from '@/lib/achievements/engine';
import { useAchievementToasts } from '@/components/ui/AchievementToasts';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { useAuth } from '@/components/providers/AuthProvider';
import { AuthModal } from '@/components/ui/AuthModal';
import { ProgressionModal } from '@/components/ui/ProgressionModal';

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
    'webgames_progression_v1',
    'webgames_progression_levelups_v1',
    'webgames.doodlejump.bestScore',
    'webgames.crossyroad.bestScore',
  ];
  for (const k of keysToRemove) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}

// ── Main component ───────────────────────────────────────────────────────────

export function ProfileMenu() {
  const { nickname, setNickname, avatarId, nameColor, avatarFrame, cosmetics, updateCosmetics } = useNickname();
  const { lang, setLang, t } = useI18n();
  const { user, role, isSupabaseConfigured, isSyncing, signOut } = useAuth();
  const achToasts = useAchievementToasts();
  const [open, setOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [progressionOpen, setProgressionOpen] = useState(false);

  // Quick stats + progression
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const { levelProgress, isHydrated } = useProgression();

  // Nickname edit mode
  const [editingNick, setEditingNick] = useState(false);
  const [nickValue, setNickValue] = useState('');
  const [nickError, setNickError] = useState<string | null>(null);
  const nickInputRef = useRef<HTMLInputElement>(null);

  // Theme
  const [theme, setTheme] = useState<Theme>('dark');

  // Reset confirm
  const [confirmReset, setConfirmReset] = useState(false);

  // Active section for settings
  const [activeSection, setActiveSection] = useState<'main' | 'settings'>('main');

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTheme(getStoredTheme()); }, []);

  function openMenu() {
    setOpen(true);
    setQuickStats(loadQuickStats());
    setEditingNick(false);
    setNickError(null);
    setConfirmReset(false);
    setActiveSection('main');
  }

  function closeMenu() {
    setOpen(false);
    setEditingNick(false);
    setNickError(null);
    setConfirmReset(false);
    setActiveSection('main');
  }

  useClickOutside(containerRef, closeMenu, open && !studioOpen && !showcaseOpen);
  useEscape(closeMenu, open && !studioOpen && !showcaseOpen);

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
    const ids = trackAchievementEvent({ type: 'profile_customized' });
    if (ids.length > 0) achToasts.push(ids);
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

  const xpPercent = Math.max(2, levelProgress.progress * 100);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-label="Open profile menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-zinc-800 transition-colors group"
      >
        <div className="relative">
          <AvatarBubble avatarId={avatarId} avatarFrame={avatarFrame} nickname={nickname} size="md" cosmetics={cosmetics} />
          {isHydrated && levelProgress.level > 1 && (
            <span className="absolute -bottom-1.5 -right-1.5 min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 border-2 border-zinc-900 text-[9px] font-black text-white leading-none px-1 shadow-sm shadow-indigo-500/30">
              {levelProgress.level}
            </span>
          )}
        </div>
        <span className={`hidden sm:block text-sm transition-colors max-w-[120px] truncate ${getNameColorClass(nameColor) || 'text-zinc-300 group-hover:text-zinc-100'}`}>
          {nickname || '…'}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="fixed top-12 right-3 z-50 w-[320px] rounded-2xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
          style={{
            maxHeight: 'min(78vh, calc(100dvh - 56px))',
            animation: 'wg-profile-menu-in 0.2s ease-out',
          }}
        >
          {/* Ambient glow at top */}
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/[0.04] to-transparent pointer-events-none" />

          {/* ═══ MAIN VIEW ═══ */}
          {activeSection === 'main' && (
            <>
              {/* Header — ProfileCard */}
              <div className="shrink-0 p-3 relative">
                <ProfileCard nickname={nickname} cosmetics={cosmetics} compact />

                {/* Quick stats row */}
                {quickStats && quickStats.playsTotal > 0 && (
                  <div className="mt-2.5 flex items-center gap-3 px-0.5">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-zinc-600 font-medium">{quickStats.playsTotal}</span>
                      <span className="text-zinc-500">{t('menu.gamesCount')}</span>
                    </div>
                    <div className="w-px h-3 bg-zinc-800" />
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-zinc-600 font-medium">{quickStats.winsTotal}</span>
                      <span className="text-zinc-500">{t('menu.winsCount')}</span>
                    </div>
                    <div className="w-px h-3 bg-zinc-800" />
                    <Link href="/achievements" onClick={closeMenu} className="flex items-center gap-1.5 text-[11px] hover:text-amber-400/80 transition-colors">
                      <span className="text-zinc-600 font-medium">{quickStats.achievementsUnlocked}/{quickStats.achievementsTotal}</span>
                      <span className="text-zinc-500">{t('menu.achievementsCount')}</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* ═══ Scrollable body ═══ */}
              <div className="overflow-y-auto overscroll-contain flex-1 min-h-0">

                {/* Progression card */}
                <div className="px-3 pb-2">
                  <button
                    onClick={() => { setProgressionOpen(true); closeMenu(); }}
                    className="w-full rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-3 text-left hover:border-indigo-500/30 hover:bg-zinc-900 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <span className="text-indigo-300 font-black text-sm">{levelProgress.level}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-200">Lv. {levelProgress.level}</span>
                          <span className="text-[10px] text-indigo-400/70 font-medium px-1.5 py-0.5 rounded-full bg-indigo-500/10">{t(`progression.rank.${levelProgress.rank.toLowerCase()}`)}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 tabular-nums">
                          {levelProgress.currentXp}/{levelProgress.requiredXp} {t('progression.xp')}
                        </span>
                      </div>
                      <svg className="w-4 h-4 text-zinc-700 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>

                    {/* XP bar */}
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-400 transition-all duration-700"
                        style={{ width: `${xpPercent}%` }}
                      />
                    </div>

                    {levelProgress.totalTokens > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <TokenIcon size="xs" />
                        <span className="text-[10px] text-amber-400/70 font-medium">{levelProgress.totalTokens} {t('progression.tokens')}</span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Action grid — Customize + Showcase */}
                <div className="px-3 pb-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setStudioOpen(true)}
                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800/50 hover:border-zinc-700/80 hover:bg-zinc-900 transition-all group"
                  >
                    <span className="text-lg group-hover:scale-110 transition-transform">🎨</span>
                    <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200 font-medium transition-colors">{t('studio.customize')}</span>
                  </button>
                  <button
                    onClick={() => setShowcaseOpen(true)}
                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800/50 hover:border-zinc-700/80 hover:bg-zinc-900 transition-all group"
                  >
                    <span className="text-lg group-hover:scale-110 transition-transform">🪟</span>
                    <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200 font-medium transition-colors">{t('showcase.edit')}</span>
                  </button>
                </div>

                {/* Auth section */}
                {isSupabaseConfigured && (
                  <div className="px-3 pb-1">
                    {user ? (
                      <div className="flex items-center justify-between px-1 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-sm shadow-emerald-400/40" />
                          <span className="text-[11px] text-zinc-500 truncate">{user.email}</span>
                          {isSyncing && (
                            <span className="text-[10px] text-indigo-400/80 shrink-0">{t('auth.syncing')}</span>
                          )}
                        </div>
                        <button
                          onClick={() => { signOut(); closeMenu(); }}
                          className="text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 ml-2"
                        >
                          {t('auth.signOut')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAuthOpen(true)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/50 hover:border-zinc-700/80 hover:bg-zinc-900 transition-all w-full"
                      >
                        <span className="text-sm">🔑</span>
                        <span className="text-[11px] text-zinc-300 font-medium">{t('auth.signIn')}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent mx-4 my-1" />

                {/* Nav links */}
                <div className="px-2 py-1 space-y-0.5">
                  <Link href="/profile" onClick={closeMenu} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-900/80 transition-colors group">
                    <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-[12px] text-zinc-300 group-hover:text-zinc-100 font-medium transition-colors">{t('nav.profile')}</span>
                  </Link>
                  <Link href="/achievements" onClick={closeMenu} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-900/80 transition-colors group">
                    <svg className="w-4 h-4 text-zinc-600 group-hover:text-amber-400/80 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m-4.5-8a4.5 4.5 0 019 0v0H7.5zM6 3h12v4a2 2 0 01-2 2h-1.5m-5 0H8a2 2 0 01-2-2V3zm0 0H4a1 1 0 00-1 1v2a3 3 0 003 3m12-6h2a1 1 0 011 1v2a3 3 0 01-3 3" />
                    </svg>
                    <span className="text-[12px] text-zinc-300 group-hover:text-zinc-100 font-medium transition-colors">{t('menu.achievements')}</span>
                  </Link>
                  <Link href="/leaderboards" onClick={closeMenu} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-900/80 transition-colors group">
                    <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v8H3zm6-4h2v12H9zm6-6h2v18h-2zm6 10h2v8h-2z" />
                    </svg>
                    <span className="text-[12px] text-zinc-300 group-hover:text-zinc-100 font-medium transition-colors">{t('menu.stats')}</span>
                  </Link>
                  {role === 'admin' && (
                    <Link href="/admin" onClick={closeMenu} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-950/30 transition-colors group">
                      <svg className="w-4 h-4 text-red-500/60 group-hover:text-red-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                      </svg>
                      <span className="text-[12px] text-red-400/80 group-hover:text-red-400 font-medium transition-colors">{t('nav.admin')}</span>
                    </Link>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent mx-4 my-1" />

                {/* Settings + Support row */}
                <div className="px-2 py-1 space-y-0.5">
                  <button
                    onClick={() => setActiveSection('settings')}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-900/80 transition-colors w-full text-left group"
                  >
                    <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-[12px] text-zinc-300 group-hover:text-zinc-100 font-medium flex-1 transition-colors">{t('profile.settings')}</span>
                    <svg className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <a
                    href="https://ko-fi.com/nicogrim"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-900/80 transition-colors w-full group"
                  >
                    <span className="text-sm shrink-0 leading-none w-4 text-center">☕</span>
                    <span className="text-[12px] text-zinc-300 group-hover:text-zinc-100 font-medium transition-colors">{t('support.label')}</span>
                  </a>
                </div>

                {/* Bottom padding */}
                <div className="h-2" />
              </div>
            </>
          )}

          {/* ═══ SETTINGS VIEW ═══ */}
          {activeSection === 'settings' && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Settings header */}
              <div className="shrink-0 flex items-center gap-2 px-3 py-3 border-b border-zinc-800/60">
                <button
                  onClick={() => setActiveSection('main')}
                  className="p-1.5 -ml-1 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-semibold text-zinc-200">{t('profile.settings')}</span>
              </div>

              <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 px-3 py-3 space-y-4">

                {/* Nickname section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">{t('settings.nickname')}</span>
                    {!editingNick && (
                      <button onClick={startEditNick} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                        {t('menu.editNickname')}
                      </button>
                    )}
                  </div>
                  {editingNick ? (
                    <div className="space-y-2">
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
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                      />
                      {nickError && <p className="text-[11px] text-rose-400 px-0.5">{nickError}</p>}
                      <div className="flex gap-2">
                        <button onClick={saveNick} className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-colors">
                          {t('common.save')}
                        </button>
                        <button onClick={cancelNick} className="flex-1 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-[11px] font-medium transition-all">
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800/50 rounded-lg px-3 py-2">
                      <span className="text-sm text-zinc-200 truncate font-medium">{nickname}</span>
                      <button
                        onClick={randomName}
                        className="p-1 rounded-md hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-all shrink-0"
                        title={t('settings.randomName')}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-zinc-800/60" />

                {/* Theme toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">{t('settings.theme')}</span>
                  <div className="flex gap-1 p-1 bg-zinc-900/80 border border-zinc-800/50 rounded-lg">
                    {(['dark', 'light'] as Theme[]).map((th) => (
                      <button
                        key={th}
                        onClick={() => handleTheme(th)}
                        className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                          theme === th
                            ? 'bg-zinc-700/80 text-zinc-100 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {th === 'dark' ? t('settings.dark') : t('settings.light')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">{t('profile.language')}</span>
                  <div className="flex gap-1 p-1 bg-zinc-900/80 border border-zinc-800/50 rounded-lg">
                    {(['de', 'en'] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        className={`px-3 py-1 rounded-md text-[11px] font-semibold uppercase transition-all ${
                          lang === l
                            ? 'bg-zinc-700/80 text-zinc-100 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-zinc-800/60" />

                {/* Danger zone */}
                <div>
                  <span className="text-[11px] text-zinc-600 uppercase tracking-wider font-bold block mb-2">{t('menu.resetData')}</span>
                  {!confirmReset ? (
                    <button
                      onClick={() => setConfirmReset(true)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border border-zinc-800/50 hover:border-rose-500/30 hover:bg-rose-950/20 transition-all group"
                    >
                      <svg className="w-4 h-4 text-zinc-700 group-hover:text-rose-400/80 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="text-[11px] text-zinc-500 group-hover:text-rose-300/80 font-medium transition-colors">{t('menu.resetData')}</span>
                    </button>
                  ) : (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 space-y-2.5">
                      <p className="text-[11px] text-rose-400/90 font-medium">{t('menu.resetConfirm')}</p>
                      <div className="flex gap-2">
                        <button onClick={handleReset} className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition-colors">
                          {t('menu.resetData')}
                        </button>
                        <button onClick={() => setConfirmReset(false)} className="flex-1 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium transition-all">
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {studioOpen && (
        <CosmeticsStudio
          initialCosmetics={cosmetics}
          nickname={nickname}
          onSave={(newCosmetics) => { updateCosmetics(newCosmetics); const ids = trackAchievementEvent({ type: 'profile_customized' }); if (ids.length > 0) achToasts.push(ids); }}
          onClose={() => setStudioOpen(false)}
        />
      )}

      {showcaseOpen && (
        <ShowcaseEditor
          onClose={() => setShowcaseOpen(false)}
        />
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {progressionOpen && (
        <ProgressionModal onClose={() => setProgressionOpen(false)} />
      )}

    </div>
  );
}
