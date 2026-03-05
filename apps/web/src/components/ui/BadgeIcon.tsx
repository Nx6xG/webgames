'use client';

import { getCosmeticDef, RARITY_COLORS, type CosmeticDef } from '@/lib/cosmetics';
import { useI18n } from '@/components/providers/LanguageProvider';
import { Tooltip } from './Tooltip';

interface BadgeIconProps {
  badgeId: string;
  /** Show lock overlay + unlock requirement in tooltip */
  locked?: boolean;
  size?: 'sm' | 'md';
  /** Show rarity label in tooltip (default true) */
  showRarity?: boolean;
}

function BadgeTooltipContent({ def, locked, showRarity }: { def: CosmeticDef; locked?: boolean; showRarity?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      {/* Title */}
      <p className="text-[11px] font-bold text-zinc-100 leading-tight">
        {def.emoji} {t(def.labelKey)}
      </p>

      {/* Description */}
      {def.descriptionKey && (
        <p className="text-[10px] text-zinc-400 leading-snug">{t(def.descriptionKey)}</p>
      )}

      {/* Unlock hint (when locked or always for achievement-gated badges) */}
      {def.unlockHintKey && (locked || def.requiredAchievement) && (
        <p className="text-[10px] text-zinc-500 leading-snug">
          {locked ? '🔒 ' : '✓ '}{t(def.unlockHintKey)}
        </p>
      )}

      {/* Rarity */}
      {showRarity !== false && (
        <span className={`inline-block text-[9px] font-semibold uppercase tracking-wider ${RARITY_COLORS[def.rarity]}`}>
          {t(`cosmetics.rarity.${def.rarity}`)}
        </span>
      )}
    </div>
  );
}

/**
 * Renders a single badge with a rich tooltip.
 * Drop-in replacement for raw badge emoji spans.
 */
export function BadgeIcon({ badgeId, locked, size = 'sm', showRarity }: BadgeIconProps) {
  const def = getCosmeticDef(badgeId, 'badge');
  if (!def) return null;

  const sizeClasses = size === 'md'
    ? 'px-2 py-0.5 text-[11px] gap-0.5'
    : 'px-1.5 py-0.5 text-[10px] gap-0.5';

  const emojiSize = size === 'md' ? 'text-sm' : 'text-xs';

  return (
    <Tooltip content={<BadgeTooltipContent def={def} locked={locked} showRarity={showRarity} />}>
      <span
        className={`inline-flex items-center ${sizeClasses} rounded-full bg-zinc-800 border border-zinc-700/50 ${locked ? 'opacity-40' : ''}`}
      >
        <span className={`${emojiSize} leading-none`}>{def.emoji}</span>
      </span>
    </Tooltip>
  );
}
