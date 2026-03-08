'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import type { LevelUpResult } from '@/lib/progression';

// ── Context ────────────────────────────────────────────────────────────────────

interface LevelUpToastCtx {
  push: (results: LevelUpResult[]) => void;
}

const Ctx = createContext<LevelUpToastCtx>({ push: () => {} });

export function useLevelUpToasts() {
  return useContext(Ctx);
}

// ── Provider ───────────────────────────────────────────────────────────────────

interface ToastItem {
  key: number;
  result: LevelUpResult;
  leaving: boolean;
}

let nextKey = 0;

export function LevelUpToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timers = timerRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const push = useCallback((results: LevelUpResult[]) => {
    const items: ToastItem[] = results.map((r) => ({
      key: nextKey++,
      result: r,
      leaving: false,
    }));
    if (items.length === 0) return;

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
      }, 5000);
      timerRef.current.push(t1);
    }
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <LevelUpToastStack toasts={toasts} />
    </Ctx.Provider>
  );
}

// ── Toast stack UI ─────────────────────────────────────────────────────────────

function LevelUpToastStack({ toasts }: { toasts: ToastItem[] }) {
  const { t } = useI18n();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9999] flex flex-col-reverse gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.key}
          className={`pointer-events-auto flex items-center gap-3 rounded-xl border border-indigo-500/40 bg-zinc-900/95 px-4 py-3.5 shadow-[0_0_20px_rgba(99,102,241,0.2)] backdrop-blur-md transition-all duration-400 min-w-[260px] max-w-[340px] ${
            toast.leaving ? '-translate-x-[120%] opacity-0' : 'translate-x-0 opacity-100'
          }`}
          style={{ animation: toast.leaving ? undefined : 'lvl-slide-in 0.35s cubic-bezier(0.16,1,0.3,1)' }}
        >
          <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-indigo-500/15 shrink-0">
            <span className="text-2xl">⬆️</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70 mb-0.5">
              {t('progression.levelUp')}
            </p>
            <p className="text-sm font-bold text-indigo-300">
              Lv. {toast.result.fromLevel} → Lv. {toast.result.toLevel}
            </p>
            <p className="text-xs text-zinc-400">
              +{toast.result.tokensGranted} {toast.result.tokensGranted === 1 ? t('progression.tokenEarned') : t('progression.tokensEarned')}
            </p>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes lvl-slide-in {
          0%   { transform: translateX(-120%) scale(0.95); opacity: 0; }
          100% { transform: translateX(0) scale(1);       opacity: 1; }
        }
      `}</style>
    </div>
  );
}
