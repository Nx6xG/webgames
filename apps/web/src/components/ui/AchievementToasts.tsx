'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getAchievementById, TIER_XP, TIER_TOKENS } from '@/lib/achievements';
import type { AchievementDefinition } from '@/lib/achievements';
import { useI18n } from '@/components/providers/LanguageProvider';
import { getAvatarForAchievement, addRecentAvatarUnlocks } from '@/lib/avatars';

// ── Recently-unlocked tracking (in-memory, shared across components) ──────────

interface RecentUnlock {
  id: string;
  ts: number;
}

const recentUnlocks: RecentUnlock[] = [];
const RECENT_WINDOW_MS = 10_000;

function addRecentUnlocks(ids: string[]) {
  const now = Date.now();
  for (const id of ids) {
    recentUnlocks.push({ id, ts: now });
  }
  // prune old entries
  while (recentUnlocks.length > 0 && recentUnlocks[0].ts < now - RECENT_WINDOW_MS) {
    recentUnlocks.shift();
  }
}

export function getRecentUnlockIds(): Set<string> {
  const cutoff = Date.now() - RECENT_WINDOW_MS;
  return new Set(recentUnlocks.filter((r) => r.ts >= cutoff).map((r) => r.id));
}

// ── Context ────────────────────────────────────────────────────────────────────

interface AchievementToastCtx {
  push: (ids: string[]) => void;
}

const Ctx = createContext<AchievementToastCtx>({ push: () => {} });

export function useAchievementToasts() {
  return useContext(Ctx);
}

// ── Provider ───────────────────────────────────────────────────────────────────

interface ToastItem {
  key: number;
  def: AchievementDefinition;
  leaving: boolean;
}

let nextKey = 0;

export function AchievementToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timers = timerRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const push = useCallback((ids: string[]) => {
    const items: ToastItem[] = [];
    for (const id of ids) {
      const def = getAchievementById(id);
      if (!def) continue;
      items.push({ key: nextKey++, def, leaving: false });
    }
    if (items.length === 0) return;

    // Track for recently-unlocked highlight on /achievements
    addRecentUnlocks(ids);

    // Track avatar unlocks for the "recently unlocked" section in AvatarPicker
    const newAvatarIds: string[] = [];
    for (const id of ids) {
      const av = getAvatarForAchievement(id);
      if (av) newAvatarIds.push(av.id);
    }
    if (newAvatarIds.length > 0) addRecentAvatarUnlocks(newAvatarIds);

    setToasts((prev) => [...prev, ...items]);

    for (const item of items) {
      const t1 = setTimeout(() => {
        setToasts((prev) =>
          prev.map((toast) => (toast.key === item.key ? { ...toast, leaving: true } : toast)),
        );
        const t2 = setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.key !== item.key));
        }, 400);
        timerRef.current.push(t2);
      }, 4000);
      timerRef.current.push(t1);
    }
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <ToastStack toasts={toasts} />
    </Ctx.Provider>
  );
}

// ── Toast stack UI ─────────────────────────────────────────────────────────────

function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  const { t } = useI18n();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.key}
          className={`pointer-events-auto flex items-center gap-3 rounded-xl border border-yellow-500/40 bg-zinc-900/95 px-4 py-3.5 shadow-[0_0_20px_rgba(234,179,8,0.15)] backdrop-blur-md transition-all duration-400 min-w-[280px] max-w-[340px] ${
            toast.leaving ? 'translate-x-[120%] opacity-0' : 'translate-x-0 opacity-100'
          }`}
          style={{ animation: toast.leaving ? undefined : 'ach-slide-in 0.35s cubic-bezier(0.16,1,0.3,1)' }}
        >
          <div className="text-3xl shrink-0 w-11 h-11 flex items-center justify-center rounded-lg bg-yellow-500/10">
            {toast.def.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow-500/70 mb-0.5">
              {t('achievements.toast.header')}
            </p>
            <p className="text-sm font-bold text-yellow-400 truncate">{t(toast.def.nameKey)}</p>
            <p className="text-xs text-zinc-400 truncate">{t(toast.def.descKey)}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {TIER_XP[toast.def.tier] > 0 && (
                <span className="text-[10px] font-semibold text-amber-400/80">+{TIER_XP[toast.def.tier]} XP</span>
              )}
              {TIER_TOKENS[toast.def.tier] > 0 && (
                <span className="text-[10px] font-semibold text-purple-400">+{TIER_TOKENS[toast.def.tier]} Token</span>
              )}
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes ach-slide-in {
          0%   { transform: translateX(120%) scale(0.95); opacity: 0; }
          100% { transform: translateX(0) scale(1);       opacity: 1; }
        }
      `}</style>
    </div>
  );
}
