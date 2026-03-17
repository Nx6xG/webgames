'use client';

import { useState, useCallback, useEffect } from 'react';
import type { NcPackType, NcRarity, NcPlayerProfile, NcCardDef } from 'shared';
import {
  NC_STANDARD_PACK_COST, NC_PREMIUM_PACK_COST, NC_CARDS_PER_PACK,
  NC_STANDARD_RATES, NC_PREMIUM_RATES, NC_DUPLICATE_SHARDS,
  NC_CARDS_BY_RARITY, NC_MAX_COPIES,
} from 'shared';
import { NexusClashCard } from './NexusClashCard';
import { useI18n } from '@/components/providers/LanguageProvider';

interface PackOpeningProps {
  profile: NcPlayerProfile;
  onUpdateProfile: (profile: NcPlayerProfile) => void;
  onClose: () => void;
}

interface RevealedCard {
  cardDef: NcCardDef;
  isDuplicate: boolean;
  refundShards: number;
  isNew: boolean;
  revealed: boolean;
}

function rollRarity(rates: Record<NcRarity, number>): NcRarity {
  const r = Math.random();
  let cumulative = 0;
  for (const rarity of ['legendary', 'epic', 'rare', 'common'] as NcRarity[]) {
    cumulative += rates[rarity];
    if (r < cumulative) return rarity;
  }
  return 'common';
}

function rollCard(rates: Record<NcRarity, number>): NcCardDef {
  const rarity = rollRarity(rates);
  const pool = NC_CARDS_BY_RARITY[rarity];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Currency icons (reused from main game)
function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" style={{ width: size, height: size }}>
      <circle cx="10" cy="10" r="8" fill="#c9a84c" stroke="#a07c2a" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="5.5" fill="none" stroke="#e8d48b" strokeWidth="0.8"/>
      <text x="10" y="13.5" textAnchor="middle" fill="#7a5c1a" fontSize="8" fontWeight="bold">C</text>
    </svg>
  );
}

function GemIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" style={{ width: size, height: size }}>
      <polygon points="10,2 16,7 14,17 6,17 4,7" fill="#7c3aed" stroke="#a78bfa" strokeWidth="1"/>
      <polygon points="10,2 12,7 10,15 8,7" fill="#9f67ff" opacity="0.5"/>
      <line x1="4" y1="7" x2="16" y2="7" stroke="#a78bfa" strokeWidth="0.8"/>
    </svg>
  );
}

export function PackOpening({ profile, onUpdateProfile, onClose }: PackOpeningProps) {
  const { t } = useI18n();
  const [selectedPack, setSelectedPack] = useState<NcPackType | null>(null);
  const [revealedCards, setRevealedCards] = useState<RevealedCard[]>([]);
  const [isOpening, setIsOpening] = useState(false);
  const [currentReveal, setCurrentReveal] = useState(-1);

  const canAfford = useCallback((packType: NcPackType) => {
    if (packType === 'standard') return profile.currencies.coins >= NC_STANDARD_PACK_COST;
    return profile.currencies.gems >= NC_PREMIUM_PACK_COST;
  }, [profile.currencies]);

  const openPack = useCallback((packType: NcPackType) => {
    if (!canAfford(packType)) return;

    const rates = packType === 'standard' ? NC_STANDARD_RATES : NC_PREMIUM_RATES;
    const cards: RevealedCard[] = [];
    const newProfile = { ...profile, currencies: { ...profile.currencies }, collection: { ...profile.collection, cards: { ...profile.collection.cards } } };

    if (packType === 'standard') {
      newProfile.currencies.coins -= NC_STANDARD_PACK_COST;
    } else {
      newProfile.currencies.gems -= NC_PREMIUM_PACK_COST;
    }

    for (let i = 0; i < NC_CARDS_PER_PACK; i++) {
      const cardDef = rollCard(rates);
      const currentOwned = newProfile.collection.cards[cardDef.id] ?? 0;
      const isDuplicate = currentOwned >= NC_MAX_COPIES;
      const refundShards = isDuplicate ? NC_DUPLICATE_SHARDS[cardDef.rarity] : 0;
      const isNew = currentOwned === 0;

      if (isDuplicate) {
        newProfile.currencies.shards = (newProfile.currencies.shards ?? 0) + refundShards;
      } else {
        newProfile.collection.cards[cardDef.id] = currentOwned + 1;
      }

      cards.push({ cardDef, isDuplicate, refundShards, isNew, revealed: false });
    }

    const rarityOrder: Record<NcRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
    cards.sort((a, b) => rarityOrder[a.cardDef.rarity] - rarityOrder[b.cardDef.rarity]);

    setRevealedCards(cards);
    setIsOpening(true);
    setCurrentReveal(-1);
    onUpdateProfile(newProfile);
  }, [profile, canAfford, onUpdateProfile]);

  useEffect(() => {
    if (!isOpening || revealedCards.length === 0) return;
    if (currentReveal >= revealedCards.length - 1) return;

    const timer = setTimeout(() => {
      setCurrentReveal(prev => {
        const next = prev + 1;
        setRevealedCards(cards => cards.map((c, i) => i === next ? { ...c, revealed: true } : c));
        return next;
      });
    }, currentReveal === -1 ? 600 : 800);

    return () => clearTimeout(timer);
  }, [isOpening, currentReveal, revealedCards.length]);

  const allRevealed = revealedCards.length > 0 && revealedCards.every(c => c.revealed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{
      background: 'radial-gradient(ellipse at center, #0a0a12ee, #050510ff)',
      backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div
        className="flex flex-col items-center gap-6"
        style={{
          width: '95vw',
          maxWidth: '700px',
          padding: '32px',
          background: 'linear-gradient(180deg, #12121f, #0e0e1a)',
          border: '1px solid #2a2a3a',
          borderRadius: '8px',
          boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 30px rgba(124,58,237,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between w-full">
          <h2 className="text-lg font-black uppercase tracking-[0.1em]" style={{ color: '#c9a84c' }}>{t('nc.pack.title')}</h2>
          <button onClick={onClose} className="text-xl leading-none transition-colors" style={{ color: '#5a5a6a' }}
            onMouseOver={e => (e.currentTarget.style.color = '#c9a84c')}
            onMouseOut={e => (e.currentTarget.style.color = '#5a5a6a')}
          >&times;</button>
        </div>

        {/* Currency display */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{
            background: 'linear-gradient(135deg, #1a1a08, #12121f)',
            border: '1px solid #c9a84c33',
          }}>
            <CoinIcon size={18} />
            <span className="text-sm font-bold" style={{ color: '#e8d48b' }}>{profile.currencies.coins}</span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#5a5a6a' }}>{t('nc.currency.coins')}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{
            background: 'linear-gradient(135deg, #1a0a2a, #12121f)',
            border: '1px solid #7c3aed33',
          }}>
            <GemIcon size={18} />
            <span className="text-sm font-bold" style={{ color: '#a78bfa' }}>{profile.currencies.gems}</span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#5a5a6a' }}>{t('nc.currency.gems')}</span>
          </div>
        </div>

        {/* Pack selection or reveal */}
        {!isOpening ? (
          <div className="flex gap-6">
            {/* Standard pack */}
            <button
              onClick={() => { setSelectedPack('standard'); openPack('standard'); }}
              disabled={!canAfford('standard')}
              className="flex flex-col items-center gap-3 p-5 rounded-lg w-52 transition-all"
              style={{
                background: canAfford('standard')
                  ? 'linear-gradient(180deg, #1a1a08, #12121f)'
                  : 'linear-gradient(180deg, #12121f, #0e0e1a)',
                border: canAfford('standard') ? '1px solid #c9a84c44' : '1px solid #1e1e3a',
                opacity: canAfford('standard') ? 1 : 0.4,
                cursor: canAfford('standard') ? 'pointer' : 'not-allowed',
                boxShadow: canAfford('standard') ? '0 0 20px rgba(201,168,76,0.05)' : 'none',
              }}
              onMouseOver={e => {
                if (canAfford('standard')) e.currentTarget.style.borderColor = '#c9a84c';
              }}
              onMouseOut={e => {
                if (canAfford('standard')) e.currentTarget.style.borderColor = '#c9a84c44';
              }}
            >
              {/* Pack visual */}
              <div className="w-16 h-20 rounded flex items-center justify-center" style={{
                background: 'linear-gradient(135deg, #2a2a08, #1a1a08)',
                border: '2px solid #c9a84c44',
              }}>
                <svg viewBox="0 0 24 24" className="w-8 h-8">
                  <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="#c9a84c" strokeWidth="1.5"/>
                  <polygon points="12,8 15,12 12,16 9,12" fill="#c9a84c44" stroke="#c9a84c" strokeWidth="0.8"/>
                </svg>
              </div>
              <p className="text-sm font-bold uppercase tracking-wider" style={{ color: '#c9a84c' }}>{t('nc.pack.standard')}</p>
              <div className="flex items-center gap-1">
                <CoinIcon size={14} />
                <span className="text-xs font-bold" style={{ color: '#e8d48b' }}>{NC_STANDARD_PACK_COST}</span>
              </div>
              <p className="text-[10px]" style={{ color: '#5a5a6a' }}>{NC_CARDS_PER_PACK} {t('nc.pack.cards')}</p>
            </button>

            {/* Premium pack */}
            <button
              onClick={() => { setSelectedPack('premium'); openPack('premium'); }}
              disabled={!canAfford('premium')}
              className="flex flex-col items-center gap-3 p-5 rounded-lg w-52 transition-all"
              style={{
                background: canAfford('premium')
                  ? 'linear-gradient(180deg, #1a0a2a, #12121f)'
                  : 'linear-gradient(180deg, #12121f, #0e0e1a)',
                border: canAfford('premium') ? '1px solid #7c3aed44' : '1px solid #1e1e3a',
                opacity: canAfford('premium') ? 1 : 0.4,
                cursor: canAfford('premium') ? 'pointer' : 'not-allowed',
                boxShadow: canAfford('premium') ? '0 0 20px rgba(124,58,237,0.05)' : 'none',
              }}
              onMouseOver={e => {
                if (canAfford('premium')) e.currentTarget.style.borderColor = '#a78bfa';
              }}
              onMouseOut={e => {
                if (canAfford('premium')) e.currentTarget.style.borderColor = '#7c3aed44';
              }}
            >
              <div className="w-16 h-20 rounded flex items-center justify-center" style={{
                background: 'linear-gradient(135deg, #1a0a3a, #12081a)',
                border: '2px solid #7c3aed44',
              }}>
                <svg viewBox="0 0 24 24" className="w-8 h-8">
                  <polygon points="12,2 20,8 18,18 6,18 4,8" fill="none" stroke="#a78bfa" strokeWidth="1.5"/>
                  <polygon points="12,4 17,8 16,16 8,16 7,8" fill="#7c3aed22"/>
                  <polygon points="12,6 15,9 14,14 10,14 9,9" fill="#7c3aed44"/>
                </svg>
              </div>
              <p className="text-sm font-bold uppercase tracking-wider" style={{ color: '#a78bfa' }}>{t('nc.pack.premium')}</p>
              <div className="flex items-center gap-1">
                <GemIcon size={14} />
                <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>{NC_PREMIUM_PACK_COST}</span>
              </div>
              <p className="text-[10px]" style={{ color: '#5a5a6a' }}>{t('nc.pack.premiumDesc')}</p>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            {/* Cards */}
            <div className="flex gap-4">
              {revealedCards.map((rc, i) => (
                <div
                  key={i}
                  className={[
                    'transition-all duration-500 transform',
                    rc.revealed ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                    rc.revealed && rc.cardDef.rarity === 'legendary' ? 'nc-legendary-reveal' : '',
                    rc.revealed && rc.cardDef.rarity === 'epic' ? 'nc-epic-reveal' : '',
                  ].join(' ')}
                >
                  {rc.revealed ? (
                    <div className="flex flex-col items-center gap-1">
                      <NexusClashCard
                        card={rc.cardDef}
                        showNew={rc.isNew}
                      />
                      {rc.isDuplicate && (
                        <div className="flex items-center gap-1 text-[10px]" style={{ color: '#67e8f9' }}>
                          <span>+{rc.refundShards}</span>
                          <svg viewBox="0 0 16 16" style={{ width: 10, height: 10 }}><polygon points="8,1 12,5 10,14 6,14 4,5" fill="#22d3ee" stroke="#67e8f9" strokeWidth="0.8"/><polygon points="4,4 5.5,5 4,11 2.5,5" fill="#22d3ee" opacity="0.4"/></svg>
                        </div>
                      )}
                    </div>
                  ) : (
                    <NexusClashCard card={rc.cardDef} faceDown />
                  )}
                </div>
              ))}
            </div>

            {/* Continue button */}
            {allRevealed && (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsOpening(false);
                    setRevealedCards([]);
                    setSelectedPack(null);
                  }}
                  className="px-5 py-2.5 rounded font-bold text-sm uppercase tracking-wider transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                    border: '1px solid #a78bfa',
                    color: 'white',
                    boxShadow: '0 0 15px rgba(124,58,237,0.2)',
                  }}
                >
                  {t('nc.pack.openAnother')}
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded text-sm font-semibold transition-all"
                  style={{
                    border: '1px solid #2a2a3a',
                    color: '#6a6a7a',
                    background: '#12121f',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.borderColor = '#c9a84c44';
                    e.currentTarget.style.color = '#c9a84c';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.borderColor = '#2a2a3a';
                    e.currentTarget.style.color = '#6a6a7a';
                  }}
                >
                  {t('nc.pack.done')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
