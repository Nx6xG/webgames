'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { NcCardDef, NcRarity, NcTag, NcDeckSlot, NcPlayerProfile } from 'shared';
import { NC_CARDS, NC_CARD_MAP, NC_DECK_SIZE, NC_MAX_COPIES, encodeDeckCode, decodeDeckCode } from 'shared';
import { NexusClashCard } from './NexusClashCard';
import { useI18n } from '@/components/providers/LanguageProvider';

interface DeckBuilderProps {
  profile: NcPlayerProfile;
  onSave: (decks: NcDeckSlot[], selectedDeckId: string) => void;
  onClose: () => void;
  onToggleFavorite?: (cardId: string) => void;
}

const RARITY_ORDER: NcRarity[] = ['common', 'rare', 'epic', 'legendary'];
const ALL_TAGS: NcTag[] = ['divine', 'arcane', 'beast', 'mech', 'undead', 'nature', 'shadow', 'noble', 'spell', 'dragon', 'demon', 'relic'];

const RARITY_COLORS: Record<NcRarity, string> = {
  common: '#9ca3af', rare: '#4a7dff', epic: '#7c3aed', legendary: '#c9a84c',
};
const RARITY_GLOW: Record<NcRarity, string> = {
  common: 'transparent', rare: 'rgba(74,125,255,0.15)', epic: 'rgba(124,58,237,0.2)', legendary: 'rgba(201,168,76,0.25)',
};
const TAG_COLORS: Record<NcTag, string> = {
  divine: '#c9a84c', arcane: '#a78bfa', beast: '#f59e0b', mech: '#6a8aaa',
  undead: '#8a8a9a', nature: '#4ade80', shadow: '#6366f1', noble: '#e8d48b', spell: '#e879f9',
  dragon: '#ef4444', demon: '#dc2626', relic: '#d97706',
};

// ── Inline ring SVG for deck progress ──────────────────────────────────────
function DeckRing({ current, max }: { current: number; max: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(current / max, 1);
  const full = current === max;
  return (
    <svg viewBox="0 0 44 44" style={{ width: 44, height: 44 }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#1e1e3a" strokeWidth="3" />
      <circle cx="22" cy="22" r={r} fill="none"
        stroke={full ? '#4ade80' : '#c9a84c'}
        strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${pct * circ} ${circ}`}
        transform="rotate(-90 22 22)"
        style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.3s' }}
      />
      <text x="22" y="24" textAnchor="middle" fill={full ? '#4ade80' : '#e0e0e8'} fontSize="11" fontWeight="800" fontFamily="monospace">
        {current}
      </text>
    </svg>
  );
}

export function DeckBuilder({ profile, onSave, onClose, onToggleFavorite }: DeckBuilderProps) {
  const { t } = useI18n();
  const favs = useMemo(() => new Set(profile.favorites ?? []), [profile.favorites]);
  const [decks, setDecks] = useState<NcDeckSlot[]>(() => [...profile.decks]);
  const [activeTab, setActiveTab] = useState(() => profile.selectedDeckId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<NcTag | null>(null);
  const [filterRarity, setFilterRarity] = useState<NcRarity | null>(null);
  const [filterCost, setFilterCost] = useState<number | null>(null);

  // Flash animation for newly added/removed cards
  const [flashCardId, setFlashCardId] = useState<string | null>(null);

  // Deck code import/export feedback
  const [deckCodeMsg, setDeckCodeMsg] = useState<string | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setMounted(true); }, []);

  const activeDeck = decks.find(d => d.id === activeTab) ?? decks[0];

  const ownedSet = useMemo(() => {
    const s = new Set<string>();
    for (const [id, count] of Object.entries(profile.collection.cards)) {
      if (count > 0) s.add(id);
    }
    return s;
  }, [profile.collection]);

  // Show ALL cards, not just owned — unowned are greyed out
  const allCards = NC_CARDS;

  // Snapshot favorites for sort order — only update when filters change, not on every toggle
  // This prevents cards from jumping position mid-click
  const sortFavsRef = useRef(favs);
  useEffect(() => { sortFavsRef.current = favs; }, [searchQuery, filterTag, filterRarity, filterCost, favs]);

  const filteredCards = useMemo(() => {
    let cards = [...allCards];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      cards = cards.filter(c => t(c.nameKey).toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }
    if (filterTag) cards = cards.filter(c => c.tags.includes(filterTag));
    if (filterRarity) cards = cards.filter(c => c.rarity === filterRarity);
    if (filterCost !== null) {
      cards = filterCost >= 6
        ? cards.filter(c => c.cost >= 6)
        : cards.filter(c => c.cost === filterCost);
    }
    // Sort: owned first, then favorites, then by cost, then rarity
    const sf = sortFavsRef.current;
    return cards.sort((a, b) => {
      const aOwned = ownedSet.has(a.id) ? 0 : 1;
      const bOwned = ownedSet.has(b.id) ? 0 : 1;
      if (aOwned !== bOwned) return aOwned - bOwned;
      const aFav = sf.has(a.id) ? 0 : 1;
      const bFav = sf.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return a.cost - b.cost || RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
    });
  }, [allCards, ownedSet, searchQuery, filterTag, filterRarity, filterCost, t]);

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
    if (!ownedSet.has(cardId)) return false;
    return (deckCounts[cardId] ?? 0) < NC_MAX_COPIES;
  }, [activeDeck, deckFull, deckCounts, ownedSet]);

  const flashCard = useCallback((cardId: string) => {
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    setFlashCardId(cardId);
    flashTimeout.current = setTimeout(() => setFlashCardId(null), 500);
  }, []);

  const addCard = useCallback((cardId: string) => {
    if (!canAddCard(cardId)) return;
    setDecks(prev => prev.map(d =>
      d.id === activeDeck!.id ? { ...d, cards: [...d.cards, cardId] } : d
    ));
    flashCard(cardId);
  }, [activeDeck, canAddCard, flashCard]);

  const removeCard = useCallback((cardId: string) => {
    if (!activeDeck) return;
    setDecks(prev => prev.map(d => {
      if (d.id !== activeDeck.id) return d;
      const idx = d.cards.indexOf(cardId);
      if (idx === -1) return d;
      return { ...d, cards: [...d.cards.slice(0, idx), ...d.cards.slice(idx + 1)] };
    }));
  }, [activeDeck]);

  const toggleCard = useCallback((cardId: string) => {
    const inDeck = deckCounts[cardId] ?? 0;
    if (inDeck > 0) {
      removeCard(cardId);
    } else {
      addCard(cardId);
    }
  }, [deckCounts, addCard, removeCard]);

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

  // Deck stats
  const deckStats = useMemo(() => {
    let totalPower = 0;
    let totalCost = 0;
    const tagCounts: Partial<Record<NcTag, number>> = {};
    const rarityCounts: Partial<Record<NcRarity, number>> = {};
    for (const id of activeDeck?.cards ?? []) {
      const def = NC_CARD_MAP[id];
      if (!def) continue;
      totalPower += def.power;
      totalCost += def.cost;
      rarityCounts[def.rarity] = (rarityCounts[def.rarity] ?? 0) + 1;
      for (const tag of def.tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
    }
    return { totalPower, avgCost: activeDeck?.cards.length ? (totalCost / activeDeck.cards.length).toFixed(1) : '0', tagCounts, rarityCounts };
  }, [activeDeck]);

  // Deck card list sorted by cost
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

  const selectedDef = selectedId ? NC_CARD_MAP[selectedId] : undefined;

  // Active filter count
  const activeFilters = [searchQuery, filterTag, filterRarity, filterCost !== null].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterTag(null);
    setFilterRarity(null);
    setFilterCost(null);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 30% 20%, #12121f88, #050510ff)',
        backdropFilter: 'blur(12px)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: '98vw',
          maxWidth: '1280px',
          height: '96vh',
          background: '#0a0a12',
          border: '1px solid #1a1a2e',
          borderRadius: '12px',
          boxShadow: '0 0 80px rgba(0,0,0,0.7), 0 0 40px rgba(124,58,237,0.04), inset 0 1px 0 #1e1e3a',
          transform: mounted ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(10px)',
          transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 shrink-0" style={{
          background: 'linear-gradient(to right, #0e0e1a, #14142a, #0e0e1a)',
          borderBottom: '1px solid #1e1e3a',
        }}>
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, #c9a84c15, #c9a84c08)',
              border: '1px solid #c9a84c30',
            }}>
              <svg viewBox="0 0 20 20" style={{ width: 16, height: 16 }}>
                <rect x="2" y="3" width="12" height="14" rx="1.5" fill="none" stroke="#c9a84c" strokeWidth="1.2" />
                <rect x="6" y="1" width="12" height="14" rx="1.5" fill="none" stroke="#c9a84c60" strokeWidth="1" />
              </svg>
            </div>
            <h2 className="text-base font-black uppercase tracking-[0.15em]" style={{ color: '#c9a84c' }}>
              {t('nc.deckbuilder.title')}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-lg text-xs font-black uppercase tracking-[0.12em] transition-all"
              style={{
                background: isValid ? 'linear-gradient(135deg, #c9a84c, #a07c2a)' : '#1a1a2e',
                color: isValid ? '#0a0a12' : '#3a3a4a',
                border: `1px solid ${isValid ? '#e8d48b' : '#2a2a3a'}`,
                boxShadow: isValid ? '0 0 20px rgba(201,168,76,0.15)' : 'none',
                cursor: isValid ? 'pointer' : 'default',
              }}
            >
              {t('nc.deckbuilder.save')}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{ background: '#12121f', border: '1px solid #1e1e3a', color: '#4a4a5a' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#c9a84c50'; e.currentTarget.style.color = '#c9a84c'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#1e1e3a'; e.currentTarget.style.color = '#4a4a5a'; }}
            >
              <svg viewBox="0 0 14 14" style={{ width: 12, height: 12 }}><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">

          {/* ═══ LEFT: Card Collection ═══ */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>

            {/* Filter bar */}
            <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 shrink-0" style={{
              background: '#0c0c18',
              borderBottom: '1px solid #1a1a2e',
            }}>
              {/* Search */}
              <div className="relative">
                <svg viewBox="0 0 16 16" style={{ width: 13, height: 13, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#3a3a5a' }}>
                  <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('nc.deckbuilder.search')}
                  className="rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none w-28 sm:w-36 transition-all"
                  style={{
                    background: '#0a0a12',
                    border: `1px solid ${searchQuery ? '#c9a84c40' : '#1e1e3a'}`,
                    color: '#d0d0e0',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#c9a84c60')}
                  onBlur={e => (e.currentTarget.style.borderColor = searchQuery ? '#c9a84c40' : '#1e1e3a')}
                />
              </div>

              {/* Rarity pills */}
              <div className="flex gap-1">
                {RARITY_ORDER.map(r => {
                  const active = filterRarity === r;
                  return (
                    <button key={r} onClick={() => setFilterRarity(active ? null : r)}
                      className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all"
                      style={{
                        background: active ? `${RARITY_COLORS[r]}18` : 'transparent',
                        color: active ? RARITY_COLORS[r] : '#3a3a5a',
                        border: `1px solid ${active ? `${RARITY_COLORS[r]}40` : 'transparent'}`,
                      }}>
                      {t(`nc.rarity.${r}`)}
                    </button>
                  );
                })}
              </div>

              {/* Tag dropdown */}
              <select value={filterTag ?? ''} onChange={(e) => setFilterTag((e.target.value || null) as NcTag | null)}
                className="rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                style={{
                  background: filterTag ? '#12121f' : '#0a0a12',
                  border: `1px solid ${filterTag ? TAG_COLORS[filterTag] + '40' : '#1e1e3a'}`,
                  color: filterTag ? TAG_COLORS[filterTag] : '#4a4a5a',
                  outline: 'none',
                }}>
                <option value="">{t('nc.deckbuilder.allTags')}</option>
                {ALL_TAGS.map(tag => <option key={tag} value={tag}>{t(`nc.tag.${tag}`)}</option>)}
              </select>

              {/* Mana cost buttons */}
              <div className="flex gap-0.5 ml-1">
                {[1, 2, 3, 4, 5, 6].map(cost => {
                  const active = filterCost === cost;
                  return (
                    <button key={cost} onClick={() => setFilterCost(active ? null : cost)}
                      className="w-7 h-7 rounded-md text-[10px] font-black transition-all flex items-center justify-center"
                      style={{
                        background: active ? 'linear-gradient(135deg, #4a7dff, #2a4aaa)' : '#0a0a12',
                        color: active ? '#fff' : '#3a3a5a',
                        border: `1px solid ${active ? '#4a7dff60' : '#1e1e3a'}`,
                        boxShadow: active ? '0 0 8px rgba(74,125,255,0.2)' : 'none',
                      }}>
                      {cost}{cost === 6 ? '+' : ''}
                    </button>
                  );
                })}
              </div>

              {/* Clear filters */}
              {activeFilters > 0 && (
                <button onClick={clearFilters} className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-md transition-all"
                  style={{ color: '#5a5a6a', border: '1px solid #1e1e3a' }}
                  onMouseOver={e => { e.currentTarget.style.color = '#c9a84c'; e.currentTarget.style.borderColor = '#c9a84c40'; }}
                  onMouseOut={e => { e.currentTarget.style.color = '#5a5a6a'; e.currentTarget.style.borderColor = '#1e1e3a'; }}
                >
                  {activeFilters} Filter &times;
                </button>
              )}

              {/* Cards count */}
              <span className="text-[10px] font-semibold ml-auto" style={{ color: '#3a3a5a' }}>
                {filteredCards.length} / {allCards.length}
              </span>
            </div>

            {/* Card Grid */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3" style={{ background: '#08080f' }}>
              <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
                {filteredCards.map((card) => {
                  const inDeck = deckCounts[card.id] ?? 0;
                  const owned = ownedSet.has(card.id);
                  const canAdd = canAddCard(card.id);
                  const isFlashing = flashCardId === card.id;
                  return (
                    <div
                      key={card.id}
                      className="flex flex-col items-center gap-1 relative rounded-lg p-1.5 transition-all cursor-pointer group"
                      style={{
                        background: inDeck > 0 ? `${RARITY_GLOW[card.rarity]}` : 'transparent',
                        border: `1px solid ${inDeck > 0 ? RARITY_COLORS[card.rarity] + '30' : 'transparent'}`,
                        transform: isFlashing ? 'scale(0.95)' : 'scale(1)',
                        opacity: owned ? 1 : 0.35,
                        filter: owned ? 'none' : 'grayscale(0.7)',
                        transition: 'transform 0.15s ease, background 0.3s, border-color 0.3s',
                      }}
                      onClick={() => owned ? toggleCard(card.id) : setSelectedId(selectedId === card.id ? null : card.id)}
                      onContextMenu={(e) => { e.preventDefault(); setSelectedId(selectedId === card.id ? null : card.id); }}
                    >
                      <div className="relative">
                        <NexusClashCard
                          card={card}
                          selected={selectedId === card.id}
                          locked={inDeck > 0 && !canAdd}
                        />
                        {/* In-deck badge */}
                        {inDeck > 0 && (
                          <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center justify-center"
                            style={{
                              width: 20, height: 20, borderRadius: '50%',
                              background: `linear-gradient(135deg, ${RARITY_COLORS[card.rarity]}, ${RARITY_COLORS[card.rarity]}cc)`,
                              boxShadow: `0 0 8px ${RARITY_COLORS[card.rarity]}50`,
                              border: '2px solid #0a0a12',
                            }}>
                            <svg viewBox="0 0 10 10" style={{ width: 10, height: 10 }}>
                              <path d="M2 5L4.5 7.5L8 3" fill="none" stroke="#0a0a12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {/* Card name + favorite star */}
                      <div className="flex items-center gap-0.5 max-w-full justify-center leading-tight">
                        {onToggleFavorite && (
                          <button
                            className="shrink-0 text-[9px] leading-none"
                            style={{ color: favs.has(card.id) ? '#c9a84c' : '#2a2a3a' }}
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(card.id); }}
                            title={favs.has(card.id) ? t('nc.favorite.remove') : t('nc.favorite.add')}
                          >
                            ★
                          </button>
                        )}
                        <p className="text-[9px] font-bold truncate text-center leading-tight" style={{
                          color: inDeck > 0 ? RARITY_COLORS[card.rarity] : '#6a6a7a',
                        }}>
                          {t(card.nameKey)}
                        </p>
                      </div>
                      {/* Hover overlay: Add/Remove hint */}
                      <div className="absolute inset-0 rounded-lg flex items-end justify-center pb-7 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                        style={{ background: 'linear-gradient(transparent 40%, #0a0a12dd 100%)' }}>
                        <span className="text-[9px] font-black uppercase tracking-wider" style={{
                          color: !owned ? '#6366f1' : inDeck > 0 ? '#ef4444' : canAdd ? '#4ade80' : '#3a3a5a',
                        }}>
                          {!owned ? t('nc.hover.locked') : inDeck > 0 ? t('nc.hover.remove') : canAdd ? t('nc.hover.add') : t('nc.hover.full')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ═══ CENTER: Card Detail (hidden on mobile) ═══ */}
          {selectedDef && (
            <div className="hidden sm:flex w-60 shrink-0 overflow-y-auto flex-col gap-3 py-4 px-4" style={{
              background: 'linear-gradient(180deg, #0c0c18, #08080f)',
              borderLeft: '1px solid #1a1a2e',
              borderRight: '1px solid #1a1a2e',
            }}>
              {/* Card visual */}
              <div className="flex justify-center">
                <NexusClashCard card={selectedDef} showPreview={false} />
              </div>

              {/* Name + rarity */}
              <div className="text-center">
                <h3 className="text-sm font-black" style={{ color: '#e8e8f0' }}>{t(selectedDef.nameKey)}</h3>
                <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: RARITY_COLORS[selectedDef.rarity] }}>
                  {t(`nc.rarity.${selectedDef.rarity}`)}
                </span>
              </div>

              {/* Stats row */}
              <div className="flex justify-center gap-5">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#3a3a5a' }}>{t('nc.detail.cost')}</span>
                  <span className="text-lg font-black" style={{ color: '#4a7dff' }}>{selectedDef.cost}</span>
                </div>
                <div style={{ width: 1, background: '#1e1e3a' }} />
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#3a3a5a' }}>{t('nc.detail.power')}</span>
                  <span className="text-lg font-black" style={{ color: '#e8e8f0' }}>{selectedDef.power}</span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 justify-center">
                {selectedDef.tags.map(tag => (
                  <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{
                    background: `${TAG_COLORS[tag]}12`,
                    color: TAG_COLORS[tag],
                    border: `1px solid ${TAG_COLORS[tag]}30`,
                  }}>
                    {t(`nc.tag.${tag}`)}
                  </span>
                ))}
              </div>

              {/* Ability */}
              <div className="rounded-lg p-3" style={{ background: '#0a0a1299', border: '1px solid #1a1a2e' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[8px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded"
                    style={{
                      background: selectedDef.ability.trigger === 'ongoing' ? '#c9a84c15' : '#4a7dff12',
                      color: selectedDef.ability.trigger === 'ongoing' ? '#c9a84c' : '#4a7dff',
                      border: `1px solid ${selectedDef.ability.trigger === 'ongoing' ? '#c9a84c25' : '#4a7dff20'}`,
                    }}>
                    {t(`nc.trigger.${selectedDef.ability.trigger}`)}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: '#a0a0b8' }}>
                  {t(`nc.ability.${selectedDef.id}`)}
                </p>
              </div>

              {/* Add/remove button */}
              {(() => {
                const inDeck = deckCounts[selectedDef.id] ?? 0;
                const canAdd = canAddCard(selectedDef.id);
                return inDeck > 0 ? (
                  <button onClick={() => removeCard(selectedDef.id)}
                    className="w-full py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                    style={{ background: '#1a0a0a', color: '#ef4444', border: '1px solid #3a1a1a' }}
                    onMouseOver={e => (e.currentTarget.style.borderColor = '#ef444460')}
                    onMouseOut={e => (e.currentTarget.style.borderColor = '#3a1a1a')}
                  >
                    {t('nc.detail.inDeck')} — Remove
                  </button>
                ) : (
                  <button onClick={() => addCard(selectedDef.id)} disabled={!canAdd}
                    className="w-full py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                    style={{
                      background: canAdd ? '#0a1a0a' : '#12121f',
                      color: canAdd ? '#4ade80' : '#2a2a3a',
                      border: `1px solid ${canAdd ? '#16a34a40' : '#1e1e3a'}`,
                      cursor: canAdd ? 'pointer' : 'default',
                    }}
                    onMouseOver={e => { if (canAdd) e.currentTarget.style.borderColor = '#4ade8060'; }}
                    onMouseOut={e => { if (canAdd) e.currentTarget.style.borderColor = '#16a34a40'; }}
                  >
                    + {t('nc.detail.addToDeck')}
                  </button>
                );
              })()}
            </div>
          )}

          {/* ═══ RIGHT: Deck Panel ═══ */}
          <div className="flex flex-col overflow-hidden shrink-0 w-full sm:w-[280px]" style={{
            maxHeight: 'calc(40vh)',
            background: 'linear-gradient(180deg, #0c0c18, #08080f)',
            borderLeft: '1px solid #1a1a2e',
            borderTop: '1px solid #1a1a2e',
          }}>
            <style>{`@media (min-width: 640px) { .nc-deck-panel { max-height: none !important; border-top: none !important; } }`}</style>

            {/* Deck tabs */}
            <div className="flex items-center gap-0.5 px-3 pt-3 pb-2 shrink-0">
              {decks.map(d => {
                const active = d.id === activeTab;
                return (
                  <button key={d.id} onClick={() => setActiveTab(d.id)}
                    className="px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-[0.1em] transition-all truncate"
                    style={{
                      maxWidth: 90,
                      background: active ? '#c9a84c12' : 'transparent',
                      color: active ? '#c9a84c' : '#3a3a5a',
                      border: `1px solid ${active ? '#c9a84c30' : 'transparent'}`,
                    }}>
                    {d.name}
                  </button>
                );
              })}
              <button onClick={addNewDeck} className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all"
                style={{ color: '#3a3a5a', border: '1px dashed #2a2a3a' }}
                onMouseOver={e => { e.currentTarget.style.color = '#c9a84c'; e.currentTarget.style.borderColor = '#c9a84c50'; }}
                onMouseOut={e => { e.currentTarget.style.color = '#3a3a5a'; e.currentTarget.style.borderColor = '#2a2a3a'; }}>
                +
              </button>
            </div>

            {/* Deck header: name + progress ring */}
            {activeDeck && (
              <div className="flex items-center gap-3 px-4 py-2 shrink-0" style={{ borderBottom: '1px solid #1a1a2e' }}>
                <DeckRing current={activeDeck.cards.length} max={NC_DECK_SIZE} />
                <div className="flex-1 min-w-0">
                  <input value={activeDeck.name} onChange={(e) => renameDeck(activeDeck.id, e.target.value)}
                    className="bg-transparent text-sm font-black w-full focus:outline-none block truncate"
                    style={{ color: '#d0d0e0', borderBottom: '1px solid transparent', paddingBottom: 2 }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = '#c9a84c50')}
                    onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
                  />
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-semibold" style={{ color: '#4a4a5a' }}>
                      {deckStats.avgCost} {t('nc.deckStats.avg')}
                    </span>
                    <span className="text-[9px]" style={{ color: '#2a2a3a' }}>·</span>
                    <span className="text-[9px] font-semibold" style={{ color: '#4a4a5a' }}>
                      {deckStats.totalPower} {t('nc.deckStats.pwr')}
                    </span>
                  </div>
                </div>
                {decks.length > 1 && (
                  <button onClick={() => deleteDeck(activeDeck.id)} className="w-6 h-6 rounded flex items-center justify-center transition-all"
                    style={{ color: '#2a2a3a' }}
                    onMouseOver={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseOut={e => (e.currentTarget.style.color = '#2a2a3a')}>
                    <svg viewBox="0 0 14 14" style={{ width: 12, height: 12 }}><path d="M3 4h8M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5.5 6.5v4M8.5 6.5v4M4 4l.7 7.4a1 1 0 001 .9h2.6a1 1 0 001-.9L10 4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  </button>
                )}
              </div>
            )}

            {/* Deck import/export */}
            {activeDeck && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 shrink-0" style={{ borderBottom: '1px solid #1a1a2e' }}>
                <button
                  onClick={() => {
                    const code = encodeDeckCode(activeDeck.cards);
                    navigator.clipboard.writeText(code);
                    setDeckCodeMsg(t('nc.deck.codeCopied'));
                    setTimeout(() => setDeckCodeMsg(null), 2000);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all hover:brightness-125"
                  style={{ background: '#1a1a2e', color: '#5a5a6a', border: '1px solid #2a2a3a' }}
                >
                  <svg viewBox="0 0 12 12" className="w-3 h-3"><rect x="4" y="1" width="7" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1"/><rect x="1" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1"/></svg>
                  {t('nc.deck.export')}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      const ids = decodeDeckCode(text.trim());
                      if (!ids) {
                        setDeckCodeMsg(t('nc.deck.codeInvalid'));
                        setTimeout(() => setDeckCodeMsg(null), 2000);
                        return;
                      }
                      // Only import cards the player owns
                      const ownedIds = ids.filter(id => (profile.collection.cards[id] ?? 0) > 0);
                      setDecks(prev => prev.map(d => d.id === activeTab ? { ...d, cards: ownedIds.slice(0, NC_DECK_SIZE) } : d));
                      setDeckCodeMsg(t('nc.deck.imported'));
                      setTimeout(() => setDeckCodeMsg(null), 2000);
                    } catch {
                      setDeckCodeMsg(t('nc.deck.codeInvalid'));
                      setTimeout(() => setDeckCodeMsg(null), 2000);
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all hover:brightness-125"
                  style={{ background: '#1a1a2e', color: '#5a5a6a', border: '1px solid #2a2a3a' }}
                >
                  <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 8V10H10V8" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/><path d="M6 1V7M6 7L4 5M6 7L8 5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {t('nc.deck.import')}
                </button>
                {deckCodeMsg && (
                  <span className="text-[9px] font-bold ml-auto" style={{ color: '#c9a84c' }}>{deckCodeMsg}</span>
                )}
              </div>
            )}

            {/* Deck card list */}
            <div className="flex-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e1e3a transparent' }}>
              {activeDeck && activeDeck.cards.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                  <svg viewBox="0 0 32 32" style={{ width: 40, height: 40 }} fill="none" stroke="#3a3a5a" strokeWidth="1">
                    <rect x="6" y="6" width="20" height="20" rx="3" strokeDasharray="4 2" />
                    <line x1="16" y1="12" x2="16" y2="20" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="12" y1="16" x2="20" y2="16" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-[10px] font-semibold text-center leading-relaxed" style={{ color: '#3a3a5a' }}>
                    {t('nc.deckbuilder.addHint')}
                  </p>
                </div>
              )}

              {deckGroups.map(({ id, def }) => {
                const isFlashing = flashCardId === id;
                return (
                  <div key={id}
                    className="flex items-center gap-2 mb-1 rounded-lg overflow-hidden group transition-all"
                    style={{
                      height: 36,
                      background: isFlashing ? `${RARITY_COLORS[def.rarity]}12` : '#0c0c18',
                      border: `1px solid ${isFlashing ? RARITY_COLORS[def.rarity] + '30' : '#1a1a2e'}`,
                      transition: 'background 0.3s, border-color 0.3s, transform 0.15s',
                    }}>
                    {/* Mana cost gem */}
                    <div className="w-8 h-full flex items-center justify-center shrink-0 relative" style={{
                      background: 'linear-gradient(135deg, #0e1a3a, #0a0e1a)',
                    }}>
                      <span className="text-[11px] font-black" style={{ color: '#4a7dff' }}>{def.cost}</span>
                    </div>
                    {/* Rarity accent line */}
                    <div className="w-0.5 h-4 rounded-full shrink-0" style={{
                      background: RARITY_COLORS[def.rarity],
                      boxShadow: `0 0 4px ${RARITY_COLORS[def.rarity]}40`,
                    }} />
                    {/* Card name */}
                    <span className="text-[11px] font-semibold truncate flex-1 min-w-0" style={{ color: '#c0c0d0' }}>
                      {t(def.nameKey)}
                    </span>
                    {/* Power */}
                    <span className="text-[10px] font-black shrink-0 mr-1" style={{ color: '#5a5a6a' }}>
                      {def.power}
                    </span>
                    {/* Remove button */}
                    <button onClick={() => removeCard(id)}
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mr-1 transition-all opacity-0 group-hover:opacity-100"
                      style={{ background: '#1a0808', color: '#ef4444', border: '1px solid #2a1515' }}
                      onMouseOver={e => (e.currentTarget.style.borderColor = '#ef444440')}
                      onMouseOut={e => (e.currentTarget.style.borderColor = '#2a1515')}
                    >
                      <svg viewBox="0 0 10 10" style={{ width: 8, height: 8 }}><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                );
              })}

              {/* Empty slots */}
              {activeDeck && Array.from({ length: Math.max(0, NC_DECK_SIZE - activeDeck.cards.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center justify-center mb-1 rounded-lg"
                  style={{
                    height: 36,
                    border: '1px dashed #1a1a2e',
                    opacity: 0.3 + (i === 0 ? 0.2 : 0),
                  }}>
                  <span className="text-[9px] font-semibold" style={{ color: '#1e1e3a' }}>—</span>
                </div>
              ))}
            </div>

            {/* Bottom stats: Mana curve + tag distribution */}
            <div className="shrink-0 px-3 py-3" style={{ borderTop: '1px solid #1a1a2e', background: '#0a0a12' }}>
              {/* Mana curve */}
              <div className="flex items-end gap-1 h-14 mb-2">
                {manaCurve.map((count, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full relative" style={{ height: 32 }}>
                      <div className="absolute bottom-0 left-0 right-0 rounded-t transition-all" style={{
                        height: count > 0 ? `${Math.max(12, (count / maxCurve) * 100)}%` : 0,
                        background: count > 0 ? 'linear-gradient(to top, #4a7dff55, #4a7dff22)' : 'transparent',
                        borderTop: count > 0 ? '1px solid #4a7dff33' : 'none',
                        borderLeft: count > 0 ? '1px solid #4a7dff33' : 'none',
                        borderRight: count > 0 ? '1px solid #4a7dff33' : 'none',
                        borderBottom: 'none',
                        transition: 'height 0.3s ease',
                      }} />
                      {count > 0 && (
                        <span className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-black" style={{
                          color: '#4a7dff', bottom: `${Math.max(12, (count / maxCurve) * 100)}%`,
                          transform: 'translateY(-2px)',
                        }}>
                          {count}
                        </span>
                      )}
                    </div>
                    <span className="text-[8px] font-bold" style={{ color: '#2a2a4a' }}>{i + 1}{i === 6 ? '+' : ''}</span>
                  </div>
                ))}
              </div>

              {/* Rarity distribution */}
              <div className="flex gap-1">
                {RARITY_ORDER.map(r => {
                  const count = deckStats.rarityCounts[r] ?? 0;
                  if (count === 0) return null;
                  return (
                    <div key={r} className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{
                      background: `${RARITY_COLORS[r]}08`,
                      border: `1px solid ${RARITY_COLORS[r]}20`,
                    }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: RARITY_COLORS[r] }} />
                      <span className="text-[8px] font-bold" style={{ color: RARITY_COLORS[r] }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
