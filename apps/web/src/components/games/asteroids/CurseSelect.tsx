'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import type { CurseId, CurseDef } from './roguelite-types';

interface CurseSelectProps {
  curses: CurseDef[];
  activeCurses: CurseId[];
  curseScrapMultiplier: number;
  onToggle: (id: CurseId) => void;
  onClose: () => void;
}

export default function CurseSelect({ curses, activeCurses, curseScrapMultiplier, onToggle, onClose }: CurseSelectProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]/95 animate-[fadeIn_0.25s_ease-out]" style={{ backdropFilter: 'blur(6px)' }}>
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black tracking-widest text-[var(--fg)] uppercase">{t('asteroids.rl.curses')}</h1>
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1.5">
            <span className="text-sm font-bold text-red-400">{t('asteroids.rl.curses.bonus')}</span>
            <span className="text-lg font-bold text-red-300 tabular-nums">x{curseScrapMultiplier.toFixed(1)}</span>
          </div>
        </div>
        <button onClick={onClose} className="flex items-center justify-center w-10 h-10 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)] transition-colors text-xl font-bold cursor-pointer">X</button>
      </div>
      <div className="px-6 py-2">
        <p className="text-sm text-[var(--muted)] max-w-4xl mx-auto">{t('asteroids.rl.curses.desc')}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {curses.map((curse) => {
            const active = activeCurses.includes(curse.id);
            return (
              <button key={curse.id} onClick={() => onToggle(curse.id)} className={`relative flex items-start gap-4 rounded-xl border p-5 text-left transition-all duration-200 cursor-pointer ${active ? 'border-red-500/50 bg-red-500/5 shadow-sm shadow-red-500/10' : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--border)]'}`}>
                <div className="flex items-center justify-center w-11 h-11 rounded-lg text-lg font-bold shrink-0" style={{ backgroundColor: curse.color + '22', color: curse.color }}>{curse.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--fg)]">{t(curse.nameKey)}</h3>
                    <span className="text-xs font-bold tabular-nums" style={{ color: curse.color }}>x{curse.scrapMultiplier.toFixed(1)}</span>
                  </div>
                  <p className="text-sm text-[var(--muted)] mt-1">{t(curse.descKey)}</p>
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${active ? 'bg-red-500 border-red-500' : 'bg-transparent border-zinc-600'}`}>
                  {active && <span className="text-white text-xs font-bold">&#10003;</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
