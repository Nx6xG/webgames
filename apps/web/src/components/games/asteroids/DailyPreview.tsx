'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import type { DailyModifierDef, DailyRunResult } from './roguelite-types';

interface DailyPreviewProps {
  modifiers: DailyModifierDef[];
  previousResult: DailyRunResult | null;
  alreadyPlayed: boolean;
  onStart: () => void;
  onClose: () => void;
}

export default function DailyPreview({ modifiers, previousResult, alreadyPlayed, onStart, onClose }: DailyPreviewProps) {
  const { t } = useI18n();

  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]/95 animate-[fadeIn_0.25s_ease-out]" style={{ backdropFilter: 'blur(6px)' }}>
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <h1 className="text-2xl font-black tracking-widest text-[var(--fg)] uppercase">{t('asteroids.rl.daily')}</h1>
        <button onClick={onClose} className="flex items-center justify-center w-10 h-10 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)] transition-colors text-xl font-bold cursor-pointer">X</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex flex-col gap-6 max-w-2xl mx-auto">
          {/* Date + description */}
          <div className="text-center">
            <div className="text-lg font-bold text-amber-400 mb-1">{today}</div>
            <p className="text-sm text-[var(--muted)]">{t('asteroids.rl.daily.desc')}</p>
          </div>

          {/* Modifiers */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-3">{t('asteroids.rl.daily.modifiers')}</h2>
            <div className="flex flex-col gap-3">
              {modifiers.map((mod) => (
                <div key={mod.id} className="flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all" style={{ borderLeftWidth: '4px', borderLeftColor: mod.color }}>
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg text-xl shrink-0" style={{ backgroundColor: mod.color + '22' }}>
                    {mod.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-[var(--fg)]">{t(mod.nameKey)}</h3>
                    <p className="text-sm text-[var(--muted)] mt-0.5">{t(mod.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Previous result */}
          {alreadyPlayed && previousResult && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-3">{t('asteroids.rl.daily.yourResult')}</h2>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs text-[var(--muted)] uppercase font-semibold">{t('asteroids.rl.daily.wave')}</span>
                  <div className="text-2xl font-black text-[var(--fg)] tabular-nums">{previousResult.wave}</div>
                </div>
                <div>
                  <span className="text-xs text-[var(--muted)] uppercase font-semibold">{t('asteroids.rl.daily.score')}</span>
                  <div className="text-2xl font-black text-[var(--fg)] tabular-nums">{previousResult.score.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="flex items-center justify-center gap-4 px-6 py-5 border-t border-[var(--border)]">
        <button onClick={onClose} className="px-6 py-2.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)] transition-colors font-semibold cursor-pointer">{t('asteroids.rl.daily.back')}</button>
        <button onClick={onStart} disabled={alreadyPlayed} className={`px-6 py-2.5 rounded-lg font-bold transition-colors ${alreadyPlayed ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' : 'bg-amber-500 text-black hover:bg-amber-400 cursor-pointer'}`}>{alreadyPlayed ? t('asteroids.rl.daily.done') : t('asteroids.rl.daily.start')}</button>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
