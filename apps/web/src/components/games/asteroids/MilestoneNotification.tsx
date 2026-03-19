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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 animate-[fadeIn_0.3s_ease-out]" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="flex flex-col items-center gap-6 px-4 py-8 w-full max-w-lg animate-[slideUp_0.4s_ease-out]">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: '#f59e0b' }}>
            /// ACHIEVEMENT UNLOCKED ///
          </div>
          <h2 className="text-2xl font-black tracking-[0.2em] uppercase" style={{ color: '#f59e0b', textShadow: '0 0 20px rgba(245,158,11,0.3)' }}>
            {t('asteroids.rl.milestones.new')}
          </h2>
        </div>
        <div className="flex flex-col gap-3 w-full">
          {milestones.map((ms) => (
            <div
              key={ms.id}
              className="flex items-center gap-4 p-4"
              style={{
                background: 'rgba(245,158,11,0.05)',
                border: '1px solid rgba(245,158,11,0.2)',
                clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
              }}
            >
              <span className="text-2xl">{ms.icon}</span>
              <div className="flex-1">
                <h3 className="font-black text-sm uppercase tracking-wider" style={{ color: '#f59e0b' }}>{t(ms.nameKey)}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#5a6a7f' }}>{t(ms.descKey)}</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>{t('asteroids.rl.milestones.unlocked')}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-2 px-8 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition-all cursor-pointer hover:brightness-110 active:scale-95"
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#f59e0b',
            clipPath: 'polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%)',
          }}
        >
          OK
        </button>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
