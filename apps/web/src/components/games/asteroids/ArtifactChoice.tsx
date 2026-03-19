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
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: '#f59e0b' }}>
            /// ARTIFACT DETECTED ///
          </div>
          <h2 className="text-2xl font-black tracking-[0.2em] uppercase" style={{ color: '#f59e0b', textShadow: '0 0 20px rgba(245,158,11,0.3)' }}>
            {t('asteroids.rl.artifactDrop')}
          </h2>
          <p className="mt-2 text-sm" style={{ color: '#5a6a7f' }}>
            {t('asteroids.rl.chooseArtifact')}
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-col sm:flex-row gap-5 w-full">
          {artifacts.map((art, i) => {
            const isSelected = selected === i;
            const isOther = selected !== null && selected !== i;

            return (
              <button
                key={art.id}
                onClick={() => handleSelect(i)}
                disabled={selected !== null}
                className={`group relative flex-1 flex flex-col items-center gap-4 p-8 transition-all duration-200 cursor-pointer ${isSelected ? 'scale-105' : isOther ? 'opacity-25 scale-95' : 'hover:scale-105'}`}
                style={{
                  background: '#141922',
                  border: isSelected ? `2px solid ${art.color}` : '2px solid #1e2a3a',
                  clipPath: 'polygon(16px 0, 100% 0, calc(100% - 16px) 100%, 0 100%)',
                  boxShadow: isSelected ? `0 0 40px ${art.color}30, inset 0 0 30px ${art.color}10` : 'none',
                }}
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-4 right-4 h-px" style={{ background: `linear-gradient(90deg, transparent, ${art.color}, transparent)` }} />

                {/* Icon */}
                <div
                  className="flex items-center justify-center w-16 h-16 text-3xl"
                  style={{
                    backgroundColor: art.color + '15',
                    border: `1px solid ${art.color}30`,
                    clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
                  }}
                >
                  {art.icon}
                </div>

                {/* Name */}
                <h3 className="text-lg font-black uppercase tracking-wider" style={{ color: '#c8d6e5' }}>
                  {t(art.nameKey)}
                </h3>

                {/* Description */}
                <p className="text-xs text-center leading-relaxed" style={{ color: '#5a6a7f' }}>
                  {t(art.descKey)}
                </p>

                {/* Artifact badge */}
                <span
                  className="mt-auto inline-flex items-center gap-1 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{
                    backgroundColor: art.color + '12',
                    color: art.color,
                    border: `1px solid ${art.color}30`,
                    clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
                  }}
                >
                  {t('asteroids.rl.artifact')}
                </span>

                {/* Hover glow */}
                <div
                  className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none"
                  style={{ boxShadow: `inset 0 0 40px ${art.color}08, 0 0 20px ${art.color}06` }}
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
