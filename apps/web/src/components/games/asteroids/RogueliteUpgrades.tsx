'use client';

import { useI18n } from '@/components/providers/LanguageProvider';

interface RogueliteUpgradesProps {
  scrap: number;
  upgrades: Partial<Record<string, number>>;
  upgradeList: Array<{
    id: string;
    nameKey: string;
    descKey: string;
    icon: string;
    maxTier: number;
    costs: number[];
  }>;
  ascensionLevel: number;
  onBuy: (id: string) => void;
  onAscend: () => void;
  onClose: () => void;
}

export default function RogueliteUpgrades({
  scrap,
  upgrades,
  upgradeList,
  ascensionLevel,
  onBuy,
  onAscend,
  onClose,
}: RogueliteUpgradesProps) {
  const { t } = useI18n();

  const totalTiers = upgradeList.reduce((sum, u) => sum + u.maxTier, 0);
  const ownedTiers = upgradeList.reduce((sum, u) => sum + (upgrades[u.id] ?? 0), 0);
  const pct = totalTiers > 0 ? Math.round((ownedTiers / totalTiers) * 100) : 0;
  const allMaxed = upgradeList.every((u) => (upgrades[u.id] ?? 0) >= u.maxTier);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]/95 animate-[fadeIn_0.25s_ease-out]"
      style={{ backdropFilter: 'blur(6px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black tracking-widest text-[var(--fg)] uppercase">
            {t('asteroids.rl.upgrades')}
          </h1>
          <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5">
            <span className="text-sm font-bold text-yellow-400">[S]</span>
            <span className="text-lg font-bold text-yellow-300 tabular-nums">
              {scrap.toLocaleString()}
            </span>
          </div>
          {ascensionLevel > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1">
              <span className="text-sm">⭐</span>
              <span className="text-sm font-bold text-amber-400">{ascensionLevel}</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)] transition-colors text-xl font-bold cursor-pointer"
        >
          X
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-6 pt-5 pb-1">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              {t('asteroids.rl.progress')}
            </span>
            <span className="text-xs font-bold text-yellow-400 tabular-nums">
              {ownedTiers}/{totalTiers} ({pct}%)
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-zinc-800 border border-zinc-700/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Ascension panel */}
      {allMaxed && (
        <div className="px-6 pt-3">
          <div className="max-w-4xl mx-auto rounded-xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                  <span>⭐</span> {t('asteroids.rl.ascend')}
                </h3>
                <p className="text-sm text-zinc-400 mt-1">{t('asteroids.rl.ascend.confirm')}</p>
                <p className="text-xs text-amber-500/80 mt-1 font-semibold">{t('asteroids.rl.ascend.bonus')}</p>
              </div>
              <button
                onClick={onAscend}
                className="ml-4 px-6 py-3 rounded-lg bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-bold text-sm transition-all cursor-pointer active:scale-95"
              >
                {t('asteroids.rl.ascend')} → {ascensionLevel + 1}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {upgradeList.map((upg) => {
            const currentTier = upgrades[upg.id] ?? 0;
            const isMaxed = currentTier >= upg.maxTier;
            const nextCost = isMaxed ? 0 : upg.costs[currentTier] ?? 0;
            const canAfford = scrap >= nextCost;

            return (
              <div
                key={upg.id}
                className={`relative flex flex-col gap-3 rounded-xl border p-5 bg-[var(--card)] transition-all duration-200 ${isMaxed ? 'border-yellow-500/50 shadow-sm shadow-yellow-500/10' : 'border-[var(--border)]'}`}
              >
                {/* Top row: icon + name + tier pips */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center justify-center w-11 h-11 rounded-lg text-lg font-bold ${isMaxed ? 'bg-yellow-500/15 text-yellow-400' : 'bg-zinc-700/60 text-zinc-300'}`}
                  >
                    {upg.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-[var(--fg)] truncate">
                      {t(upg.nameKey)}
                    </h3>

                    {/* Tier pips */}
                    <div className="flex items-center gap-1.5 mt-1">
                      {Array.from({ length: upg.maxTier }, (_, tierIdx) => {
                        const filled = tierIdx < currentTier;
                        const isNext = tierIdx === currentTier && !isMaxed;
                        return (
                          <div
                            key={tierIdx}
                            className={`w-3 h-3 rounded-full border transition-all duration-300 ${filled ? 'bg-yellow-400 border-yellow-500 shadow-sm shadow-yellow-400/40' : isNext ? 'bg-transparent border-yellow-500/60' : 'bg-transparent border-zinc-600'}`}
                          />
                        );
                      })}
                      {isMaxed && (
                        <span className="ml-1.5 text-xs font-semibold text-yellow-400 uppercase">
                          MAX
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  {t(upg.descKey)}
                </p>

                {/* Tier info */}
                <div className="text-xs text-zinc-500">
                  {t('asteroids.rl.tier')} {currentTier}/{upg.maxTier}
                </div>

                {/* Buy button */}
                {!isMaxed && (
                  <button
                    onClick={() => onBuy(upg.id)}
                    disabled={!canAfford}
                    className={`mt-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 cursor-pointer ${canAfford ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/25 hover:border-yellow-500/60 active:scale-[0.97]' : 'bg-zinc-800/50 text-zinc-600 border border-zinc-700/50 cursor-not-allowed'}`}
                  >
                    <span className="text-xs font-bold">[S]</span>
                    <span className="tabular-nums">{nextCost.toLocaleString()}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
