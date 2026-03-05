'use client';

import type { CosmeticsSelection } from 'shared';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { getNameColorClass } from '@/lib/nameColors';
import { getCosmeticDef } from '@/lib/cosmetics';
import { BadgeIcon } from '@/components/ui/BadgeIcon';

export interface ProfileCardProps {
  nickname: string;
  cosmetics: CosmeticsSelection;
  stats?: { plays: number; wins: number; achievements: string };
  compact?: boolean;
}

export function ProfileCard({ nickname, cosmetics, stats, compact }: ProfileCardProps) {
  const banner = cosmetics.slots?.banner;
  const bannerClass = `wg-banner-${banner || 'default'}`;
  const cardColorId = cosmetics.slots?.cardColor;
  const cardColorDef = cardColorId ? getCosmeticDef(cardColorId, 'cardColor') : undefined;
  const cardBgClass = cardColorDef ? `wg-card-${cardColorId?.replace('card-', '')}` : 'wg-card-default';
  const badges = cosmetics.badges?.slice(0, 3) ?? [];

  return (
    <div className="w-full overflow-hidden rounded-xl border border-zinc-700/50">
      {/* Banner */}
      <div
        className={`${bannerClass} ${compact ? 'h-10' : 'h-[60px]'} relative`}
      />

      {/* Avatar + Info */}
      <div className={`${cardBgClass} px-3 pb-2.5 relative`}>
        {/* Avatar overlapping the banner */}
        <div className={`${compact ? '-mt-4' : '-mt-5'} mb-1`}>
          <span className="inline-block ring-[3px] ring-zinc-900 rounded-full">
            <AvatarBubble
              nickname={nickname}
              cosmetics={cosmetics}
              size={compact ? 'md' : 'lg'}
            />
          </span>
        </div>

        {/* Name */}
        <p className={`text-sm font-bold truncate ${getNameColorClass(cosmetics.nameColor) || 'text-zinc-100'}`}>
          {nickname}
        </p>

        {/* Badges row */}
        {badges.length > 0 && (
          <div className="flex gap-1 mt-1">
            {badges.map((badgeId) => (
              <BadgeIcon key={badgeId} badgeId={badgeId} size="sm" />
            ))}
          </div>
        )}

        {/* Stats line */}
        {stats && !compact && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-zinc-500">
            <span>{stats.plays} Spiele</span>
            <span className="text-zinc-700">&middot;</span>
            <span>{stats.wins} Siege</span>
            <span className="text-zinc-700">&middot;</span>
            <span>{stats.achievements}</span>
          </div>
        )}
      </div>
    </div>
  );
}
