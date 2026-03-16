'use client';

import { useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';

interface ArtifactChoiceProps {
  artifacts: Array<{
    id: string;
    nameKey: string;
    descKey: string;
    icon: string;
    color: string;
  }>;
  onSelect: (index: number) => void;
}

export default function ArtifactChoice({ artifacts, onSelect }: ArtifactChoiceProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<number | null>(null);

  function handleSelect(index: number) {
    if (selected !== null) return;
    setSelected(index);
    setTimeout(() => onSelect(index), 300);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 animate-[fadeIn_0.3s_ease-out]"
      style={{ backdropFilter: 'blur(6px)' }}
    >
      <div className="flex flex-col items-center gap-6 px-4 py-8 w-full max-w-2xl animate-[slideUp_0.4s_ease-out]">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-widest text-amber-400 uppercase">
            {t('asteroids.rl.artifactDrop')}
          </h2>
          <p className="mt-2 text-lg text-zinc-400">
            {t('asteroids.rl.chooseArtifact')}
          </p>
        </div>

        {/* Cards - 2 artifacts */}
        <div className="flex flex-col sm:flex-row gap-5 w-full">
          {artifacts.map((art, i) => {
            const isSelected = selected === i;
            const isOther = selected !== null && selected !== i;

            return (
              <button
                key={art.id}
                onClick={() => handleSelect(i)}
                disabled={selected !== null}
                className={`group relative flex-1 flex flex-col items-center gap-4 rounded-xl border-2 bg-[var(--card)] p-8 transition-all duration-200 cursor-pointer ${isSelected ? 'scale-105 ring-2 ring-amber-400/50 border-amber-500' : isOther ? 'opacity-30 scale-95 border-zinc-700' : 'border-zinc-700 hover:scale-105 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10'}`}
              >
                {/* Icon */}
                <div
                  className="flex items-center justify-center w-16 h-16 rounded-xl text-3xl"
                  style={{ backgroundColor: art.color + '20', border: `2px solid ${art.color}40` }}
                >
                  {art.icon}
                </div>

                {/* Name */}
                <h3 className="text-xl font-bold text-[var(--fg)]">
                  {t(art.nameKey)}
                </h3>

                {/* Description */}
                <p className="text-sm text-[var(--muted)] text-center leading-relaxed">
                  {t(art.descKey)}
                </p>

                {/* Artifact badge */}
                <span
                  className="mt-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
                  style={{ backgroundColor: art.color + '15', color: art.color, border: `1px solid ${art.color}40` }}
                >
                  {t('asteroids.rl.artifact')}
                </span>

                {/* Hover glow */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none"
                  style={{ boxShadow: `inset 0 0 30px ${art.color}10, 0 0 20px ${art.color}08` }}
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
