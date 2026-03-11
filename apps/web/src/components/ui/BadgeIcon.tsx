'use client';

import { getCosmeticDef, RARITY_COLORS, type CosmeticDef, type CosmeticRarity } from '@/lib/cosmetics';
import { useI18n } from '@/components/providers/LanguageProvider';
import { Tooltip } from './Tooltip';

interface BadgeIconProps {
  badgeId: string;
  /** Show lock overlay + unlock requirement in tooltip */
  locked?: boolean;
  size?: 'xs' | 'sm' | 'md';
  /** Show rarity label in tooltip (default true) */
  showRarity?: boolean;
}

/** Rarity-tinted border color for badges */
const BADGE_BORDER: Record<CosmeticRarity, string> = {
  common:    'border-zinc-600/40',
  epic:      'border-emerald-500/30',
  rare:      'border-blue-500/30',
  legendary: 'border-amber-500/40',
};

/** Rarity glow for badge hover */
const BADGE_GLOW: Record<CosmeticRarity, string> = {
  common:    '',
  epic:      'hover:shadow-[0_0_6px_rgba(52,211,153,0.2)]',
  rare:      'hover:shadow-[0_0_6px_rgba(59,130,246,0.2)]',
  legendary: 'hover:shadow-[0_0_8px_rgba(251,191,36,0.25)]',
};

function BadgeTooltipContent({ def, locked, showRarity }: { def: CosmeticDef; locked?: boolean; showRarity?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold text-zinc-100 leading-tight">
        {def.emoji} {t(def.labelKey)}
      </p>
      {def.descriptionKey && (
        <p className="text-[10px] text-zinc-400 leading-snug">{t(def.descriptionKey)}</p>
      )}
      {showRarity !== false && (
        <span className={`inline-block text-[9px] font-semibold uppercase tracking-wider ${RARITY_COLORS[def.rarity]}`}>
          {t(`cosmetics.rarity.${def.rarity}`)}
        </span>
      )}
    </div>
  );
}

/**
 * Renders a single badge as a small prestige icon with tooltip.
 * Designed to be compact — just the emoji in a tiny circle.
 */
export function BadgeIcon({ badgeId, locked, size = 'sm', showRarity }: BadgeIconProps) {
  const def = getCosmeticDef(badgeId, 'badge');
  if (!def) return null;

  const sizeClasses =
    size === 'md'  ? 'w-6 h-6 text-xs'  :
    size === 'sm'  ? 'w-5 h-5 text-[10px]' :
                     'w-4 h-4 text-[9px]';

  return (
    <Tooltip content={<BadgeTooltipContent def={def} locked={locked} showRarity={showRarity} />}>
      <span
        className={`inline-flex items-center justify-center ${sizeClasses} rounded-full border bg-zinc-900/80 ${BADGE_BORDER[def.rarity]} ${BADGE_GLOW[def.rarity]} ${locked ? 'opacity-30 grayscale' : ''} transition-shadow`}
      >
        <span className="leading-none">{def.emoji}</span>
      </span>
    </Tooltip>
  );
}
