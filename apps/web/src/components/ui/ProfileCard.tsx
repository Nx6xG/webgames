'use client';

import type { CosmeticsSelection } from 'shared';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { getNameColorClass } from '@/lib/nameColors';
import { getCosmeticDef, type CosmeticRarity } from '@/lib/cosmetics';
import { BadgeIcon } from '@/components/ui/BadgeIcon';
import { useI18n } from '@/components/providers/LanguageProvider';

export interface ProfileCardProps {
  nickname: string;
  cosmetics: CosmeticsSelection;
  stats?: { plays: number; wins: number; achievements: string };
  compact?: boolean;
}

/** Card border styling based on frame — legendary frames get animated glow */
const FRAME_CARD_BORDER: Record<string, string> = {
  diamond:  'wg-card-border-diamond',
  fire:     'wg-card-border-fire',
  obsidian: 'wg-card-border-obsidian',
  gold:     'wg-card-border-gold',
  silver:   'wg-card-border-silver',
  bronze:   'wg-card-border-bronze',
};

/** Rarity-based title styling */
const TITLE_STYLE: Record<CosmeticRarity, string> = {
  common:    'text-zinc-500',
  epic:      'text-emerald-400/90',
  rare:      'text-blue-400/90',
  legendary: 'text-amber-400 wg-title-legendary',
};

export function ProfileCard({ nickname, cosmetics, stats, compact }: ProfileCardProps) {
  const { t } = useI18n();
  const banner = cosmetics.slots?.banner;
  const bannerClass = `wg-banner-${banner || 'default'}`;
  const cardColorId = cosmetics.slots?.cardColor;
  const cardColorDef = cardColorId ? getCosmeticDef(cardColorId, 'cardColor') : undefined;
  const cardBgClass = cardColorDef ? `wg-card-${cardColorId?.replace('card-', '')}` : 'wg-card-default';
  const badges = cosmetics.badges?.slice(0, 3) ?? [];
  const frameId = cosmetics.slots?.frame;
  const cardBorderClass = frameId ? FRAME_CARD_BORDER[frameId] ?? '' : '';

  // Title
  const titleId = cosmetics.slots?.title;
  const titleDef = titleId ? getCosmeticDef(titleId, 'title') : undefined;
  const titleStyle = titleDef ? (TITLE_STYLE[titleDef.rarity] ?? 'text-zinc-500') : '';

  if (compact) {
    return (
      <div className={`w-full overflow-hidden rounded-xl border border-zinc-700/50 ${cardBorderClass}`}>
        <div className={`${bannerClass} h-10 relative`}>
          <div className="absolute inset-0 wg-banner-noise" />
        </div>
        <div className={`${cardBgClass} px-3 pb-2.5 relative`}>
          <div className="-mt-4 mb-1">
            <span className="inline-block ring-[3px] ring-zinc-900 rounded-full">
              <AvatarBubble nickname={nickname} cosmetics={cosmetics} size="md" />
            </span>
          </div>
          <p className={`text-sm font-bold truncate ${getNameColorClass(cosmetics.nameColor) || 'text-zinc-100'}`}>
            {nickname}
          </p>
          {titleDef && (
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${titleStyle} truncate`}>
              {t(titleDef.labelKey)}
            </p>
          )}
          {badges.length > 0 && (
            <div className="flex gap-1 mt-1">
              {badges.map((badgeId) => (
                <BadgeIcon key={badgeId} badgeId={badgeId} size="sm" />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden rounded-2xl ${cardBorderClass || 'border border-zinc-700/40'}`}>
      {/* Banner — tall, with noise texture overlay and bottom fade */}
      <div className={`${bannerClass} h-[88px] relative`}>
        <div className="absolute inset-0 wg-banner-noise" />
        {/* Bottom gradient fade into card body */}
        <div
          className="absolute inset-x-0 bottom-0 h-8 pointer-events-none"
          style={{ background: 'linear-gradient(to top, var(--wg-card-bg, #0f1117), transparent)' }}
        />
      </div>

      {/* Card body */}
      <div
        className={`${cardBgClass} px-4 pb-4 relative wg-card-body`}
      >
        {/* Avatar — centered, overlapping banner */}
        <div className="flex justify-center -mt-8 mb-2">
          <span className="inline-block ring-4 ring-zinc-900 rounded-full">
            <AvatarBubble nickname={nickname} cosmetics={cosmetics} size="xl" />
          </span>
        </div>

        {/* Name — centered */}
        <p className={`text-base font-bold truncate text-center ${getNameColorClass(cosmetics.nameColor) || 'text-zinc-100'}`}>
          {nickname}
        </p>

        {/* Title — centered, with rarity styling */}
        {titleDef && (
          <p className={`text-[11px] font-semibold uppercase tracking-widest text-center mt-0.5 ${titleStyle}`}>
            {t(titleDef.labelKey)}
          </p>
        )}

        {/* Divider */}
        {(badges.length > 0 || stats) && (
          <div className="h-px bg-zinc-800 my-2.5 mx-4" />
        )}

        {/* Badges row — centered, small prestige icons */}
        {badges.length > 0 && (
          <div className="flex justify-center gap-1">
            {badges.map((badgeId) => (
              <BadgeIcon key={badgeId} badgeId={badgeId} size="sm" />
            ))}
          </div>
        )}

        {/* Stats line */}
        {stats && (
          <div className="flex justify-center items-center gap-2 mt-2 text-[10px] text-zinc-500">
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
