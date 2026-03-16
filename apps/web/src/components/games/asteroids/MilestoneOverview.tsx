'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import type { MilestoneDef, MilestoneId } from './roguelite-types';
import { SHIPS, TEMP_BUFF_MAP, ARTIFACT_MAP } from './roguelite-data';

interface MilestoneOverviewProps {
  milestones: MilestoneDef[];
  unlockedMilestones: MilestoneId[];
  onClose: () => void;
}

function getUnlockLabel(ms: MilestoneDef, t: (k: string) => string): string {
  const u = ms.unlock;
  if (u.type === 'ship') {
    const ship = SHIPS.find((s) => s.id === u.shipId);
    return ship ? `${ship.icon} ${t(ship.nameKey)}` : u.shipId;
  }
  if (u.type === 'buff') {
    const buff = TEMP_BUFF_MAP[u.buffId];
    return buff ? `${buff.icon} ${t(buff.nameKey)}` : u.buffId;
  }
  if (u.type === 'artifact') {
    const art = ARTIFACT_MAP[u.artifactId];
    return art ? `${art.icon} ${t(art.nameKey)}` : u.artifactId;
  }
  return '';
}

function getUnlockTypeLabel(ms: MilestoneDef, t: (k: string) => string): string {
  if (ms.unlock.type === 'ship') return t('asteroids.rl.content.ships');
  if (ms.unlock.type === 'buff') return t('asteroids.rl.content.buffs');
  if (ms.unlock.type === 'artifact') return t('asteroids.rl.content.artifacts');
  return '';
}

export default function MilestoneOverview({ milestones, unlockedMilestones, onClose }: MilestoneOverviewProps) {
  const { t } = useI18n();
  const doneCount = unlockedMilestones.length;
  const totalCount = milestones.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]/95 animate-[fadeIn_0.25s_ease-out]" style={{ backdropFilter: 'blur(6px)' }}>
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black tracking-widest text-[var(--fg)] uppercase">{t('asteroids.rl.milestones')}</h1>
          <span className="text-sm font-bold text-amber-400 tabular-nums">{doneCount}/{totalCount} ({pct}%)</span>
        </div>
        <button onClick={onClose} className="flex items-center justify-center w-10 h-10 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)] transition-colors text-xl font-bold cursor-pointer">X</button>
      </div>

      {/* Progress bar */}
      <div className="px-6 pt-5 pb-2">
        <div className="max-w-4xl mx-auto">
          <div className="h-2.5 rounded-full bg-zinc-800 border border-zinc-700/50 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col gap-3 max-w-4xl mx-auto">
          {milestones.map((ms) => {
            const done = unlockedMilestones.includes(ms.id);
            return (
              <div key={ms.id} className={`flex items-start gap-4 rounded-xl border p-5 transition-all ${done ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--border)] bg-[var(--card)]'}`}>
                <div className={`flex items-center justify-center w-12 h-12 rounded-lg text-2xl shrink-0 ${done ? 'bg-amber-500/15' : 'bg-zinc-800'}`}>
                  {ms.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-base font-bold ${done ? 'text-amber-300' : 'text-[var(--fg)]'}`}>{t(ms.nameKey)}</h3>
                    {done && <span className="text-xs font-semibold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded">{t('asteroids.rl.milestones.unlocked')}</span>}
                    {!done && <span className="text-xs font-semibold text-zinc-500 uppercase bg-zinc-800 px-2 py-0.5 rounded">{t('asteroids.rl.ms.locked')}</span>}
                  </div>
                  <p className="text-sm text-[var(--muted)] mt-1">{t(ms.descKey)}</p>
                  <div className="flex items-center gap-3 mt-2.5">
                    <span className="text-xs text-zinc-500 font-semibold uppercase">{t('asteroids.rl.ms.reward')}:</span>
                    <span className="text-xs font-bold text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded">{getUnlockTypeLabel(ms, t)}</span>
                    <span className={`text-sm font-bold ${done ? 'text-amber-300' : 'text-zinc-300'}`}>{getUnlockLabel(ms, t)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
