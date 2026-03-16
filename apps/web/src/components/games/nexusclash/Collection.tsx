'use client';

import { useState, useMemo } from 'react';
import type { NcCardDef, NcRarity, NcTag, NcPlayerProfile } from 'shared';
import { NC_CARDS, NC_CARD_MAP } from 'shared';
import { NexusClashCard } from './NexusClashCard';
import { useI18n } from '@/components/providers/LanguageProvider';

interface CollectionProps {
  profile: NcPlayerProfile;
  onClose: () => void;
}

const ALL_TAGS: NcTag[] = ['divine', 'arcane', 'beast', 'mech', 'undead', 'nature', 'shadow', 'noble'];
const RARITY_ORDER: NcRarity[] = ['common', 'rare', 'epic', 'legendary'];

const RARITY_COLORS: Record<NcRarity, string> = {
  common: '#9ca3af', rare: '#4a7dff', epic: '#7c3aed', legendary: '#c9a84c',
};

type FilterOwned = 'all' | 'owned' | 'unowned';

export function Collection({ profile, onClose }: CollectionProps) {
  const { t } = useI18n();
  const [filterTag, setFilterTag] = useState<NcTag | null>(null);
  const [filterRarity, setFilterRarity] = useState<NcRarity | null>(null);
  const [filterOwned, setFilterOwned] = useState<FilterOwned>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ownedCount = useMemo(() => {
    let count = 0;
    for (const card of NC_CARDS) {
      if ((profile.collection.cards[card.id] ?? 0) > 0) count++;
    }
    return count;
  }, [profile.collection]);

  const filteredCards = useMemo(() => {
    let cards = [...NC_CARDS];
    if (filterTag) cards = cards.filter(c => c.tags.includes(filterTag));
    if (filterRarity) cards = cards.filter(c => c.rarity === filterRarity);
    if (filterOwned === 'owned') cards = cards.filter(c => (profile.collection.cards[c.id] ?? 0) > 0);
    if (filterOwned === 'unowned') cards = cards.filter(c => (profile.collection.cards[c.id] ?? 0) === 0);
    return cards;
  }, [filterTag, filterRarity, filterOwned, profile.collection]);

  const selectedDef: NcCardDef | undefined = selectedId ? NC_CARD_MAP[selectedId] : undefined;
  const selectedOwned = selectedId ? (profile.collection.cards[selectedId] ?? 0) > 0 : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{
      background: 'radial-gradient(ellipse at center, #0a0a12ee, #050510ff)',
      backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: '95vw',
          maxWidth: '1100px',
          height: '85vh',
          background: 'linear-gradient(180deg, #12121f, #0e0e1a)',
          border: '1px solid #2a2a3a',
          borderRadius: '8px',
          boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 20px rgba(124,58,237,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{
          borderBottom: '1px solid #1e1e3a',
          background: 'linear-gradient(to right, #12121f, #1a1a2e, #12121f)',
        }}>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black uppercase tracking-[0.1em]" style={{ color: '#c9a84c' }}>{t('nc.collection.title')}</h2>
            <span className="text-sm font-bold" style={{ color: '#5a5a6a' }}>{ownedCount}/{NC_CARDS.length}</span>
          </div>
          <button onClick={onClose} className="text-xl leading-none transition-colors" style={{ color: '#5a5a6a' }}
            onMouseOver={e => (e.currentTarget.style.color = '#c9a84c')}
            onMouseOut={e => (e.currentTarget.style.color = '#5a5a6a')}
          >&times;</button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-2 shrink-0">
          <div className="h-2 rounded-full overflow-hidden" style={{
            background: '#0a0a12',
            border: '1px solid #1e1e3a',
          }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(ownedCount / NC_CARDS.length) * 100}%`,
                background: 'linear-gradient(to right, #4a7dff, #7c3aed, #c9a84c)',
              }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-2 flex flex-wrap gap-2 shrink-0" style={{ borderBottom: '1px solid #1e1e3a' }}>
          <select
            value={filterTag ?? ''}
            onChange={(e) => setFilterTag((e.target.value || null) as NcTag | null)}
            className="rounded px-2 py-1.5 text-xs"
            style={{ background: '#0a0a12', border: '1px solid #2a2a3a', color: '#8a8a9a' }}
          >
            <option value="">{t('nc.deckbuilder.allTags')}</option>
            {ALL_TAGS.map(tag => (
              <option key={tag} value={tag}>{t(`nc.tag.${tag}`)}</option>
            ))}
          </select>
          <select
            value={filterRarity ?? ''}
            onChange={(e) => setFilterRarity((e.target.value || null) as NcRarity | null)}
            className="rounded px-2 py-1.5 text-xs"
            style={{ background: '#0a0a12', border: '1px solid #2a2a3a', color: '#8a8a9a' }}
          >
            <option value="">{t('nc.deckbuilder.allRarities')}</option>
            {RARITY_ORDER.map(r => (
              <option key={r} value={r}>{t(`nc.rarity.${r}`)}</option>
            ))}
          </select>
          <div className="flex gap-1 p-0.5 rounded" style={{ background: '#0a0a12', border: '1px solid #1e1e3a' }}>
            {(['all', 'owned', 'unowned'] as FilterOwned[]).map(f => (
              <button
                key={f}
                onClick={() => setFilterOwned(f)}
                className="px-2.5 py-1 text-xs rounded font-semibold uppercase tracking-wider transition-all"
                style={{
                  background: filterOwned === f ? '#1e1e3a' : 'transparent',
                  color: filterOwned === f ? '#c9a84c' : '#5a5a6a',
                }}
              >
                {t(`nc.collection.filter.${f}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Main area: Grid + always-visible detail panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-4 content-start">
            {filteredCards.map(card => {
              const owned = (profile.collection.cards[card.id] ?? 0) > 0;
              return (
                <div
                  key={card.id}
                  className="flex flex-col items-center gap-1"
                >
                  <NexusClashCard
                    card={card}
                    locked={!owned}
                    onClick={() => setSelectedId(card.id)}
                    selected={selectedId === card.id}
                  />
                  <p className="text-[10px] font-semibold truncate max-w-full text-center" style={{ color: owned ? '#c0c0d0' : '#3a3a4a' }}>
                    {t(card.nameKey)}
                  </p>
                  {owned && (
                    <div className="flex items-center gap-1">
                      <svg viewBox="0 0 12 12" className="w-3 h-3"><circle cx="6" cy="6" r="5" fill="#16a34a" opacity="0.8"/><path d="M3.5 6L5.5 8L8.5 4.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail panel — always visible */}
          <div className="w-72 shrink-0 overflow-y-auto p-5 flex flex-col gap-4" style={{
            borderLeft: '1px solid #1e1e3a',
            background: 'linear-gradient(180deg, #0e0e1a, #0a0a12)',
          }}>
            {selectedDef ? (
              <>
                {/* Card preview (no scale to avoid overlap) */}
                <div className="flex justify-center">
                  <NexusClashCard card={selectedDef} locked={!selectedOwned} />
                </div>

                {/* Name & Rarity */}
                <div>
                  <h3 className="text-base font-black" style={{ color: '#e0e0e8' }}>
                    {t(selectedDef.nameKey)}
                  </h3>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded inline-block mt-1"
                    style={{
                      color: RARITY_COLORS[selectedDef.rarity],
                      background: `${RARITY_COLORS[selectedDef.rarity]}15`,
                      border: `1px solid ${RARITY_COLORS[selectedDef.rarity]}30`,
                    }}
                  >
                    {t(`nc.rarity.${selectedDef.rarity}`)}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center px-3 py-1.5 rounded" style={{ background: '#0a0a12', border: '1px solid #1e1e3a' }}>
                    <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#5a5a6a' }}>{t('nc.detail.cost')}</span>
                    <span className="text-lg font-black" style={{ color: '#4a7dff' }}>{selectedDef.cost}</span>
                  </div>
                  <div className="flex flex-col items-center px-3 py-1.5 rounded" style={{ background: '#0a0a12', border: '1px solid #1e1e3a' }}>
                    <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#5a5a6a' }}>{t('nc.detail.power')}</span>
                    <span className="text-lg font-black" style={{ color: '#e0e0e8' }}>{selectedDef.power}</span>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#5a5a6a' }}>{t('nc.detail.tags')}</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedDef.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', color: '#a0a0b0' }}>
                        {t(`nc.tag.${tag}`)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Ability */}
                <div className="rounded p-3" style={{ background: '#0a0a1299', border: '1px solid #1e1e3a' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[8px] font-bold uppercase tracking-[0.15em]" style={{ color: '#5a5a6a' }}>{t('nc.detail.ability')}</span>
                    <span
                      className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{
                        background: selectedDef.ability.trigger === 'ongoing' ? '#c9a84c20' : '#4a7dff15',
                        color: selectedDef.ability.trigger === 'ongoing' ? '#c9a84c' : '#4a7dff',
                        border: `1px solid ${selectedDef.ability.trigger === 'ongoing' ? '#c9a84c30' : '#4a7dff25'}`,
                      }}
                    >
                      {t(`nc.trigger.${selectedDef.ability.trigger}`)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#c0c0d0' }}>{t(`nc.ability.${selectedDef.id}`)}</p>
                </div>

                {/* Owned status */}
                <div className="flex items-center gap-2 rounded px-3 py-2" style={{
                  background: selectedOwned ? '#16a34a10' : '#ef444410',
                  border: `1px solid ${selectedOwned ? '#16a34a30' : '#ef444430'}`,
                }}>
                  {selectedOwned ? (
                    <>
                      <svg viewBox="0 0 16 16" className="w-4 h-4"><circle cx="8" cy="8" r="7" fill="#16a34a"/><path d="M4.5 8L7 10.5L11.5 5.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span className="text-xs font-bold" style={{ color: '#4ade80' }}>{t('nc.detail.owned')}</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 16 16" className="w-4 h-4"><circle cx="8" cy="8" r="7" fill="#dc2626" opacity="0.5"/><path d="M5 5L11 11M11 5L5 11" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      <span className="text-xs font-bold" style={{ color: '#fca5a5' }}>{t('nc.detail.notOwned')}</span>
                    </>
                  )}
                </div>
              </>
            ) : (
              /* Placeholder when no card selected */
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="#2a2a3a" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <circle cx="12" cy="10" r="3"/>
                  <path d="M12 15v2"/>
                </svg>
                <p className="text-xs text-center" style={{ color: '#3a3a4a' }}>{t('nc.collection.selectCard')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
