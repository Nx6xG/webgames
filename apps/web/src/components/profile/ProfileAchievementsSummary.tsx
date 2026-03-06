'use client';

import Link from 'next/link';
import { useI18n } from '@/components/providers/LanguageProvider';
import type { ProfileData } from './types';

interface Props {
  profile: ProfileData;
}

export function ProfileAchievementsSummary({ profile }: Props) {
  const { t } = useI18n();
  const { achievementsUnlocked, achievementsTotal } = profile;
  const pct = achievementsTotal > 0
    ? Math.round((achievementsUnlocked / achievementsTotal) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">🏆</span>
        <span className="text-3xl font-black text-yellow-400">{achievementsUnlocked}</span>
        <span className="text-lg text-zinc-500 font-medium">/ {achievementsTotal}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-zinc-700/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-yellow-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-zinc-400 font-medium shrink-0 w-10 text-right">{pct}%</span>
      </div>
      {profile.isOwnProfile && (
        <Link
          href="/achievements"
          className="mt-3 inline-block text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {t('nav.achievements')} →
        </Link>
      )}
    </div>
  );
}
