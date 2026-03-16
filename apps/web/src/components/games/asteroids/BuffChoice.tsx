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
    // Brief delay so the player sees the selection before the overlay closes
    setTimeout(() => onSelect(index), 250);
  }

  function durationLabel(duration: number): string {
    if (duration === -1) return t('asteroids.rl.instant');
    if (duration === 0) return t('asteroids.rl.permanent');
    return duration + ' ' + t('asteroids.rl.waves');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-[fadeIn_0.3s_ease-out]"
      style={{ backdropFilter: 'blur(4px)' }}
    >
      <div className="flex flex-col items-center gap-6 px-4 py-8 w-full max-w-3xl animate-[slideUp_0.4s_ease-out]">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-widest text-white uppercase">
            {t('asteroids.rl.waveCleared').replace('{n}', String(wave))}
          </h2>
          <p className="mt-2 text-lg text-zinc-400">
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
                className={`group relative flex-1 flex flex-col items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 transition-all duration-200 cursor-pointer ${isSelected ? 'scale-105 ring-2 ring-white/40' : ''} ${isOther ? 'opacity-40 scale-95' : ''} ${selected === null ? 'hover:scale-105 hover:shadow-lg hover:shadow-white/5' : ''}`}
                style={{
                  borderTopWidth: '3px',
                  borderTopColor: buff.color,
                }}
              >
                {/* Icon */}
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-lg text-2xl font-bold"
                  style={{ backgroundColor: buff.color + '22', color: buff.color }}
                >
                  {buff.icon}
                </div>

                {/* Name */}
                <h3 className="text-lg font-bold text-[var(--fg)]">
                  {t(buff.nameKey)}
                </h3>

                {/* Description */}
                <p className="text-sm text-[var(--muted)] text-center leading-relaxed">
                  {t(buff.descKey)}
                </p>

                {/* Duration badge */}
                <span
                  className="mt-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: buff.color + '18',
                    color: buff.color,
                    border: `1px solid ${buff.color}44`,
                  }}
                >
                  {durationLabel(buff.duration)}
                </span>

                {/* Hover glow */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none"
                  style={{
                    boxShadow: `inset 0 0 30px ${buff.color}10, 0 0 20px ${buff.color}08`,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Keyframe styles — global so Webpack doesn't choke on styled-jsx */}
      {/* eslint-disable-next-line react/no-unknown-property */}
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
