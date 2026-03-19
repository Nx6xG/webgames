'use client';

import { useI18n } from '@/components/providers/LanguageProvider';

interface RunStatsScreenProps {
  stats: {
    wavesCleared: number;
    asteroidsDestroyed: number;
    eliteAsteroidsDestroyed: number;
    bossesKilled: number;
    buffsChosen: number;
    artifactsCollected: number;
    damageTaken: number;
    scrapEarned: number;
    timePlayed: number;
  };
  wave: number;
  score: number;
  onContinue: () => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function RunStatsScreen({ stats, wave, score, onContinue }: RunStatsScreenProps) {
  const { t } = useI18n();

  const rows: Array<{ icon: string; label: string; value: string | number; color?: string }> = [
    { icon: '\u{1F30A}', label: t('asteroids.rl.stats.waves'), value: stats.wavesCleared },
    { icon: '\u2B50', label: t('asteroids.rl.stats.score'), value: score.toLocaleString(), color: '#0ff0fc' },
    { icon: '\u2604\uFE0F', label: t('asteroids.rl.stats.asteroids'), value: stats.asteroidsDestroyed },
    { icon: '\u{1F4A0}', label: t('asteroids.rl.stats.elites'), value: stats.eliteAsteroidsDestroyed, color: '#a78bfa' },
    { icon: '\u{1F47E}', label: t('asteroids.rl.stats.bosses'), value: stats.bossesKilled, color: '#ef4444' },
    { icon: '\u26A1', label: t('asteroids.rl.stats.buffs'), value: stats.buffsChosen },
    { icon: '\u{1F48E}', label: t('asteroids.rl.stats.artifacts'), value: stats.artifactsCollected, color: '#f59e0b' },
    { icon: '\u{1F4A5}', label: t('asteroids.rl.stats.damage'), value: stats.damageTaken, color: '#ef4444' },
    { icon: '\u{1F4B0}', label: t('asteroids.rl.stats.scrap'), value: stats.scrapEarned.toLocaleString(), color: '#f59e0b' },
    { icon: '\u23F1\uFE0F', label: t('asteroids.rl.stats.time'), value: formatTime(stats.timePlayed) },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 animate-[fadeIn_0.3s_ease-out]"
      style={{ backdropFilter: 'blur(6px)' }}
    >
      <div className="flex flex-col items-center gap-5 px-4 py-6 w-full max-w-md animate-[slideUp_0.4s_ease-out]">
        {/* Header */}
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: '#5a6a7f' }}>
            /// MISSION DEBRIEF ///
          </div>
          <h2 className="text-2xl font-black tracking-[0.2em] uppercase" style={{ color: '#ef4444', textShadow: '0 0 20px rgba(239,68,68,0.3)' }}>
            {t('asteroids.rl.runEnd')}
          </h2>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider" style={{ color: '#5a6a7f' }}>
            {t('asteroids.rl.stats.wave')} {wave}
          </p>
        </div>

        {/* Stats panel */}
        <div
          className="w-full overflow-hidden"
          style={{
            background: '#141922',
            border: '1px solid #1e2a3a',
            clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
          }}
        >
          {rows.map((row, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-4 py-2.5 ${i < rows.length - 1 ? 'border-b' : ''}`}
              style={{ borderColor: '#1e2a3a' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{row.icon}</span>
                <span className="text-xs font-medium" style={{ color: '#5a6a7f' }}>{row.label}</span>
              </div>
              <span
                className="text-sm font-black tabular-nums"
                style={{ color: row.color ?? '#c8d6e5' }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Continue button */}
        <button
          onClick={onContinue}
          className="px-8 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition-all cursor-pointer hover:brightness-110"
          style={{
            background: 'rgba(15,240,252,0.08)',
            border: '1px solid rgba(6,182,212,0.3)',
            color: '#0ff0fc',
            clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
          }}
        >
          {t('asteroids.rl.continue')}
        </button>
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
