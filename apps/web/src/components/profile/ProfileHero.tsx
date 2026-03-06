'use client';

import Link from 'next/link';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { BadgeIcon } from '@/components/ui/BadgeIcon';
import { getNameColorClass } from '@/lib/nameColors';
import { getCosmeticDef } from '@/lib/cosmetics';
import { useI18n } from '@/components/providers/LanguageProvider';
import type { ProfileData } from './types';

interface Props {
  profile: ProfileData;
  /** Extra element to render in the top-right of the card (e.g. settings gear) */
  actions?: React.ReactNode;
}

export function ProfileHero({ profile, actions }: Props) {
  const { t } = useI18n();
  const { cosmetics, nickname, badges, totalPlayed, totalWins, totalWinrate, isOwnProfile, isLocalOnly } = profile;

  const banner = cosmetics.slots?.banner;
  const bannerClass = `wg-banner-${banner || 'default'}`;
  const cardColorId = cosmetics.slots?.cardColor;
  const cardColorDef = cardColorId ? getCosmeticDef(cardColorId, 'cardColor') : undefined;
  const cardBgClass = cardColorDef ? `wg-card-${cardColorId?.replace('card-', '')}` : 'wg-card-default';

  return (
    <div className="relative">
      {/* Banner */}
      <div className={`${bannerClass} h-32 sm:h-44`} />

      {/* Back button */}
      <Link
        href="/"
        className="absolute top-4 left-4 text-white/70 hover:text-white bg-black/30 rounded-lg p-2 transition-colors backdrop-blur-sm"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      {/* Card body over banner */}
      <div className="max-w-4xl mx-auto px-4">
        <div className={`${cardBgClass} -mt-12 rounded-xl border border-zinc-700/50 px-5 sm:px-6 pb-5 pt-0 relative`}>
          {/* Avatar */}
          <div className="-mt-10 mb-2">
            <span className="inline-block ring-4 ring-zinc-900 rounded-full">
              <AvatarBubble nickname={nickname} cosmetics={cosmetics} size="lg" />
            </span>
          </div>

          {/* Name row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className={`text-xl sm:text-2xl font-bold truncate ${getNameColorClass(cosmetics.nameColor) || 'text-zinc-100'}`}>
                {nickname}
              </h1>
              {badges.length > 0 && (
                <div className="flex gap-1.5 mt-1.5">
                  {badges.map((badgeId) => (
                    <BadgeIcon key={badgeId} badgeId={badgeId} size="md" />
                  ))}
                </div>
              )}
              {isOwnProfile && isLocalOnly && (
                <p className="text-[10px] text-zinc-600 mt-1">{t('pub.localOnly')}</p>
              )}
            </div>

            {/* Meta stats + actions */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span><strong className="text-zinc-300 font-semibold">{totalPlayed}</strong> {t('profilePage.plays')}</span>
                <span><strong className="text-zinc-300 font-semibold">{totalWins}</strong> {t('profilePage.wins')}</span>
                <span><strong className="text-zinc-300 font-semibold">{totalWinrate}%</strong> {t('profilePage.winRate')}</span>
              </div>
              {actions}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
