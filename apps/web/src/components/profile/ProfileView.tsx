'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import { MULTIPLAYER_GAME_IDS, SINGLEPLAYER_GAME_IDS } from '@/lib/localStats';
import { ProfileHero } from './ProfileHero';
import { ProfileOverviewCards } from './ProfileOverviewCards';
import { ProfileAchievementsSummary } from './ProfileAchievementsSummary';
import { ProfileGameStats } from './ProfileGameStats';
import { ProfileShowcase } from './ProfileShowcase';
import { ProgressionTrack } from './ProgressionTrack';
import type { ProfileData } from './types';

interface Props {
  profile: ProfileData;
  /** Slot for sidebar content (e.g. UserSettingsPanel on own profile) */
  sidebar?: React.ReactNode;
}

export function ProfileView({ profile, sidebar }: Props) {
  const { t } = useI18n();

  const mpGames = profile.perGame.filter((g) =>
    (MULTIPLAYER_GAME_IDS as readonly string[]).includes(g.gameId),
  );
  const spGames = profile.perGame.filter((g) =>
    (SINGLEPLAYER_GAME_IDS as readonly string[]).includes(g.gameId),
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <ProfileHero profile={profile} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className={`grid grid-cols-1 ${sidebar ? 'lg:grid-cols-[1fr_340px]' : ''} gap-6`}>
          {/* Main column */}
          <div className="space-y-6 min-w-0">
            {/* Overview */}
            <section>
              <SectionHeader text={t('profilePage.overview')} />
              <ProfileOverviewCards profile={profile} />
            </section>

            {/* Progression Track (own profile only) */}
            {profile.isOwnProfile && (
              <section>
                <ProgressionTrack />
              </section>
            )}

            {/* Achievements */}
            <section>
              <SectionHeader text={t('profilePage.achievements')} />
              <ProfileAchievementsSummary profile={profile} />
            </section>

            {/* Per-game multiplayer */}
            <ProfileGameStats title={t('leaderboards.multiplayer')} games={mpGames} />

            {/* Per-game singleplayer */}
            <ProfileGameStats title={t('leaderboards.singleplayer')} games={spGames} />

            {/* No data fallback */}
            {profile.totalPlayed === 0 && (
              <p className="text-center text-zinc-500 py-12">{t('profilePage.noData')}</p>
            )}
          </div>

          {/* Sidebar */}
          {sidebar && (
            <div className="space-y-6">
              {sidebar}

              {/* Cosmetics Showcase */}
              <section>
                <SectionHeader text={t('profilePage.showcase')} />
                <ProfileShowcase cosmetics={profile.cosmetics} />
              </section>
            </div>
          )}

          {/* Showcase when no sidebar */}
          {!sidebar && (
            <section className="lg:col-span-1">
              <SectionHeader text={t('profilePage.showcase')} />
              <ProfileShowcase cosmetics={profile.cosmetics} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ text }: { text: string }) {
  return (
    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
      {text}
    </h2>
  );
}
