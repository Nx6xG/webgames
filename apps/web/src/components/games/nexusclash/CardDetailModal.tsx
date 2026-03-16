'use client';

import { useCallback } from 'react';
import type { NcCardDef, NcRarity } from 'shared';
import { NC_CARD_MAP } from 'shared';
import { NexusClashCard } from './NexusClashCard';
import { useI18n } from '@/components/providers/LanguageProvider';

const RARITY_COLORS: Record<NcRarity, string> = {
  common: '#9ca3af',
  rare: '#4a7dff',
  epic: '#7c3aed',
  legendary: '#c9a84c',
};

const RARITY_BG: Record<NcRarity, string> = {
  common: '#3a3a4a15',
  rare: '#4a7dff15',
  epic: '#7c3aed15',
  legendary: '#c9a84c15',
};

interface CardDetailModalProps {
  cardId: string;
  onClose: () => void;
  /** Number owned by player, undefined = don't show ownership */
  ownedCount?: number;
  /** If provided, shows "Add to Deck" button */
  onAddToDeck?: () => void;
  /** If provided, shows "In Deck: X" */
  inDeckCount?: number;
  /** Can the card be added? */
  canAdd?: boolean;
}

export function CardDetailModal({
  cardId,
  onClose,
  ownedCount,
  onAddToDeck,
  inDeckCount,
  canAdd = true,
}: CardDetailModalProps) {
  const { t } = useI18n();
  const def: NcCardDef | undefined = NC_CARD_MAP[cardId];

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!def) return null;

  const triggerKey = `nc.trigger.${def.ability.trigger}`;
  const abilityText = t(`nc.ability.${def.id}`) || '';
  const rarityColor = RARITY_COLORS[def.rarity];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{
        background: 'rgba(5,5,16,0.85)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={handleBackdrop}
    >
      <div
        className="relative flex flex-col sm:flex-row gap-6 p-6 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #14142a, #0e0e1a)',
          border: `1px solid ${rarityColor}33`,
          borderRadius: '12px',
          boxShadow: `0 0 40px rgba(0,0,0,0.6), 0 0 15px ${rarityColor}15`,
          maxWidth: '520px',
          width: '95vw',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors z-10"
          style={{ background: '#1a1a2a', color: '#5a5a6a', border: '1px solid #2a2a3a' }}
          onMouseOver={e => { e.currentTarget.style.color = '#c9a84c'; e.currentTarget.style.borderColor = '#c9a84c'; }}
          onMouseOut={e => { e.currentTarget.style.color = '#5a5a6a'; e.currentTarget.style.borderColor = '#2a2a3a'; }}
        >
          &times;
        </button>

        {/* Card preview */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          <div className="transform scale-[1.4] origin-top">
            <NexusClashCard card={def} />
          </div>
          {/* Spacer for the scaled card */}
          <div className="h-8" />
        </div>

        {/* Details */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Name & Rarity */}
          <div>
            <h3 className="text-lg font-black" style={{ color: '#e0e0e8' }}>
              {t(def.nameKey)}
            </h3>
            <span
              className="text-xs font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded"
              style={{
                color: rarityColor,
                background: RARITY_BG[def.rarity],
                border: `1px solid ${rarityColor}30`,
              }}
            >
              {t(`nc.rarity.${def.rarity}`)}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center px-3 py-1.5 rounded" style={{ background: '#0a0a12', border: '1px solid #1e1e3a' }}>
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#5a5a6a' }}>{t('nc.detail.cost')}</span>
              <span className="text-lg font-black" style={{ color: '#4a7dff' }}>{def.cost}</span>
            </div>
            <div className="flex flex-col items-center px-3 py-1.5 rounded" style={{ background: '#0a0a12', border: '1px solid #1e1e3a' }}>
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#5a5a6a' }}>{t('nc.detail.power')}</span>
              <span className="text-lg font-black" style={{ color: '#e0e0e8' }}>{def.power}</span>
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#5a5a6a' }}>{t('nc.detail.tags')}</p>
            <div className="flex flex-wrap gap-1.5">
              {def.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded font-semibold"
                  style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', color: '#a0a0b0' }}
                >
                  {t(`nc.tag.${tag}`)}
                </span>
              ))}
            </div>
          </div>

          {/* Ability */}
          <div className="rounded p-3" style={{ background: '#0a0a1299', border: '1px solid #1e1e3a' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: '#5a5a6a' }}>{t('nc.detail.ability')}</span>
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  background: def.ability.trigger === 'ongoing' ? '#c9a84c20' : '#4a7dff15',
                  color: def.ability.trigger === 'ongoing' ? '#c9a84c' : '#4a7dff',
                  border: `1px solid ${def.ability.trigger === 'ongoing' ? '#c9a84c30' : '#4a7dff25'}`,
                }}
              >
                {t(triggerKey)}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#c0c0d0' }}>{abilityText}</p>
          </div>

          {/* Ownership */}
          {ownedCount !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#5a5a6a' }}>{t('nc.detail.owned')}:</span>
              <span className="text-sm font-bold" style={{ color: ownedCount > 0 ? '#4ade80' : '#ef4444' }}>
                {ownedCount > 0 ? `x${ownedCount}` : t('nc.detail.notOwned')}
              </span>
            </div>
          )}

          {/* In-deck count + Add button */}
          {onAddToDeck && (
            <div className="flex items-center gap-3 mt-auto pt-2">
              {inDeckCount !== undefined && inDeckCount > 0 && (
                <span className="text-xs font-semibold" style={{ color: '#7c3aed' }}>
                  {t('nc.detail.inDeck')}: {inDeckCount}
                </span>
              )}
              <button
                onClick={canAdd ? onAddToDeck : undefined}
                className="px-4 py-2 rounded font-bold text-sm uppercase tracking-wider transition-all"
                style={{
                  background: canAdd ? 'linear-gradient(135deg, #c9a84c, #a07c2a)' : '#2a2a3a',
                  color: canAdd ? '#0a0a12' : '#5a5a6a',
                  border: `1px solid ${canAdd ? '#e8d48b' : '#3a3a4a'}`,
                  cursor: canAdd ? 'pointer' : 'not-allowed',
                  opacity: canAdd ? 1 : 0.5,
                }}
              >
                + {t('nc.detail.addToDeck')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
