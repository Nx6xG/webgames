'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
}

type Phase = 'select' | 'shake' | 'burst' | 'reveal' | 'summary';

const RARITY_ORDER: Record<NcRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
const RARITY_COLOR: Record<NcRarity, string> = {
  common: '#71717a',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#c9a84c',
};

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

// Orbiting energy particles during shake
function EnergyOrbs({ color, intensity }: { color: string; intensity: number }) {
  const count = Math.floor(6 + intensity * 10);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (360 / count) * i;
        const radius = 70 + Math.sin(i * 1.3) * 20;
        const size = 2 + Math.random() * 3;
        const dur = 1.5 + Math.random() * 1;
        return (
          <div key={i} className="absolute left-1/2 top-1/2 rounded-full" style={{
            width: size,
            height: size,
            background: color,
            boxShadow: `0 0 ${size * 3}px ${color}, 0 0 ${size * 6}px ${color}88`,
            animation: `nc-orb-spin ${dur}s linear infinite`,
            '--orb-angle': `${angle}deg`,
            '--orb-radius': `${radius}px`,
            opacity: Math.min(intensity * 1.5, 1),
          } as React.CSSProperties} />
        );
      })}
    </div>
  );
}

// Explosion particles
function BurstParticles({ color, count }: { color: string; count: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (360 / count) * i + Math.random() * 20;
        const dist = 80 + Math.random() * 120;
        const size = 3 + Math.random() * 5;
        const delay = Math.random() * 0.15;
        return (
          <div key={i} className="absolute left-1/2 top-1/2 rounded-full" style={{
            width: size,
            height: size,
            background: color,
            boxShadow: `0 0 ${size * 2}px ${color}`,
            animation: `nc-burst-particle 0.9s ${delay}s ease-out forwards`,
            '--bp-angle': `${angle}deg`,
            '--bp-dist': `${dist}px`,
            opacity: 0,
          } as React.CSSProperties} />
        );
      })}
    </div>
  );
}

// Light rays emanating from center
function LightRays({ color, count = 12 }: { color: string; count?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{
      animation: 'nc-rays-fade 1.2s ease-out forwards',
    }}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (360 / count) * i;
        const width = 2 + Math.random() * 3;
        return (
          <div key={i} className="absolute left-1/2 top-1/2 origin-bottom" style={{
            width: `${width}px`,
            height: '300px',
            background: `linear-gradient(to top, ${color}66, ${color}22, transparent)`,
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            filter: 'blur(2px)',
          }} />
        );
      })}
    </div>
  );
}

export function PackOpening({ profile, onUpdateProfile, onClose }: PackOpeningProps) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>('select');
  const [packType, setPackType] = useState<NcPackType | null>(null);
  const [cards, setCards] = useState<RevealedCard[]>([]);
  const [revealedSet, setRevealedSet] = useState<Set<number>>(new Set());
  const [bestRarity, setBestRarity] = useState<NcRarity>('common');
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [shakeProgress, setShakeProgress] = useState(0);
  const [envColor, setEnvColor] = useState<string | null>(null);
  const [showRays, setShowRays] = useState(false);
  const [showInfo, setShowInfo] = useState<NcPackType | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canAfford = useCallback((pt: NcPackType) => {
    if (pt === 'standard') return profile.currencies.coins >= NC_STANDARD_PACK_COST;
    return profile.currencies.gems >= NC_PREMIUM_PACK_COST;
  }, [profile.currencies]);

  const openPack = useCallback((pt: NcPackType) => {
    if (!canAfford(pt)) return;

    const rates = pt === 'standard' ? NC_STANDARD_RATES : NC_PREMIUM_RATES;
    const rolled: RevealedCard[] = [];
    const newProfile = { ...profile, currencies: { ...profile.currencies }, collection: { ...profile.collection, cards: { ...profile.collection.cards } } };

    if (pt === 'standard') {
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

      rolled.push({ cardDef, isDuplicate, refundShards, isNew });
    }

    // Random order — no sorting
    const best = rolled.reduce((b, c) => RARITY_ORDER[c.cardDef.rarity] > RARITY_ORDER[b] ? c.cardDef.rarity : b, 'common' as NcRarity);

    setCards(rolled);
    setPackType(pt);
    setBestRarity(best);
    setRevealedSet(new Set());
    setPhase('shake');
    onUpdateProfile(newProfile);
  }, [profile, canAfford, onUpdateProfile]);

  // Phase: shake → burst → reveal
  useEffect(() => {
    if (phase === 'shake') {
      let frame = 0;
      const maxFrames = 36; // ~1.8s
      const interval = setInterval(() => {
        frame++;
        setShakeProgress(frame / maxFrames);
        if (frame >= maxFrames) {
          clearInterval(interval);
          setPhase('burst');
        }
      }, 50);
      return () => clearInterval(interval);
    }

    if (phase === 'burst') {
      setFlashColor(RARITY_COLOR[bestRarity]);
      setShowRays(true);
      const t1 = setTimeout(() => setFlashColor(null), 500);
      const t2 = setTimeout(() => setShowRays(false), 1200);
      const t3 = setTimeout(() => {
        setPhase('reveal');
      }, 800);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [phase, bestRarity]);

  // When all cards revealed, go to summary
  useEffect(() => {
    if (phase !== 'reveal') return;
    if (revealedSet.size === cards.length && cards.length > 0) {
      const t = setTimeout(() => setPhase('summary'), 1200);
      return () => clearTimeout(t);
    }
  }, [phase, revealedSet.size, cards.length]);

  const revealCard = useCallback((index: number) => {
    if (phase !== 'reveal' || revealedSet.has(index)) return;

    const card = cards[index];
    const rarity = card.cardDef.rarity;

    setRevealedSet(prev => new Set(prev).add(index));

    // Environment color shift for epic/legendary
    if (rarity === 'epic' || rarity === 'legendary') {
      setFlashColor(RARITY_COLOR[rarity]);
      setEnvColor(RARITY_COLOR[rarity]);
      setTimeout(() => setFlashColor(null), rarity === 'legendary' ? 600 : 350);
      setTimeout(() => setEnvColor(null), rarity === 'legendary' ? 2000 : 1000);
    }

    // Screen shake for legendary
    if (rarity === 'legendary' && containerRef.current) {
      containerRef.current.classList.add('nc-screen-shake');
      setTimeout(() => containerRef.current?.classList.remove('nc-screen-shake'), 500);
    }
  }, [phase, revealedSet, cards]);

  // Reveal all remaining cards at once
  const revealAll = useCallback(() => {
    if (phase !== 'reveal') return;
    const allIndices = new Set(cards.map((_, i) => i));
    setRevealedSet(allIndices);

    // Flash for best unrevealed rarity
    const unrevealed = cards.filter((_, i) => !revealedSet.has(i));
    const bestUnrevealed = unrevealed.reduce((b, c) => RARITY_ORDER[c.cardDef.rarity] > RARITY_ORDER[b] ? c.cardDef.rarity : b, 'common' as NcRarity);
    if (bestUnrevealed === 'epic' || bestUnrevealed === 'legendary') {
      setFlashColor(RARITY_COLOR[bestUnrevealed]);
      setTimeout(() => setFlashColor(null), 400);
    }
  }, [phase, cards, revealedSet]);

  const resetToSelect = () => {
    setPhase('select');
    setCards([]);
    setPackType(null);
    setRevealedSet(new Set());
    setBestRarity('common');
    setEnvColor(null);
    setShowRays(false);
  };

  const isPremium = packType === 'premium';
  const packColor = isPremium ? '#a78bfa' : '#c9a84c';
  const allRevealed = revealedSet.size === cards.length && cards.length > 0;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center" style={{
      background: envColor
        ? `radial-gradient(ellipse at center, ${envColor}18, #0a0a12ee, #050510ff)`
        : 'radial-gradient(ellipse at center, #0a0a12ee, #050510ff)',
      backdropFilter: 'blur(8px)',
      transition: 'background 0.8s ease',
    }} onClick={phase === 'select' || phase === 'summary' ? onClose : undefined}>

      {/* Full-screen flash */}
      {flashColor && (
        <div className="fixed inset-0 z-[60] pointer-events-none nc-flash" style={{
          background: `radial-gradient(circle at center, ${flashColor}55, ${flashColor}22, transparent 70%)`,
        }} />
      )}

      {/* Light rays on burst */}
      {showRays && (
        <div className="fixed inset-0 z-[55] pointer-events-none flex items-center justify-center">
          <LightRays color={RARITY_COLOR[bestRarity]} />
        </div>
      )}

      {/* Ambient vignette for rarity environment */}
      {envColor && (
        <div className="fixed inset-0 z-[51] pointer-events-none" style={{
          boxShadow: `inset 0 0 200px ${envColor}22, inset 0 0 100px ${envColor}11`,
          transition: 'box-shadow 0.5s ease',
        }} />
      )}

      <div
        className="flex flex-col items-center gap-6 relative z-[52]"
        style={{
          width: '98vw',
          maxWidth: phase === 'reveal' || phase === 'summary' ? '800px' : '700px',
          padding: '16px 12px',
          background: 'linear-gradient(180deg, #12121fdd, #0e0e1add)',
          border: `1px solid ${phase === 'select' ? '#2a2a3a' : RARITY_COLOR[bestRarity] + '33'}`,
          borderRadius: '16px',
          boxShadow: phase !== 'select'
            ? `0 0 80px ${RARITY_COLOR[bestRarity]}15, 0 0 30px rgba(0,0,0,0.5)`
            : '0 0 60px rgba(0,0,0,0.5)',
          transition: 'border-color 0.5s, box-shadow 0.5s, max-width 0.3s',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <h2 className="text-lg font-black uppercase tracking-[0.1em]" style={{ color: '#c9a84c' }}>
            {t('nc.pack.title')}
          </h2>
          {(phase === 'select' || phase === 'summary') && (
            <button onClick={onClose} className="text-xl leading-none transition-colors" style={{ color: '#5a5a6a' }}
              onMouseOver={e => (e.currentTarget.style.color = '#c9a84c')}
              onMouseOut={e => (e.currentTarget.style.color = '#5a5a6a')}
            >&times;</button>
          )}
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

        {/* ── PHASE: Select Pack ── */}
        {phase === 'select' && (
          <div className="flex gap-6 nc-fade-in">
            {(['standard', 'premium'] as NcPackType[]).map(pt => {
              const afford = canAfford(pt);
              const isPrem = pt === 'premium';
              const color = isPrem ? '#a78bfa' : '#c9a84c';
              const darkColor = isPrem ? '#7c3aed' : '#a07c2a';
              const cost = isPrem ? NC_PREMIUM_PACK_COST : NC_STANDARD_PACK_COST;
              const rates = isPrem ? NC_PREMIUM_RATES : NC_STANDARD_RATES;
              const infoOpen = showInfo === pt;
              const rarities = isPrem
                ? (['rare', 'epic', 'legendary'] as NcRarity[])
                : (['common', 'rare', 'epic', 'legendary'] as NcRarity[]);

              return (
                <div key={pt} className="flex flex-col items-center w-52">
                  <button
                    onClick={() => openPack(pt)}
                    disabled={!afford}
                    className="flex flex-col items-center gap-3 p-5 rounded-lg w-full transition-all group"
                    style={{
                      background: afford
                        ? `linear-gradient(180deg, ${isPrem ? '#1a0a2a' : '#1a1a08'}, #12121f)`
                        : 'linear-gradient(180deg, #12121f, #0e0e1a)',
                      border: afford ? `1px solid ${color}44` : '1px solid #1e1e3a',
                      opacity: afford ? 1 : 0.4,
                      cursor: afford ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {/* Pack visual */}
                    <div className="relative w-20 h-28 rounded-lg flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105" style={{
                      background: `linear-gradient(135deg, ${darkColor}22, ${color}08)`,
                      border: `2px solid ${color}55`,
                      boxShadow: afford ? `0 0 20px ${color}15` : 'none',
                    }}>
                      <div className="absolute inset-0" style={{
                        background: `repeating-linear-gradient(135deg, transparent, transparent 8px, ${color}08 8px, ${color}08 9px)`,
                      }} />
                      <svg viewBox="0 0 40 40" className="w-10 h-10 relative z-10" style={{ filter: `drop-shadow(0 0 6px ${color}44)` }}>
                        {isPrem ? (
                          <>
                            <polygon points="20,4 32,14 28,34 12,34 8,14" fill="none" stroke={color} strokeWidth="1.5"/>
                            <polygon points="20,8 28,15 26,30 14,30 12,15" fill={`${color}22`}/>
                            <polygon points="20,12 24,16 23,26 17,26 16,16" fill={`${color}33`}/>
                          </>
                        ) : (
                          <>
                            <rect x="8" y="8" width="24" height="24" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
                            <polygon points="20,12 26,18 20,24 14,18" fill={`${color}33`} stroke={color} strokeWidth="0.8"/>
                          </>
                        )}
                      </svg>
                      <div className="absolute bottom-1.5 w-6 h-1 rounded-full" style={{ background: `${color}44` }} />
                    </div>

                    <p className="text-sm font-bold uppercase tracking-wider" style={{ color }}>
                      {isPrem ? t('nc.pack.premium') : t('nc.pack.standard')}
                    </p>
                    <div className="flex items-center gap-1">
                      {isPrem ? <GemIcon size={14} /> : <CoinIcon size={14} />}
                      <span className="text-xs font-bold" style={{ color }}>{cost}</span>
                    </div>
                    <p className="text-[10px]" style={{ color: '#5a5a6a' }}>
                      {isPrem ? t('nc.pack.premiumDesc') : `${NC_CARDS_PER_PACK} ${t('nc.pack.cards')}`}
                    </p>
                  </button>

                  {/* Per-pack info toggle */}
                  <button
                    onClick={() => setShowInfo(prev => prev === pt ? null : pt)}
                    className="flex items-center gap-1 mt-2 text-[10px] font-semibold uppercase tracking-wider transition-colors"
                    style={{ color: infoOpen ? color : '#4a4a5a' }}
                    onMouseOver={e => (e.currentTarget.style.color = color)}
                    onMouseOut={e => (e.currentTarget.style.color = infoOpen ? color : '#4a4a5a')}
                  >
                    <svg viewBox="0 0 16 16" style={{ width: 12, height: 12 }}>
                      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                      <text x="8" y="11.5" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="bold">i</text>
                    </svg>
                    {t('nc.pack.dropRates')}
                    <svg viewBox="0 0 12 12" style={{ width: 8, height: 8, transform: infoOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                      <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>

                  {/* Drop rates panel */}
                  {infoOpen && (
                    <div className="mt-2 w-full rounded-lg p-3 nc-fade-in" style={{
                      background: `linear-gradient(180deg, ${isPrem ? '#140a22' : '#14140a'}, #12121f)`,
                      border: `1px solid ${color}22`,
                    }}>
                      {rarities.map(r => (
                        <div key={r} className="flex items-center justify-between py-0.5">
                          <span className="text-[11px] font-semibold capitalize" style={{ color: RARITY_COLOR[r] }}>{r}</span>
                          <span className="text-[11px] font-bold" style={{ color: '#8a8a9a' }}>{(rates[r] * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                      <div className="mt-1.5 pt-1.5" style={{ borderTop: `1px solid ${color}11` }}>
                        <p className="text-[10px] text-center" style={{ color: '#4a4a5a' }}>
                          {NC_CARDS_PER_PACK} {t('nc.pack.cards')} / Pack
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── PHASE: Pack Shake ── */}
        {phase === 'shake' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="relative" style={{
              animation: `nc-shake ${Math.max(0.08, 0.16 - shakeProgress * 0.1)}s infinite`,
              '--shake-px': `${2 + shakeProgress * 14}px`,
            } as React.CSSProperties}>

              {/* Orbiting energy particles */}
              <EnergyOrbs color={RARITY_COLOR[bestRarity]} intensity={shakeProgress} />

              {/* Growing glow aura */}
              <div className="absolute rounded-full" style={{
                inset: `-${20 + shakeProgress * 40}px`,
                background: `radial-gradient(circle, ${RARITY_COLOR[bestRarity]}${Math.round(shakeProgress * 35).toString(16).padStart(2, '0')}, transparent 70%)`,
                transition: 'inset 0.1s',
              }} />

              {/* The pack — floats upward as shake intensifies */}
              <div className="relative w-32 h-44 rounded-xl flex items-center justify-center overflow-hidden" style={{
                background: `linear-gradient(135deg, ${isPremium ? '#1a0a2a' : '#1a1a08'}, #12121f)`,
                border: `2px solid ${packColor}`,
                boxShadow: `0 0 ${20 + shakeProgress * 50}px ${RARITY_COLOR[bestRarity]}${Math.round(shakeProgress * 70).toString(16).padStart(2, '0')}`,
                transform: `translateY(${-shakeProgress * 12}px)`,
                transition: 'transform 0.3s ease',
              }}>
                <div className="absolute inset-0" style={{
                  background: `repeating-linear-gradient(135deg, transparent, transparent 8px, ${packColor}08 8px, ${packColor}08 9px)`,
                }} />
                <svg viewBox="0 0 40 40" className="w-14 h-14 relative z-10" style={{
                  filter: `drop-shadow(0 0 ${8 + shakeProgress * 12}px ${packColor}88)`,
                  transition: 'filter 0.2s',
                }}>
                  {isPremium ? (
                    <>
                      <polygon points="20,4 32,14 28,34 12,34 8,14" fill="none" stroke={packColor} strokeWidth="1.5"/>
                      <polygon points="20,8 28,15 26,30 14,30 12,15" fill={`${packColor}22`}/>
                    </>
                  ) : (
                    <>
                      <rect x="8" y="8" width="24" height="24" rx="3" fill="none" stroke={packColor} strokeWidth="1.5"/>
                      <polygon points="20,12 26,18 20,24 14,18" fill={`${packColor}33`} stroke={packColor} strokeWidth="0.8"/>
                    </>
                  )}
                </svg>

                {/* Cracks appear and grow */}
                {shakeProgress > 0.4 && (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 140" style={{ opacity: Math.min((shakeProgress - 0.4) * 2.5, 1) }}>
                    <path d="M50 0 L47 20 L54 40 L44 65 L52 90 L48 110 L50 140" fill="none" stroke={RARITY_COLOR[bestRarity]} strokeWidth="1.5" strokeLinecap="round" style={{
                      strokeDasharray: '200',
                      strokeDashoffset: `${200 - (shakeProgress - 0.4) * 333}`,
                    }}/>
                    {shakeProgress > 0.6 && (
                      <path d="M25 50 L44 65 L70 45" fill="none" stroke={RARITY_COLOR[bestRarity]} strokeWidth="1" opacity="0.7" strokeLinecap="round"/>
                    )}
                    {shakeProgress > 0.75 && (
                      <path d="M75 80 L52 90 L30 100" fill="none" stroke={RARITY_COLOR[bestRarity]} strokeWidth="1" opacity="0.5" strokeLinecap="round"/>
                    )}
                  </svg>
                )}

                {/* Inner glow intensifies */}
                <div className="absolute inset-0" style={{
                  background: `radial-gradient(circle at center, ${RARITY_COLOR[bestRarity]}${Math.round(shakeProgress * 30).toString(16).padStart(2, '0')}, transparent 60%)`,
                }} />
              </div>
            </div>

            <p className="text-xs font-semibold uppercase tracking-widest mt-2" style={{
              color: `${RARITY_COLOR[bestRarity]}88`,
              opacity: shakeProgress > 0.3 ? 1 : 0,
              transition: 'opacity 0.3s',
            }}>
              {shakeProgress > 0.7 ? '...' : ''}
            </p>
          </div>
        )}

        {/* ── PHASE: Burst ── */}
        {phase === 'burst' && (
          <div className="flex flex-col items-center py-8 relative" style={{ minHeight: 200 }}>
            <BurstParticles color={RARITY_COLOR[bestRarity]} count={32} />

            {/* Pack fragments fly apart */}
            <div className="relative w-32 h-44 flex items-center justify-center nc-burst-container">
              {/* Left half */}
              <div className="absolute nc-frag-left" style={{
                width: '50%', height: '100%', left: 0, top: 0,
                background: `linear-gradient(135deg, ${isPremium ? '#1a0a2a' : '#1a1a08'}, #12121f)`,
                borderRadius: '12px 0 0 12px',
                border: `2px solid ${packColor}`,
                borderRight: 'none',
                overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(135deg, transparent, transparent 8px, ${packColor}08 8px, ${packColor}08 9px)` }} />
              </div>
              {/* Right half */}
              <div className="absolute nc-frag-right" style={{
                width: '50%', height: '100%', right: 0, top: 0,
                background: `linear-gradient(135deg, ${isPremium ? '#1a0a2a' : '#1a1a08'}, #12121f)`,
                borderRadius: '0 12px 12px 0',
                border: `2px solid ${packColor}`,
                borderLeft: 'none',
                overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(135deg, transparent, transparent 8px, ${packColor}08 8px, ${packColor}08 9px)` }} />
              </div>

              {/* Energy explosion in the center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="nc-energy-burst" style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: RARITY_COLOR[bestRarity],
                  boxShadow: `0 0 30px ${RARITY_COLOR[bestRarity]}, 0 0 60px ${RARITY_COLOR[bestRarity]}88`,
                }} />
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE: Card Reveal (click to flip) ── */}
        {phase === 'reveal' && (
          <div className="flex flex-col items-center gap-5">
            <p className="text-xs font-semibold uppercase tracking-widest nc-fade-in" style={{ color: '#6a6a7a' }}>
              {allRevealed ? t('nc.pack.allRevealed') ?? '' : t('nc.pack.tapToReveal') ?? 'Tippe um aufzudecken'}
            </p>

            <div className="flex gap-2 sm:gap-4 items-center flex-wrap justify-center" style={{ minHeight: 180 }}>
              {cards.map((rc, i) => {
                const isRevealed = revealedSet.has(i);
                const rarity = rc.cardDef.rarity;
                const color = RARITY_COLOR[rarity];

                return (
                  <div key={i} className="flex flex-col items-center relative"
                    onClick={() => revealCard(i)}
                    style={{ cursor: isRevealed ? 'default' : 'pointer' }}
                  >
                    {/* Reveal burst particles */}
                    {isRevealed && (rarity === 'epic' || rarity === 'legendary') && (
                      <div className="absolute inset-0 z-10 pointer-events-none">
                        <BurstParticles color={color} count={rarity === 'legendary' ? 24 : 14} />
                      </div>
                    )}

                    {/* 3D flip container */}
                    <div className="relative" style={{
                      perspective: '600px',
                      width: 112,
                      height: 160,
                    }}>
                      <div className="absolute inset-0 transition-transform duration-700" style={{
                        transformStyle: 'preserve-3d',
                        transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}>
                        {/* Card back */}
                        <div className="absolute inset-0" style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                        }}>
                          <div className="w-full h-full rounded-lg flex items-center justify-center overflow-hidden" style={{
                            background: 'linear-gradient(135deg, #1a1a2e, #12121f)',
                            border: '2px solid #2a2a3a',
                          }}>
                            <div className="absolute inset-0" style={{
                              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(201,168,76,0.04) 4px, rgba(201,168,76,0.04) 8px)',
                            }} />
                            <svg viewBox="0 0 20 20" className="w-8 h-8" style={{ opacity: 0.2 }}>
                              <polygon points="10,2 18,10 10,18 2,10" fill="#c9a84c"/>
                            </svg>
                          </div>
                        </div>

                        {/* Card front (rotated 180deg so it shows correctly when flipped) */}
                        <div className="absolute inset-0" style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                        }}>
                          <div className={isRevealed ? `nc-card-${rarity}-land` : ''}>
                            <NexusClashCard card={rc.cardDef} showNew={rc.isNew} showPreview={false} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rarity glow behind revealed card */}
                    {isRevealed && rarity !== 'common' && (
                      <div className="absolute -inset-3 rounded-xl pointer-events-none z-0" style={{
                        background: `radial-gradient(circle, ${color}22, transparent 70%)`,
                        animation: rarity === 'legendary' ? 'nc-legendary-pulse 2s infinite' : undefined,
                      }} />
                    )}

                    {/* Info below card */}
                    {isRevealed && (
                      <div className="flex flex-col items-center mt-1.5 nc-fade-in">
                        {rc.isDuplicate && (
                          <div className="flex items-center gap-1 text-[10px]" style={{ color: '#67e8f9' }}>
                            <span>+{rc.refundShards}</span>
                            <svg viewBox="0 0 16 16" style={{ width: 10, height: 10 }}>
                              <polygon points="8,1 12,5 10,14 6,14 4,5" fill="#22d3ee" stroke="#67e8f9" strokeWidth="0.8"/>
                            </svg>
                          </div>
                        )}
                        {rc.isNew && !rc.isDuplicate && (
                          <div className="text-[9px] font-black uppercase tracking-wider" style={{
                            color, textShadow: `0 0 8px ${color}66`,
                          }}>NEU</div>
                        )}
                        {rarity !== 'common' && (
                          <div className="text-[9px] font-black uppercase tracking-widest" style={{
                            color, textShadow: `0 0 6px ${color}44`,
                          }}>{rarity}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reveal All button */}
            {!allRevealed && revealedSet.size > 0 && (
              <button onClick={revealAll}
                className="text-xs font-semibold uppercase tracking-wider px-4 py-1.5 rounded transition-all nc-fade-in"
                style={{ color: '#5a5a6a', border: '1px solid #2a2a3a', background: '#12121f' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#4a4a5a'; e.currentTarget.style.color = '#8a8a9a'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#2a2a3a'; e.currentTarget.style.color = '#5a5a6a'; }}
              >
                {t('nc.pack.revealAll') ?? 'Alle aufdecken'}
              </button>
            )}
          </div>
        )}

        {/* ── PHASE: Summary ── */}
        {phase === 'summary' && (
          <div className="flex flex-col items-center gap-6 nc-fade-in">
            <div className="flex gap-2 sm:gap-4 flex-wrap justify-center">
              {cards.map((rc, i) => {
                const rarity = rc.cardDef.rarity;
                const color = RARITY_COLOR[rarity];
                return (
                  <div key={i} className="flex flex-col items-center relative">
                    {rarity !== 'common' && (
                      <div className="absolute -inset-2 rounded-xl pointer-events-none" style={{
                        background: `radial-gradient(circle, ${color}18, transparent 70%)`,
                        animation: rarity === 'legendary' ? 'nc-legendary-pulse 2s infinite' : undefined,
                      }} />
                    )}
                    <NexusClashCard card={rc.cardDef} showNew={rc.isNew} />
                    {rc.isDuplicate && (
                      <div className="flex items-center gap-1 text-[10px] mt-1" style={{ color: '#67e8f9' }}>
                        <span>+{rc.refundShards}</span>
                        <svg viewBox="0 0 16 16" style={{ width: 10, height: 10 }}>
                          <polygon points="8,1 12,5 10,14 6,14 4,5" fill="#22d3ee" stroke="#67e8f9" strokeWidth="0.8"/>
                        </svg>
                      </div>
                    )}
                    {rc.isNew && !rc.isDuplicate && (
                      <div className="text-[9px] font-black uppercase tracking-wider mt-1" style={{
                        color, textShadow: `0 0 8px ${color}66`,
                      }}>NEU</div>
                    )}
                    {rarity !== 'common' && (
                      <div className="text-[9px] font-black uppercase tracking-widest mt-0.5" style={{
                        color, textShadow: `0 0 6px ${color}44`,
                      }}>{rarity}</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={resetToSelect}
                className="px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  border: '1px solid #a78bfa',
                  color: 'white',
                  boxShadow: '0 0 15px rgba(124,58,237,0.2)',
                }}
              >
                {t('nc.pack.openAnother')}
              </button>
              <button onClick={onClose}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ border: '1px solid #2a2a3a', color: '#6a6a7a', background: '#12121f' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#c9a84c44'; e.currentTarget.style.color = '#c9a84c'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#2a2a3a'; e.currentTarget.style.color = '#6a6a7a'; }}
              >
                {t('nc.pack.done')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Animations ── */}
      <style jsx global>{`
        /* Shake with variable intensity */
        @keyframes nc-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          20% { transform: translateX(calc(var(--shake-px) * -1)) rotate(-1.5deg); }
          40% { transform: translateX(var(--shake-px)) rotate(1.5deg); }
          60% { transform: translateX(calc(var(--shake-px) * -0.7)) rotate(-1deg); }
          80% { transform: translateX(calc(var(--shake-px) * 0.7)) rotate(1deg); }
        }

        /* Orbiting energy particles */
        @keyframes nc-orb-spin {
          0% { transform: translate(-50%, -50%) rotate(var(--orb-angle)) translateY(calc(var(--orb-radius) * -1)); opacity: 0.3; }
          50% { opacity: 1; }
          100% { transform: translate(-50%, -50%) rotate(calc(var(--orb-angle) + 360deg)) translateY(calc(var(--orb-radius) * -1)); opacity: 0.3; }
        }

        /* Burst particles fly outward */
        @keyframes nc-burst-particle {
          0% { transform: translate(-50%, -50%) rotate(var(--bp-angle)) translateY(0); opacity: 1; }
          70% { opacity: 0.8; }
          100% { transform: translate(-50%, -50%) rotate(var(--bp-angle)) translateY(calc(var(--bp-dist) * -1)); opacity: 0; }
        }

        /* Flash overlay */
        .nc-flash { animation: nc-flash-anim 0.5s ease-out forwards; }
        @keyframes nc-flash-anim {
          0% { opacity: 0; }
          15% { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Light rays fade in and out */
        @keyframes nc-rays-fade {
          0% { opacity: 0; transform: scale(0.5); }
          20% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.5); }
        }

        /* Pack fragment animations */
        .nc-frag-left { animation: nc-frag-l 0.7s cubic-bezier(0.2, 0.8, 0.3, 1) forwards; }
        @keyframes nc-frag-l {
          0% { transform: translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateX(-80px) rotate(-20deg) translateY(30px); opacity: 0; }
        }
        .nc-frag-right { animation: nc-frag-r 0.7s cubic-bezier(0.2, 0.8, 0.3, 1) forwards; }
        @keyframes nc-frag-r {
          0% { transform: translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateX(80px) rotate(20deg) translateY(30px); opacity: 0; }
        }

        /* Energy burst in center */
        .nc-energy-burst {
          animation: nc-energy-burst-anim 0.6s ease-out forwards;
        }
        @keyframes nc-energy-burst-anim {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(6); opacity: 0.6; }
          100% { transform: scale(12); opacity: 0; }
        }

        /* Screen shake (applied to the root container) */
        .nc-screen-shake {
          animation: nc-screen-shake-anim 0.5s ease-out;
        }
        @keyframes nc-screen-shake-anim {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-4px, 2px); }
          20% { transform: translate(4px, -3px); }
          30% { transform: translate(-3px, 4px); }
          40% { transform: translate(3px, -2px); }
          50% { transform: translate(-2px, 3px); }
          60% { transform: translate(2px, -1px); }
          70% { transform: translate(-1px, 2px); }
          80% { transform: translate(1px, -1px); }
        }

        /* Card landing animations per rarity */
        .nc-card-common-land {
          animation: nc-common-land 0.5s ease-out;
        }
        @keyframes nc-common-land {
          0% { transform: scale(0.8); opacity: 0.5; }
          60% { transform: scale(1.03); opacity: 1; }
          100% { transform: scale(1); }
        }

        .nc-card-rare-land {
          animation: nc-rare-land 0.6s ease-out;
        }
        @keyframes nc-rare-land {
          0% { transform: scale(0.7); opacity: 0; }
          50% { transform: scale(1.08); opacity: 1; }
          70% { transform: scale(0.97); }
          100% { transform: scale(1); }
        }

        .nc-card-epic-land {
          animation: nc-epic-land 0.7s ease-out;
        }
        @keyframes nc-epic-land {
          0% { transform: scale(0.5) rotateZ(-5deg); opacity: 0; filter: brightness(2.5); }
          40% { transform: scale(1.12) rotateZ(2deg); opacity: 1; filter: brightness(1.8); }
          60% { transform: scale(0.96) rotateZ(-1deg); filter: brightness(1.3); }
          80% { transform: scale(1.04) rotateZ(0); filter: brightness(1.1); }
          100% { transform: scale(1) rotateZ(0); filter: brightness(1); }
        }

        .nc-card-legendary-land {
          animation: nc-legendary-land 0.9s ease-out;
        }
        @keyframes nc-legendary-land {
          0% { transform: scale(0.3) rotateZ(-10deg); opacity: 0; filter: brightness(4) saturate(2); }
          30% { transform: scale(1.2) rotateZ(3deg); opacity: 1; filter: brightness(2.5) saturate(1.5); }
          50% { transform: scale(0.92) rotateZ(-2deg); filter: brightness(1.8); }
          65% { transform: scale(1.1) rotateZ(1deg); filter: brightness(1.4); }
          80% { transform: scale(0.98) rotateZ(0); filter: brightness(1.15); }
          100% { transform: scale(1) rotateZ(0); filter: brightness(1); }
        }

        /* Legendary persistent glow pulse */
        @keyframes nc-legendary-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }

        /* Generic fade in */
        .nc-fade-in {
          animation: nc-fade-in-anim 0.4s ease-out;
        }
        @keyframes nc-fade-in-anim {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
