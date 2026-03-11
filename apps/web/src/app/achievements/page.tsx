'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ACHIEVEMENTS, CATEGORY_ORDER, TIER_XP, TIER_TOKENS } from '@/lib/achievements';
import type { AchievementDefinition, AchievementCategory, AchievementStats, AchievementTier } from '@/lib/achievements';
import { loadStats, loadUnlocked, unlock } from '@/lib/achievements/store';
import { getRecentUnlockIds } from '@/components/ui/AchievementToasts';
import { useI18n } from '@/components/providers/LanguageProvider';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'unlocked' | 'locked';

interface AchievementVM {
  def: AchievementDefinition;
  unlocked: boolean;
  progress: { current: number; target: number } | null;
  pct: number;
  recentlyUnlocked: boolean;
}

// ── Sort helper ───────────────────────────────────────────────────────────────

function sortVMs(items: AchievementVM[]): AchievementVM[] {
  return [...items].sort((a, b) => {
    // 1) Unlocked first
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    // 2) Among locked: higher progress % first
    if (!a.unlocked && !b.unlocked) {
      return b.pct - a.pct;
    }
    return 0; // stable
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AchievementsPage() {
  const { t } = useI18n();

  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [unlockedSet, setUnlockedSet] = useState<Set<string> | null>(null);
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const s = loadStats();
    // Catch-up: persist unlocks for achievements whose conditions are already met
    // (e.g. stats earned before new achievement definitions were added)
    for (const def of ACHIEVEMENTS) {
      if (def.condition(s)) unlock(def.id);
    }
    setStats(s);
    setUnlockedSet(loadUnlocked());
    setRecentIds(getRecentUnlockIds());
  }, []);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterCategory, setFilterCategory] = useState<AchievementCategory | 'all'>('all');

  // Build view models
  const viewModels = useMemo<AchievementVM[]>(() => {
    if (!stats || !unlockedSet) return [];
    return ACHIEVEMENTS.map((def) => {
      const unlocked = unlockedSet.has(def.id);
      const progress = unlocked
        ? (def.getProgress ? { current: def.getProgress(stats).target, target: def.getProgress(stats).target } : null)
        : def.getProgress
          ? def.getProgress(stats)
          : null;
      const pct = progress
        ? progress.target > 0 ? Math.round((progress.current / progress.target) * 100) : 0
        : unlocked ? 100 : 0;
      const recentlyUnlocked = unlocked && recentIds.has(def.id);
      return { def, unlocked, progress, pct, recentlyUnlocked };
    });
  }, [stats, unlockedSet, recentIds]);

  // Apply filters
  const filtered = useMemo(() => {
    return viewModels.filter((vm) => {
      if (filterStatus === 'unlocked' && !vm.unlocked) return false;
      if (filterStatus === 'locked' && vm.unlocked) return false;
      if (filterCategory !== 'all') {
        const tag = vm.def.tags?.[0];
        if (tag !== filterCategory) return false;
      }
      return true;
    });
  }, [viewModels, filterStatus, filterCategory]);

  // Group by category (with sorting within each group)
  const grouped = useMemo(() => {
    const map = new Map<string, AchievementVM[]>();
    for (const vm of filtered) {
      const cat = vm.def.tags?.[0] ?? 'general';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(vm);
    }
    const result: { category: AchievementCategory; items: AchievementVM[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = map.get(cat);
      if (items && items.length > 0) {
        result.push({ category: cat, items: sortVMs(items) });
      }
    }
    return result;
  }, [filtered]);

  // Summary
  const totalCount = ACHIEVEMENTS.length;
  const unlockedCount = viewModels.filter((vm) => vm.unlocked).length;
  const globalPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  // Loading
  if (!stats || !unlockedSet) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-[var(--card)]">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-400 hover:text-zinc-100 transition-colors shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{t('achievements.page.title')}</h1>
              <p className="text-sm text-zinc-500">{t('achievements.page.subtitle')}</p>
            </div>
            {/* Counter */}
            <div className="shrink-0 text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xl">🏆</span>
                <span className="text-2xl font-black text-yellow-400">{unlockedCount}</span>
                <span className="text-lg text-zinc-500 font-medium">/ {totalCount}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{t('achievements.summary')}</p>
            </div>
          </div>

          {/* Global progress bar */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-zinc-700/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-700"
                style={{ width: `${globalPct}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400 font-medium shrink-0 w-10 text-right">{globalPct}%</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
            {(['all', 'unlocked', 'locked'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  filterStatus === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t(`achievements.filter.${f}`)}
              </button>
            ))}
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as AchievementCategory | 'all')}
            className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-indigo-500"
          >
            <option value="all">{t('achievements.filter.all')}</option>
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {t(`achievements.category.${cat}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Empty state */}
        {grouped.length === 0 && (
          <p className="text-center text-zinc-500 py-12">{t('achievements.empty')}</p>
        )}

        {/* Achievement groups */}
        {grouped.map(({ category, items }) => (
          <section key={category} className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              {t(`achievements.category.${category}`)}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((vm) => (
                <AchievementCard key={vm.def.id} vm={vm} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <style>{`
        @keyframes ach-recent-glow {
          0%   { box-shadow: 0 0 0 0 rgba(234,179,8,0.4); }
          50%  { box-shadow: 0 0 16px 4px rgba(234,179,8,0.25); }
          100% { box-shadow: 0 0 0 0 rgba(234,179,8,0); }
        }
      `}</style>
    </div>
  );
}

// ── Tier styling ──────────────────────────────────────────────────────────────

const TIER_COLORS: Record<AchievementTier, string> = {
  easy:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  medium: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  hard:   'text-orange-400 bg-orange-500/10 border-orange-500/20',
  epic:   'text-purple-400 bg-purple-500/10 border-purple-500/20',
};

// ── Achievement Card ──────────────────────────────────────────────────────────

function AchievementCard({ vm }: { vm: AchievementVM }) {
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);

  // Recently-unlocked glow animation (fires once)
  useEffect(() => {
    if (!vm.recentlyUnlocked || !cardRef.current) return;
    cardRef.current.style.animation = 'ach-recent-glow 1.2s ease-out';
    const el = cardRef.current;
    const handler = () => { el.style.animation = ''; };
    el.addEventListener('animationend', handler, { once: true });
    return () => el.removeEventListener('animationend', handler);
  }, [vm.recentlyUnlocked]);

  const icon = vm.def.icon;
  const name = t(vm.def.nameKey);
  const desc = t(vm.def.descKey);
  const tier = vm.def.tier;
  const xpReward = TIER_XP[tier];
  const tokenReward = TIER_TOKENS[tier];

  return (
    <div
      ref={cardRef}
      className={`rounded-xl border p-4 transition-all duration-200 cursor-default ${
        vm.unlocked
          ? 'border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50 hover:scale-[1.015] hover:shadow-[0_0_12px_rgba(234,179,8,0.08)]'
          : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600/70 hover:scale-[1.015] hover:bg-zinc-800/50'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`text-2xl shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${
            vm.unlocked ? 'bg-yellow-500/10' : 'bg-zinc-700/30 grayscale opacity-60'
          }`}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold truncate ${vm.unlocked ? 'text-yellow-400' : 'text-zinc-300'}`}>
              {name}
            </p>
            {vm.unlocked && (
              <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>

          {/* Tier + Reward badges */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded-md px-2 py-0.5 border ${TIER_COLORS[tier]}`}>
              {t(`achievements.tier.${tier}`)}
            </span>
            {xpReward > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-400/80 bg-amber-500/10 rounded-md px-2 py-0.5">
                +{xpReward} XP
              </span>
            )}
            {tokenReward > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-purple-400/80 bg-purple-500/10 rounded-md px-2 py-0.5">
                +{tokenReward} Token
              </span>
            )}
          </div>

          {/* Unlocked badge */}
          {vm.unlocked && (
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-yellow-500/80 bg-yellow-500/10 rounded-md px-2 py-0.5">
                {t('achievements.unlocked')}
              </span>
            </div>
          )}

          {/* Progress bar (locked only) */}
          {!vm.unlocked && vm.progress && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-zinc-500">
                  {vm.progress.current} / {vm.progress.target}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-700/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${vm.pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
