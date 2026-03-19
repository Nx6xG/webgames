'use client';

import { useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';

interface BuffChoiceProps {
  buffs: Array<{
    id: string;
    nameKey: string;
    descKey: string;
    icon: string;
    duration: number;
    color: string;
  }>;
  wave: number;
  onSelect: (index: number) => void;
}

export default function BuffChoice({ buffs, wave, onSelect }: BuffChoiceProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<number | null>(null);

  function handleSelect(index: number) {
    if (selected !== null) return;
    setSelected(index);
    setTimeout(() => onSelect(index), 250);
  }

  function durationLabel(duration: number): string {
    if (duration === -1) return t('asteroids.rl.instant');
    if (duration === 0) return t('asteroids.rl.permanent');
    return duration + ' ' + t('asteroids.rl.waves');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 animate-[fadeIn_0.3s_ease-out]"
      style={{ backdropFilter: 'blur(4px)' }}
    >
      <div className="flex flex-col items-center gap-6 px-4 py-8 w-full max-w-3xl animate-[slideUp_0.4s_ease-out]">
        {/* Header */}
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: '#5a6a7f' }}>
            /// SYSTEM UPGRADE ///
          </div>
          <h2 className="text-2xl font-black tracking-[0.2em] uppercase" style={{ color: '#0ff0fc', textShadow: '0 0 20px rgba(15,240,252,0.3)' }}>
            {t('asteroids.rl.waveCleared').replace('{n}', String(wave))}
          </h2>
          <p className="mt-2 text-sm" style={{ color: '#5a6a7f' }}>
            {t('asteroids.rl.chooseUpgrade')}
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          {buffs.map((buff, i) => {
            const isSelected = selected === i;
            const isOther = selected !== null && selected !== i;

            return (
              <button
                key={buff.id}
                onClick={() => handleSelect(i)}
                disabled={selected !== null}
                className={`group relative flex-1 flex flex-col items-center gap-3 p-6 transition-all duration-200 cursor-pointer ${isSelected ? 'scale-105' : ''} ${isOther ? 'opacity-30 scale-95' : ''} ${selected === null ? 'hover:scale-105' : ''}`}
                style={{
                  background: '#141922',
                  border: isSelected ? `1px solid ${buff.color}` : '1px solid #1e2a3a',
                  clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
                  boxShadow: isSelected ? `0 0 30px ${buff.color}30, inset 0 0 20px ${buff.color}10` : 'none',
                }}
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-3 right-3 h-px" style={{ background: `linear-gradient(90deg, transparent, ${buff.color}, transparent)` }} />

                {/* Icon */}
                <div
                  className="flex items-center justify-center w-14 h-14 text-2xl font-bold"
                  style={{
                    backgroundColor: buff.color + '15',
                    color: buff.color,
                    border: `1px solid ${buff.color}30`,
                    clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
                  }}
                >
                  {buff.icon}
                </div>

                {/* Name */}
                <h3 className="text-base font-black uppercase tracking-wider" style={{ color: '#c8d6e5' }}>
                  {t(buff.nameKey)}
                </h3>

                {/* Description */}
                <p className="text-xs text-center leading-relaxed" style={{ color: '#5a6a7f' }}>
                  {t(buff.descKey)}
                </p>

                {/* Duration badge */}
                <span
                  className="mt-auto inline-flex items-center gap-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: buff.color + '12',
                    color: buff.color,
                    border: `1px solid ${buff.color}30`,
                    clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
                  }}
                >
                  {durationLabel(buff.duration)}
                </span>

                {/* Hover glow */}
                <div
                  className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none"
                  style={{ boxShadow: `inset 0 0 40px ${buff.color}08, 0 0 20px ${buff.color}06` }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
