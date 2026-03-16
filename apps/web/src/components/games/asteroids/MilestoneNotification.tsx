'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import type { MilestoneDef } from './roguelite-types';

interface MilestoneNotificationProps {
  milestones: MilestoneDef[];
  onClose: () => void;
}

export default function MilestoneNotification({ milestones, onClose }: MilestoneNotificationProps) {
  const { t } = useI18n();

  if (milestones.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 animate-[fadeIn_0.3s_ease-out]" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="flex flex-col items-center gap-6 px-4 py-8 w-full max-w-lg animate-[slideUp_0.4s_ease-out]">
        <h2 className="text-3xl font-black tracking-widest text-amber-400 uppercase">{t('asteroids.rl.milestones.new')}</h2>
        <div className="flex flex-col gap-3 w-full">
          {milestones.map((ms) => (
            <div key={ms.id} className="flex items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <span className="text-2xl">{ms.icon}</span>
              <div className="flex-1">
                <h3 className="font-bold text-amber-300">{t(ms.nameKey)}</h3>
                <p className="text-sm text-zinc-400 mt-0.5">{t(ms.descKey)}</p>
              </div>
              <span className="text-xs font-semibold text-amber-500 uppercase">{t('asteroids.rl.milestones.unlocked')}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-2 px-8 py-3 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 font-bold text-sm transition-all cursor-pointer active:scale-95">OK</button>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
