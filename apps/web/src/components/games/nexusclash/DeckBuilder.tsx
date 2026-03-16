'use client';

import { useState, useMemo, useCallback } from 'react';
import type { NcCardDef, NcRarity, NcTag, NcDeckSlot, NcPlayerProfile } from 'shared';
import { NC_CARDS, NC_CARD_MAP, NC_DECK_SIZE, NC_MAX_COPIES } from 'shared';
import { NexusClashCard } from './NexusClashCard';
import { useI18n } from '@/components/providers/LanguageProvider';

interface DeckBuilderProps {
  profile: NcPlayerProfile;
  onSave: (decks: NcDeckSlot[], selectedDeckId: string) => void;
  onClose: () => void;
}

const RARITY_ORDER: NcRarity[] = ['common', 'rare', 'epic', 'legendary'];
const ALL_TAGS: NcTag[] = ['divine', 'arcane', 'beast', 'mech', 'undead', 'nature', 'shadow', 'noble'];

const RARITY_COLORS: Record<NcRarity, string> = {
  common: '#9ca3af', rare: '#4a7dff', epic: '#7c3aed', legendary: '#c9a84c',
};

export function DeckBuilder({ profile, onSave, onClose }: DeckBuilderProps) {
  const { t } = useI18n();
  const [decks, setDecks] = useState<NcDeckSlot[]>(() => [...profile.decks]);
  const [activeTab, setActiveTab] = useState(() => profile.selectedDeckId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<NcTag | null>(null);
  const [filterRarity, setFilterRarity] = useState<NcRarity | null>(null);
  const [filterCost, setFilterCost] = useState<number | null>(null);

  const activeDeck = decks.find(d => d.id === activeTab) ?? decks[0];

  // Show ALL owned cards — once collected, always available
  const ownedCards = useMemo(() => {
    return NC_CARDS.filter(card => (profile.collection.cards[card.id] ?? 0) > 0);
  }, [profile.collection]);

  const filteredCards = useMemo(() => {
    let cards = ownedCards;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      cards = cards.filter(c => t(c.nameKey).toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }
    if (filterTag) cards = cards.filter(c => c.tags.includes(filterTag));
    if (filterRarity) cards = cards.filter(c => c.rarity === filterRarity);
    if (filterCost !== null) cards = cards.filter(c => c.cost === filterCost);
    return cards;
  }, [ownedCards, searchQuery, filterTag, filterRarity, filterCost, t]);

  const deckCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of activeDeck?.cards ?? []) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [activeDeck]);

  const deckFull = (activeDeck?.cards.length ?? 0) >= NC_DECK_SIZE;

  const canAddCard = useCallback((cardId: string) => {
    if (!activeDeck || deckFull) return false;
    const inDeck = deckCounts[cardId] ?? 0;
    // Cards are permanent — no owned count limit, only NC_MAX_COPIES per deck
    return inDeck < NC_MAX_COPIES;
  }, [activeDeck, deckFull, deckCounts]);

  const addCard = useCallback((cardId: string) => {
    if (!canAddCard(cardId)) return;
    setDecks(prev => prev.map(d =>
      d.id === activeDeck!.id ? { ...d, cards: [...d.cards, cardId] } : d
    ));
  }, [activeDeck, canAddCard]);

  const removeCard = useCallback((cardId: string) => {
    if (!activeDeck) return;
    setDecks(prev => prev.map(d => {
      if (d.id !== activeDeck.id) return d;
      const idx = d.cards.indexOf(cardId);
      if (idx === -1) return d;
      return { ...d, cards: [...d.cards.slice(0, idx), ...d.cards.slice(idx + 1)] };
    }));
  }, [activeDeck]);

  const addNewDeck = useCallback(() => {
    const newId = `deck_${Date.now()}`;
    setDecks(prev => [...prev, { id: newId, name: `Deck ${prev.length + 1}`, cards: [] }]);
    setActiveTab(newId);
  }, []);

  const deleteDeck = useCallback((deckId: string) => {
    if (decks.length <= 1) return;
    setDecks(prev => prev.filter(d => d.id !== deckId));
    if (activeTab === deckId) setActiveTab(decks[0]?.id ?? '');
  }, [decks, activeTab]);

  const renameDeck = useCallback((deckId: string, name: string) => {
    setDecks(prev => prev.map(d => d.id === deckId ? { ...d, name: name.slice(0, 20) } : d));
  }, []);

  const handleSave = useCallback(() => {
    onSave(decks, activeTab);
    onClose();
  }, [decks, activeTab, onSave, onClose]);

  const isValid = activeDeck && activeDeck.cards.length === NC_DECK_SIZE;

  // Mana curve
  const manaCurve = useMemo(() => {
    const curve: number[] = [0, 0, 0, 0, 0, 0, 0];
    for (const id of activeDeck?.cards ?? []) {
      const def = NC_CARDS.find(c => c.id === id);
      if (def) curve[Math.min(def.cost - 1, 6)]++;
    }
    return curve;
  }, [activeDeck]);
  const maxCurve = Math.max(1, ...manaCurve);

  // Grouped deck cards for the list
  const deckGroups = useMemo(() => {
    const groups: { id: string; count: number; def: NcCardDef }[] = [];
    const seen = new Set<string>();
    for (const id of activeDeck?.cards ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      const def = NC_CARD_MAP[id];
      if (def) groups.push({ id, count: (activeDeck?.cards ?? []).filter(c => c === id).length, def });
    }
    groups.sort((a, b) => a.def.cost - b.def.cost);
    return groups;
  }, [activeDeck]);

  // Selected card detail
  const selectedDef = selectedId ? NC_CARD_MAP[selectedId] : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{
      background: 'radial-gradient(ellipse at center, #0a0a12ee, #050510ff)',
      backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: '95vw',
          maxWidth: '1200px',
          height: '92vh',
          background: 'linear-gradient(180deg, #12121f, #0e0e1a)',
          border: '1px solid #2a2a3a',
          borderRadius: '8px',
          boxShadow: '0 0 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{
          borderBottom: '1px solid #1e1e3a',
          background: 'linear-gradient(to right, #12121f, #1a1a2e, #12121f)',
        }}>
          <h2 className="text-lg font-black uppercase tracking-[0.1em]" style={{ color: '#c9a84c' }}>{t('nc.deckbuilder.title')}</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded font-bold text-sm uppercase tracking-wider transition-all"
              style={{
                background: isValid ? 'linear-gradient(135deg, #c9a84c, #a07c2a)' : '#2a2a3a',
                color: isValid ? '#0a0a12' : '#5a5a6a',
                border: `1px solid ${isValid ? '#e8d48b' : '#3a3a4a'}`,
              }}
            >
              {t('nc.deckbuilder.save')}
            </button>
            <button onClick={onClose} className="text-xl leading-none transition-colors" style={{ color: '#5a5a6a' }}
              onMouseOver={e => (e.currentTarget.style.color = '#c9a84c')}
              onMouseOut={e => (e.currentTarget.style.color = '#5a5a6a')}
            >&times;</button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">

          {/* ═══ LEFT: Card Collection ═══ */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filters */}
            <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 shrink-0" style={{ borderBottom: '1px solid #1e1e3a' }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('nc.deckbuilder.search')}
                className="rounded px-3 py-1.5 text-sm focus:outline-none w-32"
                style={{ background: '#0a0a12', border: '1px solid #2a2a3a', color: '#e0e0e8' }}
              />
              <select value={filterTag ?? ''} onChange={(e) => setFilterTag((e.target.value || null) as NcTag | null)}
                className="rounded px-2 py-1.5 text-xs" style={{ background: '#0a0a12', border: '1px solid #2a2a3a', color: '#8a8a9a' }}>
                <option value="">{t('nc.deckbuilder.allTags')}</option>
                {ALL_TAGS.map(tag => <option key={tag} value={tag}>{t(`nc.tag.${tag}`)}</option>)}
              </select>
              <select value={filterRarity ?? ''} onChange={(e) => setFilterRarity((e.target.value || null) as NcRarity | null)}
                className="rounded px-2 py-1.5 text-xs" style={{ background: '#0a0a12', border: '1px solid #2a2a3a', color: '#8a8a9a' }}>
                <option value="">{t('nc.deckbuilder.allRarities')}</option>
                {RARITY_ORDER.map(r => <option key={r} value={r}>{t(`nc.rarity.${r}`)}</option>)}
              </select>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6].map(cost => (
                  <button key={cost} onClick={() => setFilterCost(filterCost === cost ? null : cost)}
                    className="w-6 h-6 rounded text-[10px] font-bold transition-all"
                    style={{
                      background: filterCost === cost ? '#c9a84c' : '#0a0a12',
                      color: filterCost === cost ? '#0a0a12' : '#5a5a6a',
                      border: `1px solid ${filterCost === cost ? '#e8d48b' : '#2a2a3a'}`,
                    }}>
                    {cost}
                  </button>
                ))}
              </div>
              {deckFull && (
                <span className="text-[10px] font-bold uppercase ml-auto" style={{ color: '#4ade80' }}>Deck voll!</span>
              )}
            </div>

            {/* Card Grid */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2 content-start">
              {filteredCards.map((card) => {
                const inDeck = deckCounts[card.id] ?? 0;
                const canAdd = canAddCard(card.id);
                return (
                  <div key={card.id} className="flex flex-col items-center gap-0.5 relative">
                    {/* Card */}
                    <div className="relative">
                      <NexusClashCard
                        card={card}
                        onClick={() => setSelectedId(selectedId === card.id ? null : card.id)}
                        selected={selectedId === card.id}
                      />
                      {/* In-deck indicator */}
                      {inDeck > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center z-10"
                          style={{ background: '#7c3aed', border: '1.5px solid #a78bfa', boxShadow: '0 0 6px rgba(124,58,237,0.4)' }}>
                          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5"><path d="M2 5L4.5 7.5L8 3" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </div>
                    {/* Name */}
                    <p className="text-[9px] font-semibold truncate max-w-full text-center" style={{ color: '#8a8a9a' }}>
                      {t(card.nameKey)}
                    </p>
                    {/* +/- Buttons — always visible */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => addCard(card.id)}
                        disabled={!canAdd}
                        className="w-6 h-5 rounded flex items-center justify-center text-xs font-black transition-all"
                        style={{
                          background: canAdd ? '#1a3a1a' : '#1a1a1a',
                          color: canAdd ? '#4ade80' : '#2a2a2a',
                          border: `1px solid ${canAdd ? '#16a34a50' : '#1e1e1e'}`,
                          cursor: canAdd ? 'pointer' : 'default',
                        }}
                      >+</button>
                      <button
                        onClick={() => removeCard(card.id)}
                        disabled={inDeck === 0}
                        className="w-6 h-5 rounded flex items-center justify-center text-xs font-black transition-all"
                        style={{
                          background: inDeck > 0 ? '#3a1a1a' : '#1a1a1a',
                          color: inDeck > 0 ? '#ef4444' : '#2a2a2a',
                          border: `1px solid ${inDeck > 0 ? '#dc262650' : '#1e1e1e'}`,
                          cursor: inDeck > 0 ? 'pointer' : 'default',
                        }}
                      >-</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ CENTER: Card Detail (when selected) ═══ */}
          {selectedDef && (
            <div className="w-56 shrink-0 overflow-y-auto py-4 px-3 flex flex-col gap-3" style={{
              borderLeft: '1px solid #1e1e3a',
              borderRight: '1px solid #1e1e3a',
              background: 'linear-gradient(180deg, #0e0e1a, #0a0a12)',
            }}>
              <div className="flex justify-center">
                <NexusClashCard card={selectedDef} />
              </div>
              <h3 className="text-sm font-black text-center" style={{ color: '#e0e0e8' }}>{t(selectedDef.nameKey)}</h3>
              <span className="text-[9px] font-bold uppercase tracking-wider text-center px-2 py-0.5 rounded self-center"
                style={{ color: RARITY_COLORS[selectedDef.rarity], background: `${RARITY_COLORS[selectedDef.rarity]}15`, border: `1px solid ${RARITY_COLORS[selectedDef.rarity]}30` }}>
                {t(`nc.rarity.${selectedDef.rarity}`)}
              </span>
              <div className="flex justify-center gap-3">
                <div className="text-center"><span className="text-[8px] uppercase font-bold block" style={{ color: '#5a5a6a' }}>{t('nc.detail.cost')}</span><span className="text-base font-black" style={{ color: '#4a7dff' }}>{selectedDef.cost}</span></div>
                <div className="text-center"><span className="text-[8px] uppercase font-bold block" style={{ color: '#5a5a6a' }}>{t('nc.detail.power')}</span><span className="text-base font-black" style={{ color: '#e0e0e8' }}>{selectedDef.power}</span></div>
              </div>
              <div className="flex flex-wrap gap-1 justify-center">
                {selectedDef.tags.map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', color: '#a0a0b0' }}>
                    {t(`nc.tag.${tag}`)}
                  </span>
                ))}
              </div>
              <div className="rounded p-2.5" style={{ background: '#0a0a1299', border: '1px solid #1e1e3a' }}>
                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-block mb-1"
                  style={{
                    background: selectedDef.ability.trigger === 'ongoing' ? '#c9a84c20' : '#4a7dff15',
                    color: selectedDef.ability.trigger === 'ongoing' ? '#c9a84c' : '#4a7dff',
                    border: `1px solid ${selectedDef.ability.trigger === 'ongoing' ? '#c9a84c30' : '#4a7dff25'}`,
                  }}>
                  {t(`nc.trigger.${selectedDef.ability.trigger}`)}
                </span>
                <p className="text-[11px] leading-relaxed" style={{ color: '#c0c0d0' }}>{t(`nc.ability.${selectedDef.id}`)}</p>
              </div>
              {/* Add/remove from this panel too */}
              <div className="flex gap-2 justify-center">
                <button onClick={() => addCard(selectedDef.id)} disabled={!canAddCard(selectedDef.id)}
                  className="flex-1 py-1.5 rounded text-xs font-bold transition-all"
                  style={{
                    background: canAddCard(selectedDef.id) ? '#1a3a1a' : '#1a1a1a',
                    color: canAddCard(selectedDef.id) ? '#4ade80' : '#2a2a2a',
                    border: `1px solid ${canAddCard(selectedDef.id) ? '#16a34a50' : '#1e1e1e'}`,
                  }}>+ {t('nc.detail.addToDeck')}</button>
              </div>
              {(deckCounts[selectedDef.id] ?? 0) > 0 && (
                <p className="text-[10px] text-center font-semibold flex items-center justify-center gap-1" style={{ color: '#7c3aed' }}>
                  <svg viewBox="0 0 10 10" className="w-3 h-3"><path d="M2 5L4.5 7.5L8 3" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {t('nc.detail.inDeck')}
                </p>
              )}
            </div>
          )}

          {/* ═══ RIGHT: Deck Panel ═══ */}
          <div className="w-64 flex flex-col overflow-hidden shrink-0" style={{
            background: 'linear-gradient(180deg, #0e0e1a, #0a0a12)',
            borderLeft: selectedDef ? 'none' : '1px solid #1e1e3a',
          }}>
            {/* Deck tabs */}
            <div className="flex gap-1 px-3 pt-2 pb-1 shrink-0" style={{ borderBottom: '1px solid #1e1e3a' }}>
              {decks.map(d => (
                <button key={d.id} onClick={() => setActiveTab(d.id)}
                  className="px-2 py-1 text-[10px] font-bold transition-all truncate max-w-[70px] uppercase tracking-wider"
                  style={{
                    color: d.id === activeTab ? '#c9a84c' : '#3a3a4a',
                    borderBottom: d.id === activeTab ? '2px solid #c9a84c' : '2px solid transparent',
                  }}>
                  {d.name}
                </button>
              ))}
              <button onClick={addNewDeck} className="px-1.5 py-1 text-xs transition-colors" style={{ color: '#3a3a4a' }}
                onMouseOver={e => (e.currentTarget.style.color = '#c9a84c')}
                onMouseOut={e => (e.currentTarget.style.color = '#3a3a4a')}>+</button>
            </div>

            {/* Deck name + count */}
            {activeDeck && (
              <div className="px-3 py-2 flex items-center gap-2 shrink-0" style={{ borderBottom: '1px solid #1e1e3a' }}>
                <input value={activeDeck.name} onChange={(e) => renameDeck(activeDeck.id, e.target.value)}
                  className="bg-transparent text-xs font-bold w-20 focus:outline-none" style={{ color: '#e0e0e8', borderBottom: '1px solid transparent' }}
                  onFocus={e => (e.currentTarget.style.borderBottomColor = '#c9a84c')}
                  onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')} />
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs font-black" style={{
                    color: activeDeck.cards.length === NC_DECK_SIZE ? '#4ade80' : '#c9a84c',
                  }}>
                    {activeDeck.cards.length}/{NC_DECK_SIZE}
                  </span>
                  {decks.length > 1 && (
                    <button onClick={() => deleteDeck(activeDeck.id)} className="text-xs transition-colors" style={{ color: '#3a3a4a' }}
                      onMouseOver={e => (e.currentTarget.style.color = '#ef4444')} onMouseOut={e => (e.currentTarget.style.color = '#3a3a4a')}>&times;</button>
                  )}
                </div>
              </div>
            )}

            {/* Deck card list — Hearthstone-style bars */}
            <div className="flex-1 overflow-y-auto px-2 py-1">
              {activeDeck && activeDeck.cards.length === 0 && (
                <div className="text-center py-6">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 mx-auto mb-2" fill="none" stroke="#2a2a3a" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  <p className="text-[10px]" style={{ color: '#3a3a4a' }}>{t('nc.deckbuilder.addHint')}</p>
                </div>
              )}
              {deckGroups.map(({ id, count, def }) => (
                <div key={id} className="flex items-center gap-1.5 mb-0.5 rounded overflow-hidden group"
                  style={{ background: '#12121f', border: '1px solid #1e1e3a', height: 28 }}>
                  {/* Mana cost */}
                  <div className="w-6 h-full flex items-center justify-center text-[10px] font-black shrink-0"
                    style={{ background: '#0a0a12', color: '#4a7dff' }}>
                    {def.cost}
                  </div>
                  {/* Rarity bar */}
                  <div className="w-0.5 h-3 rounded shrink-0" style={{ background: RARITY_COLORS[def.rarity] }} />
                  {/* Name */}
                  <span className="text-[10px] font-semibold truncate flex-1 min-w-0" style={{ color: '#c0c0d0' }}>
                    {t(def.nameKey)}
                  </span>
                  {/* Remove */}
                  <button onClick={() => removeCard(id)}
                    className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black shrink-0 mr-1 transition-all"
                    style={{ background: '#2a1515', color: '#ef4444', border: '1px solid #3a2020' }}>
                    -
                  </button>
                </div>
              ))}
            </div>

            {/* Mana curve */}
            <div className="px-3 py-2 shrink-0" style={{ borderTop: '1px solid #1e1e3a' }}>
              <div className="flex items-end gap-0.5 h-10">
                {manaCurve.map((count, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div className="w-full rounded-t" style={{
                      height: count > 0 ? `${Math.max(4, (count / maxCurve) * 100)}%` : 0,
                      background: 'linear-gradient(to top, #4a7dff55, #4a7dff22)',
                      border: count > 0 ? '1px solid #4a7dff44' : 'none',
                      borderBottom: 'none',
                    }} />
                    <span className="text-[7px]" style={{ color: '#3a3a4a' }}>{i + 1}{i === 6 ? '+' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Validation message */}
            {activeDeck && !isValid && (
              <div className="px-3 py-1.5 shrink-0" style={{ borderTop: '1px solid #1e1e3a' }}>
                <p className="text-[10px]" style={{ color: '#c9a84c' }}>
                  {t('nc.deckbuilder.needCards')}{NC_DECK_SIZE - activeDeck.cards.length}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
