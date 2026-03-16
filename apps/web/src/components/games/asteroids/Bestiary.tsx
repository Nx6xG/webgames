'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import type { BestiaryEntry } from './roguelite-types';
import { ASTEROID_VARIANT_CONFIG, BOSS_VARIANT_CONFIG, ELITE_MODIFIER_CONFIG } from './roguelite-data';

interface BestiaryProps {
  entries: Record<string, BestiaryEntry>;
  onClose: () => void;
}

const ALL_ENTRIES: Array<{ key: string; category: 'asteroids' | 'bosses' | 'elites'; label: string; icon: string; color: string }> = [
  ...Object.keys(ASTEROID_VARIANT_CONFIG).map((k) => ({ key: `asteroid_${k}`, category: 'asteroids' as const, label: k.charAt(0).toUpperCase() + k.slice(1), icon: '☄️', color: ASTEROID_VARIANT_CONFIG[k as keyof typeof ASTEROID_VARIANT_CONFIG].color })),
  ...Object.keys(BOSS_VARIANT_CONFIG).map((k) => ({ key: `boss_${k}`, category: 'bosses' as const, label: k.charAt(0).toUpperCase() + k.slice(1), icon: '👾', color: '#ef4444' })),
  ...Object.keys(ELITE_MODIFIER_CONFIG).map((k) => ({ key: `elite_${k}`, category: 'elites' as const, label: k.charAt(0).toUpperCase() + k.slice(1), icon: '⚡', color: ELITE_MODIFIER_CONFIG[k as keyof typeof ELITE_MODIFIER_CONFIG].color })),
  { key: 'megaboss', category: 'bosses', label: 'Mega-Boss', icon: '👑', color: '#f59e0b' },
];

export default function Bestiary({ entries, onClose }: BestiaryProps) {
  const { t } = useI18n();
  const categories = ['asteroids', 'bosses', 'elites'] as const;
  const catLabels = { asteroids: t('asteroids.rl.bestiary.asteroids'), bosses: t('asteroids.rl.bestiary.bosses'), elites: t('asteroids.rl.bestiary.elites') };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]/95 animate-[fadeIn_0.25s_ease-out]" style={{ backdropFilter: 'blur(6px)' }}>
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <h1 className="text-2xl font-black tracking-widest text-[var(--fg)] uppercase">{t('asteroids.rl.bestiary')}</h1>
        <button onClick={onClose} className="flex items-center justify-center w-10 h-10 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)] transition-colors text-xl font-bold cursor-pointer">X</button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {categories.map((cat) => {
            const items = ALL_ENTRIES.filter((e) => e.category === cat);
            return (
              <div key={cat}>
                <h2 className="text-lg font-bold text-[var(--fg)] mb-3">{catLabels[cat]}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {items.map((item) => {
                    const entry = entries[item.key];
                    const seen = entry?.seen ?? false;
                    return (
                      <div key={item.key} className={`rounded-xl border p-4 transition-all ${seen ? 'border-[var(--border)] bg-[var(--card)]' : 'border-zinc-800 bg-zinc-900/50 opacity-40'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{seen ? item.icon : '❓'}</span>
                          <span className="font-bold text-sm" style={{ color: seen ? item.color : '#71717a' }}>{seen ? item.label : '???'}</span>
                        </div>
                        {seen && entry ? (
                          <div className="text-xs text-[var(--muted)] space-y-0.5">
                            <div>{t('asteroids.rl.bestiary.encounters')}: <span className="text-[var(--fg)] font-semibold">{entry.count}</span></div>
                            {entry.firstWave && <div>{t('asteroids.rl.bestiary.firstWave')} <span className="text-[var(--fg)] font-semibold">{entry.firstWave}</span></div>}
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-600">{t('asteroids.rl.bestiary.notSeen')}</div>
                        )}
                      </div>
                    );
                  })}
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
