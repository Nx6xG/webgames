'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type {
  NexusClashState, NexusClashAction, NcLane,
  NcPendingPlay, NcLaneModifier, NcResolveEvent,
} from 'shared';
import { NC_CARD_MAP, NC_CARDS, NC_SHARD_PRICES, NC_MAX_COPIES, getNcDailyReward } from 'shared';
import type { NcRarity, NcBotDifficulty } from 'shared';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import type { GameComponentProps } from '@/lib/gameRegistry';
import { WaitingForConnectionOverlay } from '@/components/WaitingForConnectionOverlay';
import { CountdownOverlay } from '@/components/CountdownOverlay';
import { ChatPanelWithProfile as ChatPanel } from '@/components/chat/ChatPanelWithProfile';
import { useI18n } from '@/components/providers/LanguageProvider';
import { SpectatorBanner } from '@/components/ui/SpectatorBanner';
import { ReconnectBanner } from '@/components/ui/ReconnectBanner';
import { useAutoJoin } from '@/hooks/useAutoJoin';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { NexusClashCard } from './NexusClashCard';
import { DeckBuilder } from './DeckBuilder';
import { PackOpening } from './PackOpening';
import { Collection } from './Collection';
import { QuestTracker } from './QuestTracker';
import { useNcProfile } from './NcProfileManager';
import { NexusClashTutorial } from './NexusClashTutorial';
import { ncAudio } from './NexusClashAudio';

// ── Modifier SVG Icons ───────────────────────────────────────────────────────

function ModifierIcon({ modifier }: { modifier: NcLaneModifier }) {
  const iconMap: Record<NcLaneModifier, React.ReactNode> = {
    cost_reduction: (
      <svg viewBox="0 0 20 20" className="w-4 h-4"><path d="M10 3L10 17M10 17L5 12M10 17L15 12" stroke="#c9a84c" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
    ),
    double_first: (
      <svg viewBox="0 0 20 20" className="w-4 h-4"><text x="3" y="15" fill="#c9a84c" fontSize="14" fontWeight="bold">x2</text></svg>
    ),
    indestructible: (
      <svg viewBox="0 0 20 20" className="w-4 h-4"><path d="M10 2L16 6V11C16 14.5 13 17 10 18C7 17 4 14.5 4 11V6L10 2Z" fill="none" stroke="#c9a84c" strokeWidth="1.5"/></svg>
    ),
    inverted_power: (
      <svg viewBox="0 0 20 20" className="w-4 h-4"><path d="M5 10H15M5 10L8 7M5 10L8 13M15 10L12 7M15 10L12 13" stroke="#c9a84c" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
    ),
    power_surge: (
      <svg viewBox="0 0 20 20" className="w-4 h-4"><path d="M11 2L5 11H9.5L8 18L15 9H10.5L11 2Z" fill="#c9a84c"/></svg>
    ),
    mana_drain: (
      <svg viewBox="0 0 20 20" className="w-4 h-4"><path d="M10 3C10 3 4 8 4 12A6 6 0 0016 12C16 8 10 3 10 3Z" fill="none" stroke="#c9a84c" strokeWidth="1.5"/><line x1="6" y1="6" x2="14" y2="14" stroke="#c9a84c" strokeWidth="1.5"/></svg>
    ),
    tag_bonus_divine: (
      <svg viewBox="0 0 20 20" className="w-4 h-4"><polygon points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8" fill="none" stroke="#c9a84c" strokeWidth="1.2"/></svg>
    ),
    tag_bonus_mech: (
      <svg viewBox="0 0 20 20" className="w-4 h-4"><circle cx="10" cy="10" r="7" fill="none" stroke="#c9a84c" strokeWidth="1.2"/><circle cx="10" cy="10" r="3" fill="#c9a84c"/><line x1="10" y1="2" x2="10" y2="5" stroke="#c9a84c" strokeWidth="1.5"/><line x1="10" y1="15" x2="10" y2="18" stroke="#c9a84c" strokeWidth="1.5"/><line x1="2" y1="10" x2="5" y2="10" stroke="#c9a84c" strokeWidth="1.5"/><line x1="15" y1="10" x2="18" y2="10" stroke="#c9a84c" strokeWidth="1.5"/></svg>
    ),
    tag_bonus_beast: (
      <svg viewBox="0 0 20 20" className="w-4 h-4"><path d="M5 14C5 14 6 8 10 8C14 8 15 14 15 14" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="10" r="1" fill="#c9a84c"/><circle cx="13" cy="10" r="1" fill="#c9a84c"/></svg>
    ),
  };
  return <>{iconMap[modifier]}</>;
}

// ── Hub tab type ────────────────────────────────────────────────────────────

type HubTab = 'play' | 'decks' | 'shop' | 'collection' | 'quests';

// ── Hub tab icons ───────────────────────────────────────────────────────────

function TabIcon({ tab, active }: { tab: HubTab; active: boolean }) {
  const color = active ? '#c9a84c' : '#6b7280';
  switch (tab) {
    case 'play':
      return <svg viewBox="0 0 20 20" className="w-4 h-4"><polygon points="6,3 17,10 6,17" fill={color}/></svg>;
    case 'decks':
      return <svg viewBox="0 0 20 20" className="w-4 h-4"><rect x="4" y="2" width="10" height="14" rx="1" fill="none" stroke={color} strokeWidth="1.5"/><rect x="6" y="4" width="10" height="14" rx="1" fill="none" stroke={color} strokeWidth="1.5"/></svg>;
    case 'shop':
      return <svg viewBox="0 0 20 20" className="w-4 h-4"><path d="M10 3L3 8V17H17V8L10 3Z" fill="none" stroke={color} strokeWidth="1.5"/><rect x="7" y="11" width="6" height="6" fill={color} opacity="0.3"/></svg>;
    case 'collection':
      return <svg viewBox="0 0 20 20" className="w-4 h-4"><rect x="2" y="2" width="7" height="7" rx="1" fill="none" stroke={color} strokeWidth="1.3"/><rect x="11" y="2" width="7" height="7" rx="1" fill="none" stroke={color} strokeWidth="1.3"/><rect x="2" y="11" width="7" height="7" rx="1" fill="none" stroke={color} strokeWidth="1.3"/><rect x="11" y="11" width="7" height="7" rx="1" fill="none" stroke={color} strokeWidth="1.3"/></svg>;
    case 'quests':
      return <svg viewBox="0 0 20 20" className="w-4 h-4"><path d="M4 3H16V17H4V3Z" fill="none" stroke={color} strokeWidth="1.3"/><line x1="7" y1="7" x2="13" y2="7" stroke={color} strokeWidth="1.2"/><line x1="7" y1="10" x2="13" y2="10" stroke={color} strokeWidth="1.2"/><line x1="7" y1="13" x2="11" y2="13" stroke={color} strokeWidth="1.2"/></svg>;
  }
}

// ── Custom currency icons ───────────────────────────────────────────────────

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

function ShardIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" style={{ width: size, height: size }}>
      {/* Main shard — tall narrow crystal */}
      <polygon points="10,1 14,8 12,19 8,19 6,8" fill="#22d3ee" stroke="#67e8f9" strokeWidth="0.8"/>
      {/* Inner facet highlight */}
      <polygon points="10,3 12,8 11,16 9,16 8,8" fill="#a5f3fc" opacity="0.3"/>
      {/* Small shard fragment left */}
      <polygon points="5,5 7,8 5,14 3,8" fill="#22d3ee" opacity="0.5" stroke="#67e8f9" strokeWidth="0.5"/>
      {/* Horizontal cut line */}
      <line x1="6" y1="8" x2="14" y2="8" stroke="#a5f3fc" strokeWidth="0.5" opacity="0.6"/>
    </svg>
  );
}

// ── Lazy-rendered card for shop grid (IntersectionObserver) ───────────────

function LazyShopCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1.5" style={{ minHeight: 140 }}>
      {visible ? children : (
        <div className="w-12 h-16 rounded animate-pulse" style={{ background: '#1a1a2e' }} />
      )}
    </div>
  );
}

// ── Card Tooltip ──────────────────────────────────────────────────────────

function CardTooltip({ cardId, t }: { cardId: string; t: (key: string) => string }) {
  const def = NC_CARD_MAP[cardId];
  if (!def) return null;

  const rarityColor: Record<string, string> = {
    common: '#9ca3af', rare: '#4a7dff', epic: '#7c3aed', legendary: '#c9a84c',
  };

  return (
    <div className="nc-tooltip pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52" style={{
      background: 'linear-gradient(135deg, #1a1a2e, #0e0e1a)',
      border: '1px solid #2a2a4a',
      borderRadius: '8px',
      padding: '10px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      {/* Arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0" style={{
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid #2a2a4a',
      }} />
      {/* Name + Rarity */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-black truncate" style={{ color: '#e0e0e8' }}>{t(def.nameKey)}</span>
        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{
          color: rarityColor[def.rarity],
          background: `${rarityColor[def.rarity]}15`,
          border: `1px solid ${rarityColor[def.rarity]}33`,
        }}>{t(`nc.rarity.${def.rarity}`)}</span>
      </div>
      {/* Cost + Power */}
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-[10px]" style={{ color: '#6a6a7a' }}>{t('nc.detail.cost')}: <b style={{ color: '#4a7dff' }}>{def.cost}</b></span>
        <span className="text-[10px]" style={{ color: '#6a6a7a' }}>{t('nc.detail.power')}: <b style={{ color: '#4ade80' }}>{def.power}</b></span>
      </div>
      {/* Tags */}
      <div className="flex gap-1 flex-wrap mb-1.5">
        {def.tags.map(tag => (
          <span key={tag} className="text-[8px] font-semibold uppercase px-1 py-0.5 rounded" style={{
            background: '#ffffff08', color: '#8a8a9a', border: '1px solid #2a2a3a',
          }}>{t(`nc.tag.${tag}`)}</span>
        ))}
      </div>
      {/* Ability */}
      {def.ability && (
        <div className="text-[10px] leading-tight" style={{ color: '#b0b0b8' }}>
          <span className="font-bold uppercase text-[8px] mr-1" style={{
            color: def.ability.trigger === 'ongoing' ? '#c9a84c' : '#4a7dff',
          }}>{t(`nc.trigger.${def.ability.trigger}`)}</span>
          {t(`nc.ability.${def.id}`)}
        </div>
      )}
    </div>
  );
}

// ── Card with hover tooltip wrapper ──────────────────────────────────────

function CardWithTooltip({ cardId, t, children, className }: {
  cardId: string; t: (key: string) => string; children: React.ReactNode; className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div
      className={`relative ${className ?? ''}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && <CardTooltip cardId={cardId} t={t} />}
    </div>
  );
}

// ── Lane Modifier Tooltip ─────────────────────────────────────────────────

function ModifierTooltip({ modifier, t }: { modifier: string; t: (key: string) => string }) {
  return (
    <div className="nc-tooltip pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44" style={{
      background: 'linear-gradient(135deg, #1a1a2e, #0e0e1a)',
      border: '1px solid #c9a84c33',
      borderRadius: '8px',
      padding: '8px 10px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    }}>
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0" style={{
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '5px solid #c9a84c33',
      }} />
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#c9a84c' }}>
        {t(`nc.modifier.${modifier}`)}
      </p>
      <p className="text-[10px] leading-tight" style={{ color: '#8a8a9a' }}>
        {t(`nc.modifier.${modifier}.desc`)}
      </p>
    </div>
  );
}

// ── Mana Crystal ────────────────────────────────────────────────────────────

function ManaCrystal({ filled, spent }: { filled: boolean; spent: boolean }) {
  return (
    <svg viewBox="0 0 16 20" className="w-3.5 h-4.5">
      <polygon
        points="8,1 14,6 12,18 4,18 2,6"
        fill={filled ? '#4a7dff' : spent ? '#1a2040' : '#1a1a2a'}
        stroke={filled ? '#7da8ff' : spent ? '#2a3a6a' : '#2a2a3a'}
        strokeWidth="1.2"
      />
      {filled && (
        <>
          <polygon points="8,3 11,6 10,14 6,14 5,6" fill="#6d9fff" opacity="0.4"/>
          <line x1="7" y1="4" x2="6" y2="10" stroke="white" strokeWidth="0.5" opacity="0.3"/>
        </>
      )}
    </svg>
  );
}

// ── Breakthrough Emblem ─────────────────────────────────────────────────────

function BreakthroughEmblem({ achieved, color }: { achieved: boolean; color: 'blue' | 'red' }) {
  const fill = achieved ? (color === 'blue' ? '#4a7dff' : '#ef4444') : 'transparent';
  const stroke = achieved ? (color === 'blue' ? '#7da8ff' : '#fca5a5') : '#3a3a4a';
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <polygon
        points="12,2 15,8 22,9 17,14 18,21 12,17 6,21 7,14 2,9 9,8"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.2"
      />
      {achieved && (
        <polygon points="12,5 14,9 18,10 15,13 16,17 12,15 8,17 9,13 6,10 10,9" fill="white" opacity="0.15"/>
      )}
    </svg>
  );
}

// ── Resolution animation types ──────────────────────────────────────────────

type ResolvePhase = 'cards' | 'abilities' | 'push' | 'breakthrough' | 'done';

interface ResolveAnimState {
  /** Which high-level phase we're in */
  phase: ResolvePhase;
  /** Current event index in the full resolveLog */
  eventIndex: number;
  /** All events from the log */
  events: NcResolveEvent[];
  /** Lane tug values at start of resolution (before push) */
  prevTugValues: [number, number, number];
  /** Lane tug values being animated to */
  animTugValues: [number, number, number];
  /** Active floating texts per lane */
  floatingTexts: { id: number; laneIndex: number; text: string; color: string; y: number }[];
  /** Lanes that just had a breakthrough */
  breakthroughLanes: Set<number>;
  /** Cards being revealed (cardUid → true) */
  revealedCards: Set<number>;
  /** Cards with triggered abilities (cardUid → effect name) */
  triggeredCards: Map<number, string>;
  /** Push deltas being shown per lane */
  pushDeltas: Map<number, { p0: number; p1: number; delta: number }>;
}

// ── Tug of war bar ──────────────────────────────────────────────────────────

function TugBar({ value, locked, winner, myIdx, animating }: { value: number; locked: boolean; winner: 0 | 1 | null; myIdx: number | null; animating?: boolean }) {
  const position = Math.max(0, Math.min(100, (value + 100) / 2));

  const p0IsMe = myIdx === 0;
  const leftColor = p0IsMe ? '#4a7dff' : '#ef4444';
  const rightColor = p0IsMe ? '#ef4444' : '#4a7dff';

  const isCritical = Math.abs(value) > 60;

  return (
    <div className={[
      'relative h-5 rounded overflow-hidden',
      locked ? 'opacity-70' : '',
      isCritical ? 'nc-tug-critical' : '',
    ].join(' ')}
    style={{
      background: '#0a0a12',
      border: `1px solid ${isCritical ? (value > 0 ? leftColor + '66' : rightColor + '66') : '#2a2a3a'}`,
      boxShadow: isCritical
        ? `inset 0 2px 4px rgba(0,0,0,0.5), 0 0 12px ${value > 0 ? leftColor : rightColor}44`
        : 'inset 0 2px 4px rgba(0,0,0,0.5)',
    }}
    >
      {/* Track fill */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to right, ${leftColor}33 0%, transparent 45%, transparent 55%, ${rightColor}33 100%)`,
        }}
      />
      {/* Center line */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2" style={{ background: '#c9a84c44' }} />
      {/* Tick marks */}
      <div className="absolute left-[25%] top-0 h-full w-px" style={{ background: '#ffffff10' }} />
      <div className="absolute left-[75%] top-0 h-full w-px" style={{ background: '#ffffff10' }} />
      {/* Marker */}
      <div
        className="absolute top-0 h-full transition-all ease-out"
        style={{ left: `${position}%`, transform: 'translateX(-50%)', transitionDuration: animating ? '1200ms' : '700ms' }}
      >
        {/* Energy glow */}
        <div className="absolute -inset-x-3 inset-y-0" style={{
          background: `radial-gradient(ellipse at center, ${value > 0 ? leftColor : value < 0 ? rightColor : '#c9a84c'}55, transparent)`,
        }} />
        {/* Marker line */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 h-full w-1 rounded-full" style={{
          background: '#e8d48b',
          boxShadow: '0 0 8px #c9a84c, 0 0 16px #c9a84c66',
        }} />
        {/* Top diamond */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-0.5">
          <svg viewBox="0 0 8 8" className="w-2 h-2"><polygon points="4,0 8,4 4,8 0,4" fill="#c9a84c"/></svg>
        </div>
      </div>
      {/* Breakthrough flash */}
      {locked && winner !== null && (
        <div className="absolute inset-0 flex items-center justify-center nc-breakthrough-flash">
          <svg viewBox="0 0 20 20" className="w-4 h-4">
            <polygon points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8" fill="#c9a84c"/>
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Lane component ──────────────────────────────────────────────────────────

function LaneView({
  lane, laneIndex, myIdx, pendingPlays, selectedCardId, onLaneClick, t,
  resolveAnim,
}: {
  lane: NcLane;
  laneIndex: number;
  myIdx: number | null;
  pendingPlays: NcPendingPlay[];
  selectedCardId: string | null;
  onLaneClick: (laneIndex: 0 | 1 | 2) => void;
  t: (key: string) => string;
  resolveAnim?: ResolveAnimState | null;
}) {
  const [modTooltip, setModTooltip] = useState(false);
  const myCards = myIdx !== null ? lane.cards[myIdx] : [];
  const oppCards = myIdx !== null ? lane.cards[1 - myIdx] : lane.cards[0];

  const myPending = pendingPlays.filter(p => p.laneIndex === laneIndex);

  return (
    <div
      className={[
        'relative flex flex-col gap-2 rounded-lg transition-all min-h-[200px] overflow-hidden',
        selectedCardId ? 'cursor-pointer nc-lane-hover' : '',
        lane.locked ? 'nc-lane-locked' : '',
      ].join(' ')}
      style={{
        background: lane.locked
          ? 'linear-gradient(180deg, #1a1008 0%, #12121f 100%)'
          : 'linear-gradient(180deg, #0e0e1a 0%, #12121f 100%)',
        border: lane.locked ? '1px solid #c9a84c33' : '1px solid #1e1e3a',
        boxShadow: lane.locked
          ? 'inset 0 0 30px rgba(201,168,76,0.05), 0 0 20px rgba(201,168,76,0.05)'
          : 'inset 0 0 30px rgba(0,0,0,0.3)',
        padding: '12px',
      }}
      onClick={() => onLaneClick(laneIndex as 0 | 1 | 2)}
    >
      {/* Atmospheric background element */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(74,125,255,0.03) 0%, transparent 70%)',
      }} />

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-3 h-3 pointer-events-none" style={{
        borderTop: '1px solid #c9a84c33',
        borderLeft: '1px solid #c9a84c33',
      }} />
      <div className="absolute top-0 right-0 w-3 h-3 pointer-events-none" style={{
        borderTop: '1px solid #c9a84c33',
        borderRight: '1px solid #c9a84c33',
      }} />
      <div className="absolute bottom-0 left-0 w-3 h-3 pointer-events-none" style={{
        borderBottom: '1px solid #c9a84c33',
        borderLeft: '1px solid #c9a84c33',
      }} />
      <div className="absolute bottom-0 right-0 w-3 h-3 pointer-events-none" style={{
        borderBottom: '1px solid #c9a84c33',
        borderRight: '1px solid #c9a84c33',
      }} />

      {/* Modifier rune (floating above) */}
      <div className="flex items-center justify-center gap-1.5 relative z-10">
        <div
          className="relative flex items-center gap-1.5 rounded-full px-2.5 py-1 cursor-help"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e, #12121f)',
            border: '1px solid #c9a84c44',
            boxShadow: '0 0 8px rgba(201,168,76,0.1)',
          }}
          onMouseEnter={() => setModTooltip(true)}
          onMouseLeave={() => setModTooltip(false)}
        >
          <ModifierIcon modifier={lane.modifier} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#c9a84c' }}>
            {t(`nc.modifier.${lane.modifier}`)}
          </span>
          {modTooltip && <ModifierTooltip modifier={lane.modifier} t={t} />}
        </div>
        {lane.locked && (
          <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{
            background: 'linear-gradient(135deg, #2a1a08, #1a1008)',
            border: '1px solid #c9a84c55',
          }}>
            <svg viewBox="0 0 12 12" className="w-3 h-3"><polygon points="6,1 8,4 11,5 8,7 9,10 6,8 3,10 4,7 1,5 4,4" fill="#c9a84c"/></svg>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#c9a84c' }}>
              {t('nc.breakthrough')}
            </span>
          </div>
        )}
      </div>

      {/* Tug bar */}
      <div className="relative z-10">
        <TugBar
          value={resolveAnim ? resolveAnim.animTugValues[laneIndex] : lane.tugValue}
          locked={lane.locked}
          winner={lane.breakthroughWinner}
          myIdx={myIdx}
          animating={!!resolveAnim && resolveAnim.phase === 'push'}
        />
        {/* Push delta overlay */}
        {resolveAnim?.pushDeltas.has(laneIndex) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            {(() => {
              const pd = resolveAnim.pushDeltas.get(laneIndex)!;
              const isMyPush = myIdx === 0 ? pd.delta > 0 : pd.delta < 0;
              const absDelta = Math.abs(pd.delta);
              return absDelta > 0 ? (
                <div className="nc-push-number px-2 py-0.5 rounded font-black text-sm tabular-nums" style={{
                  color: isMyPush ? '#4a7dff' : '#ef4444',
                  background: '#0a0a12cc',
                  border: `1px solid ${isMyPush ? '#4a7dff44' : '#ef444444'}`,
                  textShadow: `0 0 12px ${isMyPush ? '#4a7dff' : '#ef4444'}`,
                }}>
                  {isMyPush ? '+' : '-'}{absDelta}
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Opponent cards (top) */}
      <div className="flex gap-1 justify-center min-h-[20px] flex-wrap relative z-10">
        {oppCards.map((ci) => {
          const justRevealed = resolveAnim?.revealedCards.has(ci.uid);
          const abilityActive = resolveAnim?.triggeredCards.has(ci.uid);
          return (
            <CardWithTooltip key={ci.uid} cardId={ci.cardId} t={t} className={[
              justRevealed ? 'nc-card-reveal' : '',
              abilityActive ? 'nc-card-ability-glow' : '',
            ].join(' ')}>
              <NexusClashCard card={ci.cardId} compact displayPower={ci.power} />
            </CardWithTooltip>
          );
        })}
      </div>

      {/* Floating texts (abilities, damage, etc) */}
      {resolveAnim && resolveAnim.floatingTexts.filter(ft => ft.laneIndex === laneIndex).map(ft => (
        <div key={ft.id} className="nc-floating-text absolute left-1/2 z-30 pointer-events-none text-xs font-black uppercase tracking-wider" style={{
          color: ft.color,
          textShadow: `0 0 8px ${ft.color}`,
          transform: 'translateX(-50%)',
          top: `${ft.y}%`,
        }}>
          {ft.text}
        </div>
      ))}

      {/* Breakthrough explosion overlay */}
      {resolveAnim?.breakthroughLanes.has(laneIndex) && (
        <div className="absolute inset-0 z-20 nc-breakthrough-explode pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.4) 0%, rgba(201,168,76,0.1) 40%, transparent 70%)',
        }} />
      )}

      {/* Lane divider */}
      <div className="relative h-px my-0.5" style={{
        background: 'linear-gradient(to right, transparent, #c9a84c33, transparent)',
      }} />

      {/* My cards (bottom) */}
      <div className="flex gap-1 justify-center min-h-[20px] flex-wrap relative z-10">
        {myCards.map((ci) => {
          const justRevealed = resolveAnim?.revealedCards.has(ci.uid);
          const abilityActive = resolveAnim?.triggeredCards.has(ci.uid);
          return (
            <CardWithTooltip key={ci.uid} cardId={ci.cardId} t={t} className={[
              justRevealed ? 'nc-card-reveal' : '',
              abilityActive ? 'nc-card-ability-glow' : '',
            ].join(' ')}>
              <NexusClashCard card={ci.cardId} compact displayPower={ci.power} />
            </CardWithTooltip>
          );
        })}
        {/* Pending plays */}
        {myPending.map((pp) => (
          <NexusClashCard
            key={`pending-${pp.cardUid}`}
            card={pp.cardId}
            compact
            pending
          />
        ))}
      </div>
    </div>
  );
}

// ── Resolution helpers ──────────────────────────────────────────────────────

function getEffectLabel(effect: string, value?: number): string {
  const v = value ?? 0;
  const sign = v > 0 ? '+' : '';
  switch (effect) {
    case 'buff_allies': return `${sign}${v} ⚔️`;
    case 'buff_self': return `${sign}${v} 💪`;
    case 'debuff_enemies': return `${v > 0 ? '-' : ''}${Math.abs(v)} 🔻`;
    case 'shield': return `🛡️ ${v}`;
    case 'drain': return `🩸 ${v}`;
    case 'destroy_weakest_enemy': return '💀';
    case 'copy_strongest_ally_power': return '📋';
    case 'move_to_lane': return '↗️';
    case 'swap_lane_positions': return '🔄';
    case 'push_bonus': return `${sign}${v} ⬆️`;
    case 'double_push_if': return 'x2 ⚡';
    case 'power_per_tag': return `${sign}${v}/tag`;
    default: return '✨';
  }
}

function getEffectColor(effect: string): string {
  switch (effect) {
    case 'buff_allies': case 'buff_self': case 'push_bonus': case 'power_per_tag': return '#4ade80';
    case 'debuff_enemies': case 'drain': case 'destroy_weakest_enemy': return '#ef4444';
    case 'shield': return '#60a5fa';
    case 'move_to_lane': case 'swap_lane_positions': return '#c084fc';
    case 'copy_strongest_ally_power': case 'double_push_if': return '#fbbf24';
    default: return '#c9a84c';
  }
}

function findCardLane(gs: NexusClashState, cardUid: number): number {
  for (let l = 0; l < 3; l++) {
    for (const side of [0, 1] as const) {
      if (gs.lanes[l].cards[side].some(c => c.uid === cardUid)) return l;
    }
  }
  return -1;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function NexusClashGame({ wsUrl, gameId, initialRoomCode, quickPlay: isQuickPlay }: GameComponentProps) {
  const router = useRouter();
  const mp = useMultiplayer<NexusClashState>(wsUrl, gameId);
  const { t } = useI18n();
  const ncProfile = useNcProfile();

  // UI state
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [hubTab, setHubTab] = useState<HubTab>('play');
  const [joinInput, setJoinInput] = useState(initialRoomCode ?? '');
  const [copied, setCopied] = useState(false);
  const [roomVisibility, setRoomVisibility] = useState<'private' | 'public'>('private');
  const [roomName, setRoomName] = useState('');
  const [customExpanded, setCustomExpanded] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [shopSubTab, setShopSubTab] = useState<'packs' | 'shards'>('packs');
  const [showDailyCalendar, setShowDailyCalendar] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<NcBotDifficulty>('medium');

  const { chatOpen, setChatOpen, unread } = useUnreadMessages(mp);
  useAutoJoin(mp, initialRoomCode, isQuickPlay, 'nexusclash');

  // Auto-show tutorial on first visit
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = 'webgames.nc.tutorialSeen';
    if (!localStorage.getItem(key)) {
      setShowTutorial(true);
      localStorage.setItem(key, '1');
    }
  }, []);

  // Replace URL with ?room=CODE once matched
  useEffect(() => {
    if (isQuickPlay && mp.roomCode) {
      router.replace(`/games/${gameId}?room=${mp.roomCode}`);
    }
  }, [mp.roomCode]); // eslint-disable-line

  const gs = mp.gameState;
  const myIdx = mp.playerIndex;
  const oppIdx = myIdx !== null ? (1 - myIdx) as 0 | 1 : null;

  const p0nick = mp.players.find(p => p.index === 0)?.nickname ?? t('game.common.player1');
  const p1nick = mp.players.find(p => p.index === 1)?.nickname ?? t('game.common.player2');
  const myNick = myIdx !== null ? (mp.players.find(p => p.index === myIdx)?.nickname ?? `Player ${myIdx + 1}`) : null;
  const oppNick = myIdx !== null ? (mp.players.find(p => p.index !== myIdx)?.nickname ?? t('game.common.opponent')) : null;

  // My hand
  const myHand = gs && myIdx !== null ? gs.hands[myIdx] : [];
  const myMana = gs && myIdx !== null ? gs.mana[myIdx] : 0;
  const myMaxMana = gs && myIdx !== null ? gs.maxMana[myIdx] : 0;

  // My pending plays
  const myPending = gs && myIdx !== null ? gs.pendingPlays[myIdx] : [];
  const haveConfirmed = gs && myIdx !== null ? gs.confirmed[myIdx] : false;
  const oppConfirmed = gs && oppIdx !== null ? gs.confirmed[oppIdx] : false;

  // Remaining mana after pending plays
  const spentMana = useMemo(() => {
    if (!myPending) return 0;
    let spent = 0;
    for (const pp of myPending) {
      const def = NC_CARD_MAP[pp.cardId];
      if (def) spent += def.cost;
    }
    return spent;
  }, [myPending]);

  const availableMana = myMana - spentMana;

  // ── Resolution Animation ──────────────────────────────────────────────────
  const [resolveAnim, setResolveAnim] = useState<ResolveAnimState | null>(null);
  const prevTugRef = useRef<[number, number, number] | null>(null);
  const prevRoundRef = useRef<number>(0);
  const floatIdRef = useRef(0);

  // Snapshot tug values BEFORE each resolution so we can animate from old → new
  // Detect resolution by: round number increased AND resolveLog has card_revealed events
  useEffect(() => {
    if (!gs) return;
    const log = gs.resolveLog;
    const round = gs.round;

    // First state or new game: store initial tug values
    if (prevRoundRef.current === 0) {
      prevTugRef.current = [gs.lanes[0].tugValue, gs.lanes[1].tugValue, gs.lanes[2].tugValue];
      prevRoundRef.current = round;
      return;
    }

    // Round changed (or game finished with resolveLog) → resolution happened
    const roundChanged = round !== prevRoundRef.current || gs.phase === 'finished';
    const hasResolveEvents = log.length > 0 && log.some(e => e.type === 'card_revealed');

    if (roundChanged && hasResolveEvents) {
      const prev = prevTugRef.current ?? [0, 0, 0];
      setResolveAnim({
        phase: 'cards',
        eventIndex: 0,
        events: log,
        prevTugValues: prev as [number, number, number],
        animTugValues: [...prev] as [number, number, number],
        floatingTexts: [],
        breakthroughLanes: new Set(),
        revealedCards: new Set(),
        triggeredCards: new Map(),
        pushDeltas: new Map(),
      });
      // Update refs AFTER starting animation — prevTug will be updated when anim ends
      prevRoundRef.current = round;
    } else if (roundChanged) {
      // Round changed but no resolve events (shouldn't happen, but be safe)
      prevTugRef.current = [gs.lanes[0].tugValue, gs.lanes[1].tugValue, gs.lanes[2].tugValue];
      prevRoundRef.current = round;
    }
  }, [gs?.round, gs?.phase, gs?.resolveLog]); // eslint-disable-line

  // Update prevTug when animation finishes so next round animates from correct position
  useEffect(() => {
    if (resolveAnim === null && gs) {
      prevTugRef.current = [gs.lanes[0].tugValue, gs.lanes[1].tugValue, gs.lanes[2].tugValue];
    }
  }, [resolveAnim, gs]); // eslint-disable-line

  // Step through the animation phases
  useEffect(() => {
    if (!resolveAnim || !gs) return;

    const events = resolveAnim.events;

    // Group events by phase type
    const cardEvents = events.filter(e => e.type === 'card_revealed');
    const abilityEvents = events.filter(e => e.type === 'ability_triggered' || e.type === 'card_moved' || e.type === 'card_destroyed');
    const pushEvents = events.filter(e => e.type === 'push_calculated');
    const btEvents = events.filter(e => e.type === 'breakthrough');

    let timeout: ReturnType<typeof setTimeout>;

    switch (resolveAnim.phase) {
      case 'cards': {
        // Reveal cards one by one with 300ms spacing
        if (resolveAnim.eventIndex < cardEvents.length) {
          timeout = setTimeout(() => {
            const ev = cardEvents[resolveAnim.eventIndex];
            const newRevealed = new Set(resolveAnim.revealedCards);
            if (ev.type === 'card_revealed') newRevealed.add(ev.cardUid);
            setResolveAnim(prev => prev ? { ...prev, eventIndex: prev.eventIndex + 1, revealedCards: newRevealed } : null);
          }, resolveAnim.eventIndex === 0 ? 400 : 300);
        } else {
          // Move to abilities phase after a pause
          timeout = setTimeout(() => {
            setResolveAnim(prev => prev ? {
              ...prev, phase: 'abilities', eventIndex: 0,
              revealedCards: new Set(), // clear reveal glow
            } : null);
          }, 500);
        }
        break;
      }

      case 'abilities': {
        if (abilityEvents.length === 0) {
          // Skip to push
          timeout = setTimeout(() => {
            setResolveAnim(prev => prev ? { ...prev, phase: 'push', eventIndex: 0 } : null);
          }, 200);
          break;
        }
        if (resolveAnim.eventIndex < abilityEvents.length) {
          timeout = setTimeout(() => {
            const ev = abilityEvents[resolveAnim.eventIndex];
            const newTriggered = new Map(resolveAnim.triggeredCards);
            const newFloats = [...resolveAnim.floatingTexts];

            if (ev.type === 'ability_triggered') {
              newTriggered.set(ev.cardUid, ev.effect);
              // Find which lane this card is in
              const effectLabel = getEffectLabel(ev.effect, ev.value);
              const color = getEffectColor(ev.effect);
              // Try to find lane from card placement
              const laneIdx = findCardLane(gs, ev.cardUid);
              if (laneIdx !== -1) {
                const fid = ++floatIdRef.current;
                newFloats.push({ id: fid, laneIndex: laneIdx, text: effectLabel, color, y: 45 });
                // Auto-remove after 1.2s
                setTimeout(() => {
                  setResolveAnim(prev => {
                    if (!prev) return null;
                    return { ...prev, floatingTexts: prev.floatingTexts.filter(f => f.id !== fid) };
                  });
                }, 1200);
              }
            } else if (ev.type === 'card_destroyed') {
              const fid = ++floatIdRef.current;
              newFloats.push({ id: fid, laneIndex: ev.laneIndex, text: '💀', color: '#ef4444', y: 50 });
              setTimeout(() => {
                setResolveAnim(prev => {
                  if (!prev) return null;
                  return { ...prev, floatingTexts: prev.floatingTexts.filter(f => f.id !== fid) };
                });
              }, 1200);
            }

            setResolveAnim(prev => prev ? {
              ...prev, eventIndex: prev.eventIndex + 1,
              triggeredCards: newTriggered,
              floatingTexts: newFloats,
            } : null);
          }, resolveAnim.eventIndex === 0 ? 300 : 500);
        } else {
          // Move to push phase
          timeout = setTimeout(() => {
            setResolveAnim(prev => prev ? {
              ...prev, phase: 'push', eventIndex: 0,
              triggeredCards: new Map(),
              floatingTexts: [],
            } : null);
          }, 600);
        }
        break;
      }

      case 'push': {
        if (resolveAnim.eventIndex < pushEvents.length) {
          timeout = setTimeout(() => {
            const ev = pushEvents[resolveAnim.eventIndex];
            if (ev.type === 'push_calculated') {
              const newTug = [...resolveAnim.animTugValues] as [number, number, number];
              newTug[ev.laneIndex] = Math.max(-100, Math.min(100, newTug[ev.laneIndex] + ev.delta));
              const newPushDeltas = new Map(resolveAnim.pushDeltas);
              newPushDeltas.set(ev.laneIndex, { p0: ev.p0Push, p1: ev.p1Push, delta: ev.delta });
              setResolveAnim(prev => prev ? {
                ...prev, eventIndex: prev.eventIndex + 1,
                animTugValues: newTug,
                pushDeltas: newPushDeltas,
              } : null);
            }
          }, resolveAnim.eventIndex === 0 ? 300 : 800);
        } else {
          // Move to breakthrough or done
          timeout = setTimeout(() => {
            if (btEvents.length > 0) {
              setResolveAnim(prev => prev ? {
                ...prev, phase: 'breakthrough', eventIndex: 0, pushDeltas: new Map(),
              } : null);
            } else {
              setResolveAnim(prev => prev ? { ...prev, phase: 'done', pushDeltas: new Map() } : null);
            }
          }, 1000);
        }
        break;
      }

      case 'breakthrough': {
        if (resolveAnim.eventIndex < btEvents.length) {
          timeout = setTimeout(() => {
            const ev = btEvents[resolveAnim.eventIndex];
            if (ev.type === 'breakthrough') {
              const newBt = new Set(resolveAnim.breakthroughLanes);
              newBt.add(ev.laneIndex);
              setResolveAnim(prev => prev ? {
                ...prev, eventIndex: prev.eventIndex + 1,
                breakthroughLanes: newBt,
              } : null);
            }
          }, resolveAnim.eventIndex === 0 ? 200 : 600);
        } else {
          timeout = setTimeout(() => {
            setResolveAnim(prev => prev ? { ...prev, phase: 'done' } : null);
          }, 1200);
        }
        break;
      }

      case 'done': {
        timeout = setTimeout(() => {
          setResolveAnim(null);
        }, 400);
        break;
      }
    }

    return () => clearTimeout(timeout);
  }, [resolveAnim?.phase, resolveAnim?.eventIndex, gs]); // eslint-disable-line

  // Card placement
  const handleCardClick = useCallback((cardId: string) => {
    if (haveConfirmed || mp.phase !== 'playing' || mp.isSpectator) return;
    if (gs?.phase !== 'placing') return;
    setSelectedCard(prev => prev === cardId ? null : cardId);
  }, [haveConfirmed, mp.phase, mp.isSpectator, gs?.phase]);

  const handleLaneClick = useCallback((laneIndex: 0 | 1 | 2) => {
    if (!selectedCard || !gs || haveConfirmed || mp.isSpectator) return;
    if (gs.phase !== 'placing') return;
    if (gs.lanes[laneIndex].locked) return;

    const def = NC_CARD_MAP[selectedCard];
    if (!def || def.cost > availableMana) return;

    mp.sendAction({ type: 'nc_place', cardId: selectedCard, laneIndex } as NexusClashAction);
    ncAudio.cardPlace();
    setSelectedCard(null);
  }, [selectedCard, gs, haveConfirmed, mp, availableMana]);

  const handleUndo = useCallback((cardUid: number) => {
    if (haveConfirmed || !gs || gs.phase !== 'placing') return;
    mp.sendAction({ type: 'nc_undo', cardUid } as NexusClashAction);
    ncAudio.cardUndo();
  }, [haveConfirmed, gs, mp]);

  const handleConfirm = useCallback(() => {
    if (haveConfirmed || !gs || gs.phase !== 'placing') return;
    mp.sendAction({ type: 'nc_confirm' } as NexusClashAction);
    ncAudio.confirm();
    setSelectedCard(null);
  }, [haveConfirmed, gs, mp]);

  // Track match end for profile
  const prevStatusRef = useRef(gs?.status);
  useEffect(() => {
    if (!gs || myIdx === null) return;
    if (prevStatusRef.current === 'ongoing' && gs.status !== 'ongoing') {
      const won = gs.status === 'win' && gs.winner === gs.playerIds[myIdx];
      let cardsPlayed = 0;
      let destroyedCards = 0;
      const tagSet = new Set<string>();
      const uniqueCardSet = new Set<string>();
      for (const ev of gs.resolveLog) {
        if (ev.type === 'card_revealed' && ev.owner === myIdx) {
          cardsPlayed++;
          const def = NC_CARD_MAP[ev.cardId];
          if (def) {
            uniqueCardSet.add(ev.cardId);
            for (const tg of def.tags) tagSet.add(tg);
          }
        }
        if (ev.type === 'card_destroyed' && ev.owner !== myIdx) destroyedCards++;
      }
      ncProfile.trackMatchEnd(
        won,
        gs.breakthroughs[myIdx],
        cardsPlayed,
        [...tagSet],
        destroyedCards,
        uniqueCardSet.size,
      );
    }
    prevStatusRef.current = gs.status;
  }, [gs?.status]); // eslint-disable-line

  // Victory / defeat sound
  useEffect(() => {
    if (!gs || gs.status === 'ongoing' || myIdx === null) return;
    if (gs.status === 'win' && gs.winner === gs.playerIds[myIdx]) {
      ncAudio.victory();
    } else if (gs.status === 'win') {
      ncAudio.defeat();
    }
  }, [gs?.status]); // eslint-disable-line

  // Round start sound
  const prevRoundAudioRef = useRef(0);
  useEffect(() => {
    if (!gs || gs.phase !== 'placing') return;
    if (gs.round !== prevRoundAudioRef.current && gs.round > 1) {
      ncAudio.roundStart();
    }
    prevRoundAudioRef.current = gs.round;
  }, [gs?.round, gs?.phase]);

  // Timer display
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!gs?.turnDeadline) { setTimeLeft(null); return; }
    const tick = () => {
      const left = Math.max(0, Math.ceil((gs.turnDeadline! - Date.now()) / 1000));
      setTimeLeft(left);
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [gs?.turnDeadline]);

  // Determine if we're in the match (playing/ended with game state)
  const inMatch = (mp.phase === 'playing' || mp.phase === 'ended') && gs !== null;

  // Win rate
  const winRate = ncProfile.profile.matchesPlayed > 0
    ? Math.round((ncProfile.profile.wins / ncProfile.profile.matchesPlayed) * 100)
    : 0;

  // Active quests preview (first 3 incomplete)
  const activeQuests = ncProfile.profile.quests
    .filter(q => !q.completed)
    .slice(0, 3);

  // ── Render ──────────────────────────────────────────────────────────────────

  // ── MATCH VIEW (playing + ended) ────────────────────────────────────────────
  if (inMatch) {
    return (
      <div className="nc-game-root relative w-full flex flex-col gap-4 max-w-5xl mx-auto" style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 20%, #12121f 0%, #0a0a12 60%, #050510 100%)',
        padding: '16px',
      }}>
        {/* Atmospheric noise overlay */}
        <div className="fixed inset-0 pointer-events-none z-0 nc-noise-overlay" style={{ opacity: 0.03 }} />

        {/* Top bar with back button and chat toggle */}
        <div className="flex items-center justify-between relative z-10">
          <button
            onClick={mp.leaveRoom}
            className="nc-btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-all"
            style={{
              color: '#8a8a9a',
              border: '1px solid #2a2a3a',
              background: '#0a0a1299',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('nc.hub.backToHub')}
          </button>

          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div className="flex items-center gap-1.5" style={{
              background: '#0a0a1299',
              border: '1px solid #2a2a3a',
              borderRadius: '4px',
              padding: '4px 8px',
            }}>
              <span className={`w-2 h-2 rounded-full ${
                mp.connection === 'connected'  ? 'bg-emerald-400' :
                mp.connection === 'connecting' ? 'bg-amber-400 animate-pulse' :
                'bg-rose-500'
              }`} />
              <span className="text-[10px]" style={{ color: '#6a6a7a' }}>
                {mp.connection === 'connected' ? 'LIVE' : mp.connection === 'connecting' ? '...' : 'OFF'}
              </span>
            </div>
            {/* Chat toggle */}
            <button
              onClick={() => setChatVisible(v => !v)}
              className="nc-btn-ghost relative px-3 py-1.5 rounded text-sm transition-all"
              style={{
                color: '#8a8a9a',
                border: '1px solid #2a2a3a',
                background: '#0a0a1299',
              }}
            >
              {t('nc.hub.chat')}
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{
                  background: '#7c3aed',
                  color: 'white',
                  boxShadow: '0 0 8px rgba(124,58,237,0.5)',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          </div>
        </div>

        <CountdownOverlay countdown={mp.matchCountdown} />
        <WaitingForConnectionOverlay
          show={mp.phase === 'playing' && !mp.roomReady && !mp.isSpectator}
          label={t('game.ready.waiting')}
        />
        <ReconnectBanner mp={mp} />

        {/* Error */}
        {mp.error && (
          <div className="rounded-lg p-3 text-sm flex justify-between items-start gap-2 relative z-10" style={{
            border: '1px solid #5a1a1a',
            background: 'linear-gradient(135deg, #1a0808, #12121f)',
            color: '#ff6b6b',
          }}>
            <span>{mp.error}</span>
            <button onClick={mp.clearError} className="text-lg leading-none shrink-0 hover:text-white transition-colors" style={{ color: '#ff6b6b' }}>&times;</button>
          </div>
        )}

        {/* ── Mulligan phase ─────────────────────────────────────────────── */}
        {mp.phase === 'playing' && gs && gs.phase === 'mulligan' && myIdx !== null && (
          <div className="flex flex-col items-center gap-6 relative z-10 py-8 max-w-lg mx-auto">
            {/* Title */}
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-xl font-black uppercase tracking-[0.2em]" style={{ color: '#c9a84c' }}>
                {t('nc.mulligan.title')}
              </h2>
              <p className="text-sm text-center" style={{ color: '#6a6a7a' }}>
                {t('nc.mulligan.subtitle')}
              </p>
            </div>

            {/* Hand cards */}
            <div className="flex flex-wrap justify-center gap-3">
              {myHand.map((cardId, i) => {
                const def = NC_CARD_MAP[cardId];
                if (!def) return null;
                return (
                  <div key={i} className="nc-mulligan-card-enter" style={{ animationDelay: `${i * 100}ms` }}>
                    <NexusClashCard card={cardId} />
                  </div>
                );
              })}
            </div>

            {/* Decision buttons or waiting state */}
            {gs.mulliganDecisions[myIdx] === null ? (
              <div className="flex gap-4">
                <button
                  onClick={() => { mp.sendAction({ type: 'nc_mulligan', decision: 'keep' } as NexusClashAction); ncAudio.uiClick(); }}
                  className="px-8 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{
                    background: 'linear-gradient(135deg, #1a3a1a, #12121f)',
                    border: '1px solid #4ade8044',
                    color: '#4ade80',
                    boxShadow: '0 0 20px rgba(74,222,128,0.1)',
                  }}
                >
                  {t('nc.mulligan.keep')}
                </button>
                <button
                  onClick={() => { mp.sendAction({ type: 'nc_mulligan', decision: 'redraw' } as NexusClashAction); ncAudio.mulligan(); }}
                  className="px-8 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{
                    background: 'linear-gradient(135deg, #1a1a3a, #12121f)',
                    border: '1px solid #4a7dff44',
                    color: '#4a7dff',
                    boxShadow: '0 0 20px rgba(74,125,255,0.1)',
                  }}
                >
                  {t('nc.mulligan.redraw')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: '#4ade80' }}>
                  {gs.mulliganDecisions[myIdx] === 'keep' ? t('nc.mulligan.kept') : t('nc.mulligan.redrawn')}
                </span>
                <span className="text-xs animate-pulse" style={{ color: '#6a6a7a' }}>
                  {t('nc.mulligan.waiting')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Playing phase ──────────────────────────────────────────────── */}
        {mp.phase === 'playing' && gs && (
          <div key={gs.round} className={`flex flex-col gap-4 relative z-10 ${gs.phase === 'placing' ? 'nc-phase-enter' : ''}`}>
            {/* Top HUD: round, mana, timer, opponent info */}
            <div className="flex items-center justify-between">
              {/* Round frame */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{
                  background: 'linear-gradient(135deg, #1a1a2e, #12121f)',
                  border: '1px solid #c9a84c33',
                }}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#c9a84c' }}>
                    {t('nc.round')}
                  </span>
                  <span className="text-sm font-black" style={{ color: '#e8d48b' }}>
                    {gs.round}/{gs.maxRounds}
                  </span>
                </div>
                {gs.phase === 'placing' && timeLeft !== null && (
                  <div className={[
                    'px-2.5 py-1 rounded text-sm font-black tabular-nums',
                    timeLeft <= 5 ? 'nc-timer-critical' : '',
                  ].join(' ')} style={{
                    background: timeLeft <= 5 ? '#2a0808' : '#1a1a2e',
                    border: `1px solid ${timeLeft <= 5 ? '#ff4444' : '#2a2a3a'}`,
                    color: timeLeft <= 5 ? '#ff4444' : '#6a6a7a',
                  }}>
                    {timeLeft}s
                  </div>
                )}
              </div>
              {/* Opponent banner */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{
                background: 'linear-gradient(135deg, #1a0a0a, #12121f)',
                border: '1px solid #3a1a1a',
              }}>
                <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>{oppNick}</span>
                <span className="text-[10px]" style={{ color: '#5a3a3a' }}>
                  {oppIdx !== null && gs.hands[oppIdx] ? `${gs.hands[oppIdx].length} ` : '? '}{t('nc.cardsInHand')}
                </span>
              </div>
            </div>

            {/* Breakthroughs */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1">
                {[0, 1].map(i => (
                  <BreakthroughEmblem key={i} achieved={myIdx !== null && gs.breakthroughs[myIdx] > i} color="blue" />
                ))}
                <span className="text-[10px] font-semibold uppercase tracking-wider ml-1" style={{ color: '#4a7dff88' }}>{myNick}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: '#ef444488' }}>{oppNick}</span>
                {[0, 1].map(i => (
                  <BreakthroughEmblem key={i} achieved={oppIdx !== null && gs.breakthroughs[oppIdx] > i} color="red" />
                ))}
              </div>
            </div>

            {/* 3 Lanes */}
            <div className="grid grid-cols-3 gap-3">
              {gs.lanes.map((lane, i) => (
                <LaneView
                  key={i}
                  lane={lane}
                  laneIndex={i}
                  myIdx={myIdx}
                  pendingPlays={myPending ?? []}
                  selectedCardId={resolveAnim ? null : selectedCard}
                  onLaneClick={handleLaneClick}
                  t={t}
                  resolveAnim={resolveAnim}
                />
              ))}
            </div>

            {/* Pending plays undo area */}
            {myPending && myPending.length > 0 && !haveConfirmed && !resolveAnim && (
              <div className="flex items-center gap-2 px-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#6a6a7a' }}>{t('nc.pending')}:</span>
                <div className="flex gap-1 flex-wrap">
                  {myPending.map(pp => (
                    <button
                      key={pp.cardUid}
                      onClick={() => handleUndo(pp.cardUid)}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-all nc-btn-ghost"
                      style={{
                        background: '#1a1a2e',
                        border: '1px solid #2a2a3a',
                        color: '#8a8a9a',
                      }}
                      title={t('nc.undoPlace')}
                    >
                      {NC_CARD_MAP[pp.cardId] ? t(NC_CARD_MAP[pp.cardId].nameKey) : pp.cardId}
                      <span style={{ color: '#5a3a3a' }}>&times;</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mana & Confirm */}
            {myIdx !== null && gs.phase === 'placing' && !resolveAnim && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#4a7dff88' }}>{t('nc.mana')}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: myMaxMana }, (_, i) => (
                      <ManaCrystal
                        key={i}
                        filled={i < availableMana}
                        spent={i >= availableMana && i < myMana}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold tabular-nums" style={{ color: '#4a7dff' }}>{availableMana}/{myMaxMana}</span>
                </div>

                {!mp.isSpectator && (
                  <div className="flex items-center gap-3">
                    {oppConfirmed && (
                      <span className="text-[10px] flex items-center gap-1 uppercase tracking-wider" style={{ color: '#c9a84c88' }}>
                        <svg viewBox="0 0 8 8" className="w-2 h-2"><circle cx="4" cy="4" r="3" fill="#c9a84c"/></svg>
                        {t('nc.oppConfirmed')}
                      </span>
                    )}
                    <button
                      onClick={handleConfirm}
                      disabled={haveConfirmed}
                      className={[
                        'relative px-6 py-2.5 rounded font-black text-sm uppercase tracking-wider transition-all',
                        haveConfirmed ? '' : 'nc-confirm-btn',
                      ].join(' ')}
                      style={{
                        background: haveConfirmed
                          ? 'linear-gradient(135deg, #1a1a2e, #12121f)'
                          : 'linear-gradient(135deg, #c9a84c, #a07c2a)',
                        border: haveConfirmed ? '1px solid #2a2a3a' : '1px solid #e8d48b',
                        color: haveConfirmed ? '#4a4a5a' : '#0a0a12',
                        cursor: haveConfirmed ? 'not-allowed' : 'pointer',
                        boxShadow: haveConfirmed ? 'none' : '0 0 20px rgba(201,168,76,0.3), 0 4px 12px rgba(0,0,0,0.3)',
                      }}
                    >
                      {haveConfirmed ? t('nc.waiting') : t('nc.confirm')}
                      {!haveConfirmed && (
                        <div className="absolute inset-0 rounded nc-confirm-glow" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Resolution phase banner */}
            {resolveAnim && resolveAnim.phase !== 'done' && (
              <div className="flex items-center justify-center gap-3 py-3 nc-resolve-banner">
                <div className="flex items-center gap-3 px-5 py-2 rounded-full" style={{
                  background: 'linear-gradient(135deg, #1a1a2e, #12121f)',
                  border: '1px solid #c9a84c44',
                  boxShadow: '0 0 20px rgba(201,168,76,0.15)',
                }}>
                  {resolveAnim.phase === 'cards' && (
                    <>
                      <div className="nc-resolve-icon">⚔️</div>
                      <span className="text-sm font-black uppercase tracking-[0.15em]" style={{ color: '#c9a84c' }}>{t('nc.resolve.cards')}</span>
                    </>
                  )}
                  {resolveAnim.phase === 'abilities' && (
                    <>
                      <div className="nc-resolve-icon">✨</div>
                      <span className="text-sm font-black uppercase tracking-[0.15em]" style={{ color: '#c084fc' }}>{t('nc.resolve.abilities')}</span>
                    </>
                  )}
                  {resolveAnim.phase === 'push' && (
                    <>
                      <div className="nc-resolve-icon">💥</div>
                      <span className="text-sm font-black uppercase tracking-[0.15em]" style={{ color: '#4a7dff' }}>{t('nc.resolve.push')}</span>
                    </>
                  )}
                  {resolveAnim.phase === 'breakthrough' && (
                    <>
                      <div className="nc-resolve-icon">⭐</div>
                      <span className="text-sm font-black uppercase tracking-[0.15em] nc-bt-text" style={{ color: '#fbbf24' }}>{t('nc.resolve.breakthrough')}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Reveal phase indicator (fallback) */}
            {gs.phase === 'revealing' && !resolveAnim && (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="nc-reveal-spinner w-6 h-6" />
                <span className="text-sm font-bold uppercase tracking-widest" style={{ color: '#c9a84c' }}>{t('nc.revealing')}</span>
              </div>
            )}

            {/* Hand area */}
            {myIdx !== null && gs.phase === 'placing' && !mp.isSpectator && !resolveAnim && (
              <div className="flex flex-col gap-2">
                {/* Hand shelf */}
                <div className="relative" style={{
                  background: 'linear-gradient(to bottom, transparent, #12121f 4px)',
                }}>
                  <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, #c9a84c33, transparent)' }} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] px-2" style={{ color: '#c9a84c55' }}>{t('nc.yourHand')}</p>
                <div className="flex gap-3 flex-wrap justify-center pb-4">
                  {myHand.map((cardId, i) => {
                    const def = NC_CARD_MAP[cardId];
                    const canAfford = def ? def.cost <= availableMana : false;
                    const isSelected = selectedCard === cardId;
                    return (
                      <CardWithTooltip key={`${cardId}-${i}`} cardId={cardId} t={t} className={[
                        'transition-all duration-200',
                        isSelected ? 'nc-hand-card-selected' : 'nc-hand-card',
                      ].join(' ')}>
                        <NexusClashCard
                          card={cardId}
                          selected={isSelected}
                          disabled={!canAfford || haveConfirmed}
                          onClick={() => handleCardClick(cardId)}
                        />
                      </CardWithTooltip>
                    );
                  })}
                  {myHand.length === 0 && (
                    <p className="text-xs py-4" style={{ color: '#3a3a4a' }}>{t('nc.emptyHand')}</p>
                  )}
                </div>
              </div>
            )}

            {mp.isSpectator && <SpectatorBanner spectatorCount={mp.spectatorCount} />}
          </div>
        )}

        {/* ── Ended phase ────────────────────────────────────────────────── */}
        {mp.phase === 'ended' && gs && (
          <div className="flex flex-col items-center gap-8 py-12 relative z-10">
            {gs.status === 'win' && gs.winner === (myIdx !== null ? gs.playerIds[myIdx] : null) && (
              <div className="fixed inset-0 pointer-events-none z-[60]">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div
                    key={i}
                    className="nc-confetti-piece"
                    style={{
                      left: `${Math.random() * 100}%`,
                      background: ['#c9a84c', '#7c3aed', '#4a7dff', '#22d3ee', '#f472b6', '#34d399'][i % 6],
                      '--nc-fall-duration': `${2 + Math.random() * 3}s`,
                      '--nc-fall-delay': `${Math.random() * 1.5}s`,
                      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                      width: `${6 + Math.random() * 6}px`,
                      height: `${6 + Math.random() * 6}px`,
                    } as React.CSSProperties}
                  />
                ))}
              </div>
            )}
            {gs.status === 'win' && myIdx !== null && (
              <div className="flex flex-col items-center gap-3">
                {gs.winner === gs.playerIds[myIdx] ? (
                  <>
                    <div className="nc-victory-text text-5xl font-black uppercase tracking-[0.15em]" style={{
                      background: 'linear-gradient(to bottom, #e8d48b, #c9a84c)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textShadow: 'none',
                      filter: 'drop-shadow(0 0 20px rgba(201,168,76,0.5))',
                    }}>
                      {t('nc.win')}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm" style={{ color: '#c9a84c88' }}>
                      <span>+30</span>
                      <CoinIcon size={14} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-5xl font-black uppercase tracking-[0.15em] nc-defeat-text" style={{
                      color: '#3a3a4a',
                    }}>
                      {t('nc.lose')}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm" style={{ color: '#4a4a5a' }}>
                      <span>+10</span>
                      <CoinIcon size={14} />
                    </div>
                  </>
                )}
              </div>
            )}
            {gs.status === 'draw' && (
              <div className="text-4xl font-black uppercase tracking-[0.15em]" style={{ color: '#6a6a7a' }}>
                {t('nc.draw')}
              </div>
            )}

            {/* Final breakthroughs */}
            <div className="flex items-center gap-8">
              <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-lg" style={{
                background: 'linear-gradient(135deg, #0a0a2a, #12121f)',
                border: '1px solid #1a1a4a',
              }}>
                <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#4a7dff88' }}>{p0nick}</span>
                <span className="text-3xl font-black" style={{ color: '#4a7dff' }}>{gs.breakthroughs[0]}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <svg viewBox="0 0 20 10" className="w-6 h-3" style={{ color: '#3a3a4a' }}>
                  <line x1="2" y1="5" x2="18" y2="5" stroke="currentColor" strokeWidth="1"/>
                </svg>
              </div>
              <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-lg" style={{
                background: 'linear-gradient(135deg, #2a0a0a, #12121f)',
                border: '1px solid #4a1a1a',
              }}>
                <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#ef444488' }}>{p1nick}</span>
                <span className="text-3xl font-black" style={{ color: '#ef4444' }}>{gs.breakthroughs[1]}</span>
              </div>
            </div>

            {/* Rematch */}
            {!mp.isSpectator && mp.playerCount === 2 && (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={mp.requestRematch}
                  disabled={mp.myVotedRematch}
                  className="nc-rematch-btn px-8 py-3 rounded font-black text-sm uppercase tracking-wider transition-all"
                  style={{
                    background: mp.myVotedRematch
                      ? 'linear-gradient(135deg, #1a1a2e, #12121f)'
                      : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                    border: mp.myVotedRematch ? '1px solid #2a2a3a' : '1px solid #a78bfa',
                    color: mp.myVotedRematch ? '#4a4a5a' : 'white',
                    cursor: mp.myVotedRematch ? 'not-allowed' : 'pointer',
                    boxShadow: mp.myVotedRematch ? 'none' : '0 0 20px rgba(124,58,237,0.3)',
                  }}
                >
                  {mp.myVotedRematch ? t('game.actions.waitingRematch') : t('game.actions.rematch')}
                </button>
                {mp.rematchVotes > 0 && !mp.myVotedRematch && (
                  <p className="text-xs" style={{ color: '#c9a84c' }}>{t('game.status.opponentRematch')}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Collapsible chat panel (match view) */}
        {chatVisible && (
          <div className="fixed bottom-4 right-4 w-80 z-40">
            <ChatPanel
              mode="both"
              roomCode={mp.roomCode}
              roomMessages={mp.roomMessages}
              globalMessages={mp.globalMessages}
              chatError={mp.chatError}
              onSend={mp.sendChat}
              collapsible={false}
              defaultOpen={true}
              open={true}
              onOpenChange={() => setChatVisible(false)}
              showUnreadBadge={false}
              unreadCount={0}
              className="rounded-lg shadow-2xl border border-[#2a2a3a] bg-[#12121f]"
            />
          </div>
        )}

        {/* NC Global Styles */}
        <style jsx global>{`
          /* ── Noise overlay ──*/
          .nc-noise-overlay {
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
            background-repeat: repeat;
          }

          /* ── Card animations ──*/
          @keyframes nc-legendary-pulse {
            0%, 100% { box-shadow: 0 0 12px rgba(201,168,76,0.3), inset 0 0 8px rgba(201,168,76,0.1); }
            50% { box-shadow: 0 0 24px rgba(201,168,76,0.6), inset 0 0 16px rgba(201,168,76,0.15); }
          }
          .nc-legendary-pulse { animation: nc-legendary-pulse 2s ease-in-out infinite; }

          @keyframes nc-epic-shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          .nc-epic-shimmer {
            background-size: 200% 100%;
            animation: nc-epic-shimmer 3s linear infinite;
          }

          @keyframes nc-legendary-reveal {
            0% { transform: scale(0.5) rotate(-5deg); filter: brightness(3); }
            50% { transform: scale(1.15) rotate(2deg); filter: brightness(2); }
            100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
          }
          .nc-legendary-reveal { animation: nc-legendary-reveal 0.8s ease-out; }

          @keyframes nc-epic-reveal {
            0% { transform: scale(0.5); filter: brightness(2); }
            100% { transform: scale(1); filter: brightness(1); }
          }
          .nc-epic-reveal { animation: nc-epic-reveal 0.6s ease-out; }

          /* ── Confirm button glow ──*/
          @keyframes nc-confirm-glow-anim {
            0%, 100% { box-shadow: 0 0 10px rgba(201,168,76,0.2); }
            50% { box-shadow: 0 0 25px rgba(201,168,76,0.4), 0 0 50px rgba(201,168,76,0.1); }
          }
          .nc-confirm-glow { animation: nc-confirm-glow-anim 2s ease-in-out infinite; pointer-events: none; }
          .nc-confirm-btn:hover { transform: scale(1.05); }

          /* ── Play button glow ──*/
          @keyframes nc-play-glow {
            0%, 100% { box-shadow: 0 0 20px rgba(201,168,76,0.15), 0 0 60px rgba(124,58,237,0.1); }
            50% { box-shadow: 0 0 40px rgba(201,168,76,0.3), 0 0 80px rgba(124,58,237,0.2); }
          }
          .nc-play-glow { animation: nc-play-glow 2.5s ease-in-out infinite; }

          /* ── Hand card hover ──*/
          .nc-hand-card { transition: transform 0.2s ease, filter 0.2s ease; }
          .nc-hand-card:hover { transform: translateY(-8px) scale(1.05); filter: brightness(1.1); z-index: 10; }
          .nc-hand-card-selected { transform: translateY(-12px) scale(1.08); z-index: 10; filter: brightness(1.15); }

          /* ── Lane hover ──*/
          .nc-lane-hover:hover { border-color: #4a7dff44 !important; box-shadow: inset 0 0 30px rgba(74,125,255,0.05) !important; }
          .nc-lane-locked { }

          /* ── Timer critical ──*/
          @keyframes nc-timer-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .nc-timer-critical { animation: nc-timer-pulse 0.5s ease-in-out infinite; }

          /* ── Reveal spinner ──*/
          @keyframes nc-reveal-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .nc-reveal-spinner {
            border: 2px solid #2a2a3a;
            border-top-color: #c9a84c;
            border-radius: 50%;
            animation: nc-reveal-spin 1s linear infinite;
          }

          /* ── Breakthrough flash ──*/
          @keyframes nc-bt-flash {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          .nc-breakthrough-flash { animation: nc-bt-flash 1.5s ease-in-out infinite; }

          /* ── Victory text ──*/
          @keyframes nc-victory-glow {
            0%, 100% { filter: drop-shadow(0 0 20px rgba(201,168,76,0.5)); }
            50% { filter: drop-shadow(0 0 40px rgba(201,168,76,0.8)); }
          }
          .nc-victory-text { animation: nc-victory-glow 2s ease-in-out infinite; }

          /* ── Defeat text ──*/
          .nc-defeat-text { filter: drop-shadow(0 0 2px rgba(0,0,0,0.8)); }

          /* ── Ghost button hover ──*/
          .nc-btn-ghost:hover { border-color: #c9a84c44 !important; color: #c9a84c !important; }

          /* ── Hub background ──*/
          @keyframes nc-hub-bg-shift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .nc-hub-bg {
            background: linear-gradient(135deg, #0a0a12 0%, #0e0a1a 25%, #0a0a12 50%, #0a1218 75%, #0a0a12 100%);
            background-size: 400% 400%;
            animation: nc-hub-bg-shift 20s ease infinite;
          }

          /* ── Matchmaking portal ──*/
          @keyframes nc-portal-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes nc-portal-pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
          }
          .nc-portal-ring { animation: nc-portal-spin 3s linear infinite; }
          .nc-portal-glow { animation: nc-portal-pulse 2s ease-in-out infinite; }

          /* ── Tab nav ──*/
          .nc-tab-active {
            border-bottom: 2px solid #c9a84c;
            color: #c9a84c !important;
          }

          /* ── Ornamental divider ──*/
          .nc-ornament-divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #c9a84c33, transparent);
          }

          /* ── Resolution animations ──*/
          @keyframes nc-card-reveal-anim {
            0% { transform: scaleX(0) scaleY(1.1); opacity: 0; filter: brightness(3); }
            40% { transform: scaleX(1.15) scaleY(0.95); opacity: 1; filter: brightness(2); }
            100% { transform: scaleX(1) scaleY(1); opacity: 1; filter: brightness(1); }
          }
          .nc-card-reveal { animation: nc-card-reveal-anim 0.5s ease-out; }

          @keyframes nc-ability-glow-anim {
            0% { box-shadow: 0 0 0 rgba(192,132,252,0); }
            30% { box-shadow: 0 0 16px rgba(192,132,252,0.7), 0 0 32px rgba(192,132,252,0.3); }
            100% { box-shadow: 0 0 4px rgba(192,132,252,0.2); }
          }
          .nc-card-ability-glow { animation: nc-ability-glow-anim 0.8s ease-out; border-radius: 6px; }

          @keyframes nc-floating-text-anim {
            0% { opacity: 0; transform: translateX(-50%) translateY(0); }
            15% { opacity: 1; transform: translateX(-50%) translateY(-4px); }
            70% { opacity: 1; transform: translateX(-50%) translateY(-12px); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-24px); }
          }
          .nc-floating-text { animation: nc-floating-text-anim 1.2s ease-out forwards; }

          @keyframes nc-push-number-anim {
            0% { transform: scale(0.5); opacity: 0; }
            30% { transform: scale(1.3); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .nc-push-number { animation: nc-push-number-anim 0.5s ease-out; }

          @keyframes nc-breakthrough-explode-anim {
            0% { opacity: 0; transform: scale(0.8); }
            20% { opacity: 1; transform: scale(1.05); }
            50% { opacity: 0.8; transform: scale(1); }
            100% { opacity: 0; transform: scale(1.2); }
          }
          .nc-breakthrough-explode { animation: nc-breakthrough-explode-anim 1.5s ease-out forwards; }

          @keyframes nc-resolve-banner-enter {
            0% { opacity: 0; transform: translateY(-8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .nc-resolve-banner { animation: nc-resolve-banner-enter 0.3s ease-out; }

          @keyframes nc-resolve-icon-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
          }
          .nc-resolve-icon { animation: nc-resolve-icon-pulse 1s ease-in-out infinite; font-size: 18px; }

          @keyframes nc-bt-text-glow {
            0%, 100% { text-shadow: 0 0 8px rgba(251,191,36,0.3); }
            50% { text-shadow: 0 0 20px rgba(251,191,36,0.8), 0 0 40px rgba(251,191,36,0.3); }
          }
          .nc-bt-text { animation: nc-bt-text-glow 1s ease-in-out infinite; }
        `}</style>
      </div>
    );
  }

  // ── HUB VIEW (lobby / waiting / no game state) ────────────────────────────

  const TAB_ITEMS: { id: HubTab; labelKey: string }[] = [
    { id: 'play', labelKey: 'nc.hub.play' },
    { id: 'decks', labelKey: 'nc.hub.decks' },
    { id: 'shop', labelKey: 'nc.hub.shop' },
    { id: 'collection', labelKey: 'nc.hub.collection' },
    { id: 'quests', labelKey: 'nc.hub.quests' },
  ];

  return (
    <div className="nc-hub-bg w-full flex flex-col gap-0 min-h-[600px]" style={{
      minHeight: '100vh',
      color: '#e0e0e8',
    }}>
      {/* Atmospheric noise overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 nc-noise-overlay" style={{ opacity: 0.02 }} />

      {/* Vignette overlay */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: 'radial-gradient(ellipse at center, transparent 30%, #0a0a12 100%)',
      }} />

      {/* Animated particle field behind header */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="nc-hub-particles absolute inset-0" />
      </div>

      {/* ── Header Bar ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          {/* Title treatment */}
          <div className="flex flex-col items-start">
            <div className="relative">
              {/* Glow behind title */}
              <div className="absolute -inset-4 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.08), transparent 70%)',
              }} />
              <div className="nc-hub-title nc-gold-text text-4xl font-black uppercase tracking-[0.25em] select-none relative" style={{
                background: 'linear-gradient(135deg, #e8d48b 0%, #c9a84c 30%, #f0e6b8 50%, #c9a84c 70%, #e8d48b 100%)',
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 16px rgba(201,168,76,0.4))',
              }}>
                NEXUS CLASH
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="h-px flex-1" style={{
                background: 'linear-gradient(to right, #c9a84c66, transparent)',
                width: '120px',
              }} />
              <span className="text-[8px] uppercase tracking-[0.3em] font-bold" style={{ color: '#c9a84c44' }}>
                TCG
              </span>
              {/* Tutorial button */}
              <button
                onClick={() => setShowTutorial(true)}
                className="ml-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-all hover:brightness-150"
                style={{
                  background: '#c9a84c22',
                  border: '1px solid #c9a84c44',
                  color: '#c9a84c',
                }}
                title={t('nc.tutorial.title')}
              >
                ?
              </button>
            </div>
          </div>

          {/* Currency display */}
          <div className="flex items-center gap-2">
            {/* Coins */}
            <div className="nc-currency-pill flex items-center gap-2 px-3.5 py-2 rounded-lg" style={{
              background: 'linear-gradient(135deg, #1a1808 0%, #12121f 100%)',
              border: '1px solid #c9a84c33',
              boxShadow: 'inset 0 1px 0 rgba(201,168,76,0.05), 0 2px 8px rgba(0,0,0,0.3)',
            }}>
              <CoinIcon size={18} />
              <span className="text-sm font-black tabular-nums" style={{ color: '#e8d48b' }}>{ncProfile.profile.currencies.coins}</span>
            </div>
            {/* Gems */}
            <div className="nc-currency-pill flex items-center gap-2 px-3.5 py-2 rounded-lg" style={{
              background: 'linear-gradient(135deg, #150a2a 0%, #12121f 100%)',
              border: '1px solid #7c3aed33',
              boxShadow: 'inset 0 1px 0 rgba(124,58,237,0.05), 0 2px 8px rgba(0,0,0,0.3)',
            }}>
              <GemIcon size={18} />
              <span className="text-sm font-black tabular-nums" style={{ color: '#a78bfa' }}>{ncProfile.profile.currencies.gems}</span>
            </div>
            {/* Shards */}
            <div className="nc-currency-pill flex items-center gap-2 px-3.5 py-2 rounded-lg" style={{
              background: 'linear-gradient(135deg, #0a1a1e 0%, #12121f 100%)',
              border: '1px solid #22d3ee22',
              boxShadow: 'inset 0 1px 0 rgba(34,211,238,0.05), 0 2px 8px rgba(0,0,0,0.3)',
            }}>
              <ShardIcon size={18} />
              <span className="text-sm font-black tabular-nums" style={{ color: '#67e8f9' }}>{ncProfile.profile.currencies.shards ?? 0}</span>
            </div>
            {/* Daily Login Calendar */}
            <button
              onClick={() => setShowDailyCalendar(true)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg transition-all hover:brightness-125"
              style={{
                background: 'linear-gradient(135deg, #1a1a08 0%, #12121f 100%)',
                border: '1px solid #c9a84c22',
              }}
              title={t('nc.dailyLogin.title')}
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4">
                <rect x="2" y="4" width="16" height="14" rx="2" fill="none" stroke="#c9a84c" strokeWidth="1.5"/>
                <line x1="2" y1="8" x2="18" y2="8" stroke="#c9a84c" strokeWidth="1"/>
                <line x1="6" y1="2" x2="6" y2="5" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="14" y1="2" x2="14" y2="5" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round"/>
                <polygon points="10,11 11,13.5 13.5,13.5 11.5,15 12.5,17.5 10,15.5 7.5,17.5 8.5,15 6.5,13.5 9,13.5" fill="#c9a84c" opacity="0.8"/>
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#c9a84c' }}>
                {t('nc.dailyLogin.dayShort')}{ncProfile.profile.loginDay || 0}
              </span>
            </button>
            {/* Connection */}
            <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg" style={{
              background: '#0a0a1266',
              border: '1px solid #2a2a3a',
            }}>
              <span className={`w-2 h-2 rounded-full ${
                mp.connection === 'connected'  ? 'bg-emerald-400' :
                mp.connection === 'connecting' ? 'bg-amber-400 animate-pulse' :
                'bg-rose-500'
              }`} style={{
                boxShadow: mp.connection === 'connected'
                  ? '0 0 6px rgba(52,211,153,0.5)'
                  : mp.connection === 'connecting'
                    ? '0 0 6px rgba(251,191,36,0.5)'
                    : '0 0 6px rgba(244,63,94,0.5)',
              }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{
                color: mp.connection === 'connected' ? '#34d399' : mp.connection === 'connecting' ? '#fbbf24' : '#f43f5e',
              }}>
                {mp.connection === 'connected' ? 'LIVE' : mp.connection === 'connecting' ? '...' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 px-6">
        <div className="flex items-center justify-center gap-0 relative">
          {TAB_ITEMS.map((tab) => {
            const isActive = hubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setHubTab(tab.id)}
                className="nc-hub-tab relative flex items-center gap-1.5 px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] transition-all"
                style={{
                  color: isActive ? '#c9a84c' : '#5a5a6a',
                  background: 'transparent',
                  border: 'none',
                }}
              >
                <TabIcon tab={tab.id} active={isActive} />
                {t(tab.labelKey)}
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full nc-tab-indicator" style={{
                    background: 'linear-gradient(to right, transparent, #c9a84c, transparent)',
                    boxShadow: '0 0 8px rgba(201,168,76,0.4)',
                  }} />
                )}
              </button>
            );
          })}
        </div>
        <div className="h-px" style={{
          background: 'linear-gradient(to right, transparent, #c9a84c22, #c9a84c44, #c9a84c22, transparent)',
        }} />
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {mp.error && (
        <div className="relative z-10 mx-6 mt-3 rounded-lg p-3 text-sm flex justify-between items-start gap-2" style={{
          border: '1px solid #5a1a1a',
          background: 'linear-gradient(135deg, #1a0808, #12121f)',
          color: '#ff6b6b',
        }}>
          <span>{mp.error}</span>
          <button onClick={mp.clearError} className="text-lg leading-none shrink-0 hover:text-white" style={{ color: '#ff6b6b' }}>&times;</button>
        </div>
      )}

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-6 relative z-10">

        {/* ── PLAY TAB ──────────────────────────────────────────────────── */}
        {hubTab === 'play' && (
          <div className="flex flex-col items-center gap-8 max-w-xl mx-auto nc-play-tab-enter">
            {/* Atmospheric center glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] pointer-events-none" style={{
              background: 'radial-gradient(ellipse at 50% 30%, rgba(124,58,237,0.08) 0%, rgba(74,125,255,0.03) 40%, transparent 70%)',
            }} />

            {/* ── Hero Play Button Section ── */}
            <div className="relative w-full flex flex-col items-center py-4">
              {/* Ornamental rune circle behind button */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] pointer-events-none">
                <div className="absolute inset-0 nc-rune-circle rounded-full" style={{
                  border: '1px solid #7c3aed15',
                }} />
                <div className="absolute inset-6 nc-rune-circle-inner rounded-full" style={{
                  border: '1px dashed #c9a84c10',
                }} />
              </div>

              {/* Play button */}
              <button
                onClick={() => mp.quickPlay()}
                disabled={mp.connection !== 'connected' || mp.phase === 'waiting'}
                className={[
                  'nc-play-btn relative px-20 py-7 rounded-xl font-black text-2xl uppercase tracking-[0.25em] transition-all',
                  mp.connection === 'connected' && mp.phase !== 'waiting'
                    ? 'cursor-pointer hover:scale-[1.03] active:scale-[0.98]'
                    : 'cursor-not-allowed',
                ].join(' ')}
                style={{
                  background: mp.connection === 'connected' && mp.phase !== 'waiting'
                    ? 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 40%, #4a3aed 70%, #4a7dff 100%)'
                    : 'linear-gradient(135deg, #1a1a2e, #12121f)',
                  border: mp.connection === 'connected' && mp.phase !== 'waiting'
                    ? '2px solid #a78bfa'
                    : '1px solid #2a2a3a',
                  color: mp.connection === 'connected' && mp.phase !== 'waiting' ? 'white' : '#4a4a5a',
                  boxShadow: mp.connection === 'connected' && mp.phase !== 'waiting'
                    ? '0 0 60px rgba(124,58,237,0.35), 0 0 120px rgba(74,125,255,0.1), inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.4)'
                    : 'none',
                }}
              >
                {/* Inner shimmer line */}
                {mp.connection === 'connected' && mp.phase !== 'waiting' && (
                  <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                    <div className="nc-btn-shimmer absolute inset-0" />
                  </div>
                )}
                <span className="relative z-10">{t('nc.hub.play')}</span>
                {/* Decorative corner accents */}
                <div className="absolute top-0 left-0 w-5 h-5" style={{ borderTop: '2px solid #c9a84c55', borderLeft: '2px solid #c9a84c55' }} />
                <div className="absolute top-0 right-0 w-5 h-5" style={{ borderTop: '2px solid #c9a84c55', borderRight: '2px solid #c9a84c55' }} />
                <div className="absolute bottom-0 left-0 w-5 h-5" style={{ borderBottom: '2px solid #c9a84c55', borderLeft: '2px solid #c9a84c55' }} />
                <div className="absolute bottom-0 right-0 w-5 h-5" style={{ borderBottom: '2px solid #c9a84c55', borderRight: '2px solid #c9a84c55' }} />
              </button>

              {/* Subtitle under button */}
              <p className="mt-3 text-[10px] uppercase tracking-[0.3em] font-semibold" style={{ color: '#5a5a6a' }}>
                {t('nc.hub.findingMatch')}
              </p>
            </div>

            {/* ── VS Bot Section ── */}
            <div className="w-full rounded-xl overflow-hidden" style={{
              background: 'linear-gradient(135deg, #0e0e1a 0%, #12121f 50%, #0e0e1a 100%)',
              border: '1px solid #1e1e3a',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)',
            }}>
              <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid #1a1a2a' }}>
                <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0">
                  <rect x="4" y="3" width="12" height="14" rx="2" fill="none" stroke="#c9a84c" strokeWidth="1.3"/>
                  <circle cx="8" cy="8" r="1.5" fill="#c9a84c"/>
                  <circle cx="12" cy="8" r="1.5" fill="#c9a84c"/>
                  <path d="M7 12.5C7 12.5 8.5 14 10 14C11.5 14 13 12.5 13 12.5" fill="none" stroke="#c9a84c" strokeWidth="1" strokeLinecap="round"/>
                </svg>
                <span className="text-xs font-black uppercase tracking-[0.15em]" style={{ color: '#c9a84c' }}>
                  {t('nc.bot.title')}
                </span>
              </div>
              <div className="px-5 py-4 flex flex-col gap-3">
                {/* Difficulty selector */}
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as const).map(diff => {
                    const isActive = botDifficulty === diff;
                    const colors: Record<string, { bg: string; border: string; text: string }> = {
                      easy: { bg: '#1a2a1a', border: '#4ade8044', text: '#4ade80' },
                      medium: { bg: '#1a1a2a', border: '#c9a84c44', text: '#c9a84c' },
                      hard: { bg: '#2a1a1a', border: '#ef444444', text: '#ef4444' },
                    };
                    const c = colors[diff];
                    return (
                      <button
                        key={diff}
                        onClick={() => setBotDifficulty(diff)}
                        className="flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all"
                        style={{
                          background: isActive ? c.bg : '#0a0a12',
                          border: `1px solid ${isActive ? c.border : '#1e1e3a'}`,
                          color: isActive ? c.text : '#4a4a5a',
                        }}
                      >
                        {t(`nc.bot.${diff}`)}
                      </button>
                    );
                  })}
                </div>
                {/* Start button */}
                <button
                  onClick={() => {
                    mp.createRoom({
                      ncConfig: { botDifficulty },
                    });
                  }}
                  disabled={mp.connection !== 'connected' || mp.phase === 'waiting'}
                  className="w-full py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all hover:brightness-110"
                  style={{
                    background: mp.connection === 'connected' && mp.phase !== 'waiting'
                      ? 'linear-gradient(135deg, #1a1a2e, #0e0e1a)'
                      : '#0a0a12',
                    border: '1px solid #c9a84c33',
                    color: mp.connection === 'connected' && mp.phase !== 'waiting' ? '#c9a84c' : '#4a4a5a',
                    cursor: mp.connection !== 'connected' || mp.phase === 'waiting' ? 'not-allowed' : 'pointer',
                    opacity: mp.connection !== 'connected' || mp.phase === 'waiting' ? 0.4 : 1,
                  }}
                >
                  {t('nc.bot.start')}
                </button>
              </div>
            </div>

            {/* ── Deck & Stats Card ── */}
            <div className="w-full rounded-xl overflow-hidden" style={{
              background: 'linear-gradient(135deg, #0e0e1a 0%, #12121f 50%, #0e0e1a 100%)',
              border: '1px solid #1e1e3a',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)',
            }}>
              {/* Deck selection row */}
              <div className="flex items-center gap-4 px-5 py-4" style={{
                borderBottom: '1px solid #1a1a2a',
              }}>
                {/* Card stack icon */}
                <div className="relative w-10 h-14 shrink-0">
                  <div className="absolute left-0 top-0 w-8 h-12 rounded" style={{
                    background: 'linear-gradient(135deg, #1e1e3a, #12121f)',
                    border: '1px solid #3a3a5a',
                    transform: 'rotate(-6deg)',
                  }} />
                  <div className="absolute left-1 top-0 w-8 h-12 rounded flex items-center justify-center" style={{
                    background: 'linear-gradient(135deg, #1e1e3a, #0e0e1a)',
                    border: '1px solid #4a4a6a',
                    transform: 'rotate(3deg)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}>
                    <svg viewBox="0 0 12 12" className="w-4 h-4"><polygon points="6,1 11,4 9,11 3,11 1,4" fill="#4a7dff33" stroke="#4a7dff" strokeWidth="0.8"/></svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] uppercase tracking-[0.2em] font-bold block" style={{ color: '#6a6a7a' }}>{t('nc.selectedDeck')}</span>
                  <span className="text-base font-black block truncate" style={{ color: '#e0e0e8' }}>
                    {ncProfile.profile.decks.find(d => d.id === ncProfile.profile.selectedDeckId)?.name ?? 'Starter'}
                  </span>
                </div>
                <button
                  onClick={() => setHubTab('decks')}
                  className="text-xs font-bold transition-all nc-btn-ghost px-3 py-1.5 rounded-lg"
                  style={{ color: '#c9a84c', border: '1px solid #c9a84c33', background: '#c9a84c08' }}
                >
                  {t('nc.changeDeck')}
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 divide-x divide-[#1a1a2a]">
                {[
                  { value: ncProfile.profile.wins, label: t('nc.stats.wins'), accent: '#4a7dff', glow: 'rgba(74,125,255,0.06)' },
                  { value: ncProfile.profile.matchesPlayed, label: t('nc.stats.matches'), accent: '#c9a84c', glow: 'rgba(201,168,76,0.06)' },
                  { value: `${winRate}%`, label: t('nc.stats.winrate'), accent: '#7c3aed', glow: 'rgba(124,58,237,0.06)' },
                ].map((stat, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 py-4 relative overflow-hidden">
                    {/* Radial accent */}
                    <div className="absolute top-0 inset-x-0 h-12 pointer-events-none" style={{
                      background: `radial-gradient(ellipse at 50% 0%, ${stat.glow}, transparent 70%)`,
                    }} />
                    {/* Top accent line */}
                    <div className="absolute top-0 left-[25%] right-[25%] h-px" style={{ background: stat.accent + '33' }} />
                    <span className="text-2xl font-black relative" style={{ color: stat.accent }}>{stat.value}</span>
                    <span className="text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: '#5a5a6a' }}>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active quests preview */}
            {activeQuests.length > 0 && (
              <div className="w-full flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-[0.15em] font-bold" style={{ color: '#6a6a7a' }}>{t('nc.hub.quests')}</span>
                  <button
                    onClick={() => setHubTab('quests')}
                    className="text-[10px] transition-all nc-btn-ghost"
                    style={{ color: '#c9a84c88' }}
                  >
                    {t('nc.hub.quests')} &rarr;
                  </button>
                </div>
                {activeQuests.map(quest => {
                  const progress = Math.min(quest.currentCount / quest.targetCount, 1);
                  const goalLabel = t(`nc.quest.goal.${quest.goalType}`) +
                    (quest.goalParam ? ` (${t(`nc.tag.${quest.goalParam}`)})` : '');
                  return (
                    <div key={quest.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{
                      background: 'linear-gradient(135deg, #12121f, #0e0e1a)',
                      border: '1px solid #1e1e3a',
                    }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: '#b0b0b8' }}>{goalLabel}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1a2e' }}>
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${progress * 100}%`,
                              background: 'linear-gradient(to right, #4a7dff, #7c3aed)',
                            }} />
                          </div>
                          <span className="text-[10px] tabular-nums" style={{ color: '#5a5a6a' }}>{quest.currentCount}/{quest.targetCount}</span>
                        </div>
                      </div>
                      {quest.reward.coins && (
                        <div className="flex items-center gap-0.5">
                          <span className="text-[10px] font-bold" style={{ color: '#c9a84c' }}>+{quest.reward.coins}</span>
                          <CoinIcon size={12} />
                        </div>
                      )}
                      {quest.reward.gems && (
                        <div className="flex items-center gap-0.5">
                          <span className="text-[10px] font-bold" style={{ color: '#7c3aed' }}>+{quest.reward.gems}</span>
                          <GemIcon size={12} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom Game section */}
            <div className="w-full">
              <button
                onClick={() => setCustomExpanded(v => !v)}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-all nc-btn-ghost"
                style={{ color: '#5a5a6a' }}
              >
                <svg
                  className={`w-3 h-3 transition-transform ${customExpanded ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {t('nc.hub.customGame')}
              </button>

              {customExpanded && (
                <div className="mt-3 flex flex-col gap-3 p-4 rounded-lg" style={{
                  background: 'linear-gradient(135deg, #12121f, #0e0e1a)',
                  border: '1px solid #1e1e3a',
                }}>
                  {/* Visibility */}
                  <div className="flex gap-1 p-1 rounded" style={{ background: '#0a0a12', border: '1px solid #1e1e3a' }}>
                    {(['private', 'public'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setRoomVisibility(v)}
                        className="flex-1 py-1.5 text-xs rounded font-semibold uppercase tracking-wider transition-all"
                        style={{
                          background: roomVisibility === v ? '#1e1e3a' : 'transparent',
                          color: roomVisibility === v ? '#c9a84c' : '#5a5a6a',
                        }}
                      >
                        {t(`game.lobby.${v}`)}
                      </button>
                    ))}
                  </div>
                  {roomVisibility === 'public' && (
                    <input
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value.slice(0, 24))}
                      placeholder={t('game.lobby.roomName')}
                      maxLength={24}
                      className="rounded px-3 py-2 text-sm focus:outline-none"
                      style={{
                        background: '#0a0a12',
                        border: '1px solid #2a2a3a',
                        color: '#e0e0e8',
                      }}
                    />
                  )}

                  <button
                    onClick={() => {
                      mp.createRoom({
                        visibility: roomVisibility,
                        roomName: roomName.trim() || undefined,
                      });
                    }}
                    disabled={mp.connection !== 'connected'}
                    className="w-full py-2.5 rounded font-bold text-sm uppercase tracking-wider transition-all"
                    style={{
                      background: mp.connection === 'connected'
                        ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                        : '#1a1a2e',
                      border: '1px solid #7c3aed44',
                      color: mp.connection === 'connected' ? 'white' : '#4a4a5a',
                      cursor: mp.connection !== 'connected' ? 'not-allowed' : 'pointer',
                      opacity: mp.connection !== 'connected' ? 0.4 : 1,
                    }}
                  >
                    {t('nc.hub.createRoom')}
                  </button>

                  <div className="flex items-center gap-2 text-[10px]" style={{ color: '#4a4a5a' }}>
                    <div className="flex-1 h-px" style={{ background: '#2a2a3a' }} />
                    {t('nc.hub.or')}
                    <div className="flex-1 h-px" style={{ background: '#2a2a3a' }} />
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value.toUpperCase().slice(0, 6))}
                      placeholder={t('game.lobby.roomCode')}
                      maxLength={6}
                      className="flex-1 rounded px-3 py-2 text-sm uppercase tracking-widest font-mono focus:outline-none"
                      style={{
                        background: '#0a0a12',
                        border: '1px solid #2a2a3a',
                        color: '#e0e0e8',
                      }}
                    />
                    <button
                      onClick={() => mp.joinRoom(joinInput)}
                      disabled={joinInput.length < 4 || mp.connection !== 'connected'}
                      className="px-4 py-2 rounded font-semibold text-sm transition-all"
                      style={{
                        background: joinInput.length >= 4 ? '#1e1e3a' : '#12121f',
                        border: '1px solid #2a2a3a',
                        color: joinInput.length >= 4 ? '#e0e0e8' : '#4a4a5a',
                        cursor: joinInput.length < 4 ? 'not-allowed' : 'pointer',
                        opacity: joinInput.length < 4 ? 0.4 : 1,
                      }}
                    >
                      {t('nc.hub.joinRoom')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DECKS TAB ─────────────────────────────────────────────────── */}
        {hubTab === 'decks' && (
          <div className="relative w-full h-[75vh]">
            <DeckBuilder
              profile={ncProfile.profile}
              onSave={ncProfile.saveDecks}
              onClose={() => setHubTab('play')}
            />
          </div>
        )}

        {/* ── SHOP TAB ──────────────────────────────────────────────────── */}
        {hubTab === 'shop' && (
          <div className="fixed inset-0 z-50 flex flex-col" style={{
            background: 'radial-gradient(ellipse at top, #12121f 0%, #0a0a12 60%)',
          }}>
            {/* Shop top bar — z-[60] to float above PackOpening's fixed overlay */}
            <div className="relative z-[60] shrink-0 flex flex-col items-center" style={{
              background: 'linear-gradient(180deg, #0e0e1a, #0a0a12ee)',
              borderBottom: '1px solid #1e1e3a',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
              {/* Back + Title row */}
              <div className="flex items-center w-full px-4 pt-3 pb-1">
                <button
                  onClick={() => setHubTab('play')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:brightness-125"
                  style={{ color: '#6a6a7a' }}
                >
                  <svg viewBox="0 0 16 16" className="w-4 h-4"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t('nc.shop.back')}</span>
                </button>
                <span className="flex-1 text-center text-sm font-black uppercase tracking-[0.2em] -ml-12" style={{ color: '#c9a84c' }}>
                  {t('nc.hub.shop')}
                </span>
              </div>
              {/* Tab row with underline indicators */}
              <div className="flex items-center gap-0">
                {(['packs', 'shards'] as const).map(st => {
                  const active = shopSubTab === st;
                  const color = st === 'packs' ? '#c9a84c' : '#67e8f9';
                  return (
                    <button
                      key={st}
                      onClick={() => setShopSubTab(st)}
                      className="relative flex items-center gap-2 px-6 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-all"
                      style={{
                        color: active ? color : '#4a4a5a',
                        background: 'transparent',
                        border: 'none',
                      }}
                    >
                      {st === 'packs' ? (
                        <svg viewBox="0 0 16 16" className="w-4 h-4">
                          <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" className="w-4 h-4">
                          <polygon points="8,1 10,6 15,6 11,9.5 12.5,14.5 8,11 3.5,14.5 5,9.5 1,6 6,6" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                        </svg>
                      )}
                      {t(st === 'packs' ? 'nc.shop.packs' : 'nc.shop.shards')}
                      {active && (
                        <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full" style={{
                          background: `linear-gradient(to right, transparent, ${color}, transparent)`,
                          boxShadow: `0 0 8px ${color}66`,
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Shop content */}
            <div className="flex-1 overflow-y-auto">
              {shopSubTab === 'packs' && (
                <PackOpening
                  profile={ncProfile.profile}
                  onUpdateProfile={ncProfile.updateProfile}
                  onClose={() => setHubTab('play')}
                />
              )}

              {shopSubTab === 'shards' && (
                <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full px-4 py-6">
                  {/* Header with shard balance */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3 px-6 py-3 rounded-xl" style={{
                      background: 'linear-gradient(135deg, #0a1a1e 0%, #12121f 100%)',
                      border: '1px solid #22d3ee33',
                      boxShadow: '0 0 30px rgba(34,211,238,0.08)',
                    }}>
                      <ShardIcon size={28} />
                      <span className="text-3xl font-black tabular-nums" style={{ color: '#67e8f9' }}>{ncProfile.profile.currencies.shards ?? 0}</span>
                      <span className="text-xs uppercase tracking-wider font-bold" style={{ color: '#6a6a7a' }}>{t('nc.shop.shardBalance')}</span>
                    </div>
                    <p className="text-xs text-center max-w-sm" style={{ color: '#5a5a6a' }}>{t('nc.shop.shardDesc')}</p>
                  </div>

                  {/* Card grid grouped by rarity */}
                  {(['legendary', 'epic', 'rare', 'common'] as NcRarity[]).map(rarity => {
                    const cardsOfRarity = NC_CARDS.filter(c => c.rarity === rarity);
                    const rarityColor: Record<string, string> = {
                      common: '#9ca3af', rare: '#4a7dff', epic: '#7c3aed', legendary: '#c9a84c',
                    };
                    const price = NC_SHARD_PRICES[rarity];
                    return (
                      <div key={rarity}>
                        {/* Rarity header */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-1.5 h-5 rounded-full" style={{ background: rarityColor[rarity] }} />
                          <span className="text-sm font-black uppercase tracking-wider" style={{ color: rarityColor[rarity] }}>
                            {t(`nc.rarity.${rarity}`)}
                          </span>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{
                            background: '#22d3ee11', border: '1px solid #22d3ee22',
                          }}>
                            <ShardIcon size={12} />
                            <span className="text-[11px] font-bold" style={{ color: '#67e8f9' }}>{price}</span>
                            <span className="text-[9px]" style={{ color: '#5a5a6a' }}>{t('nc.shop.each')}</span>
                          </div>
                          <div className="flex-1 h-px" style={{ background: `${rarityColor[rarity]}15` }} />
                        </div>
                        {/* Card grid with actual card visuals */}
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
                          {cardsOfRarity.map(card => {
                            const owned = (ncProfile.profile.collection.cards[card.id] ?? 0) >= NC_MAX_COPIES;
                            const canBuy = !owned && (ncProfile.profile.currencies.shards ?? 0) >= price;
                            return (
                              <LazyShopCard key={card.id}>
                                <div className="relative">
                                  <NexusClashCard card={card} locked={!owned && !canBuy} compact />
                                  {/* Owned badge */}
                                  {owned && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-lg" style={{
                                      background: 'rgba(10,10,18,0.65)',
                                    }}>
                                      <div className="flex items-center gap-1 px-2 py-1 rounded-md" style={{
                                        background: '#16a34a22', border: '1px solid #16a34a44',
                                      }}>
                                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
                                          <path d="M3 8l3 3 7-7" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        <span className="text-[10px] font-bold" style={{ color: '#4ade80' }}>{t('nc.shop.owned')}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {/* Card name */}
                                <p className="text-[10px] font-semibold truncate max-w-full text-center" style={{
                                  color: owned ? '#4a4a5a' : '#c0c0d0',
                                }}>
                                  {t(card.nameKey)}
                                </p>
                                {/* Buy button */}
                                {!owned && (
                                  <button
                                    disabled={!canBuy}
                                    onClick={() => {
                                      if (!canBuy) return;
                                      ncProfile.updateProfile({
                                        ...ncProfile.profile,
                                        currencies: {
                                          ...ncProfile.profile.currencies,
                                          shards: (ncProfile.profile.currencies.shards ?? 0) - price,
                                        },
                                        collection: {
                                          ...ncProfile.profile.collection,
                                          cards: {
                                            ...ncProfile.profile.collection.cards,
                                            [card.id]: (ncProfile.profile.collection.cards[card.id] ?? 0) + 1,
                                          },
                                        },
                                      });
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.03] active:scale-[0.98]"
                                    style={{
                                      background: canBuy
                                        ? 'linear-gradient(135deg, #0a2a2e33, #22d3ee22)'
                                        : '#1a1a2e',
                                      border: `1px solid ${canBuy ? '#22d3ee55' : '#2a2a3a'}`,
                                      color: canBuy ? '#67e8f9' : '#3a3a4a',
                                      cursor: canBuy ? 'pointer' : 'not-allowed',
                                      boxShadow: canBuy ? '0 0 12px rgba(34,211,238,0.1)' : 'none',
                                    }}
                                  >
                                    <ShardIcon size={11} />
                                    {price}
                                  </button>
                                )}
                              </LazyShopCard>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COLLECTION TAB ────────────────────────────────────────────── */}
        {hubTab === 'collection' && (
          <div className="relative w-full h-[75vh]">
            <Collection
              profile={ncProfile.profile}
              onClose={() => setHubTab('play')}
            />
          </div>
        )}

        {/* ── QUESTS TAB ────────────────────────────────────────────────── */}
        {hubTab === 'quests' && (
          <div className="relative w-full">
            <QuestTracker
              profile={ncProfile.profile}
              onClaimQuest={ncProfile.claimQuest}
              onClose={() => setHubTab('play')}
            />
          </div>
        )}
      </div>

      {/* ── Matchmaking Overlay (waiting phase) ────────────────────────────── */}
      {mp.phase === 'waiting' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" style={{
          background: 'radial-gradient(ellipse at center, #0a0a12ee, #050510ff)',
          backdropFilter: 'blur(8px)',
        }}>
          <div className="flex flex-col items-center gap-8">
            {/* Portal vortex */}
            <div className="relative w-32 h-32">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full nc-portal-ring" style={{
                border: '2px solid #7c3aed44',
                boxShadow: '0 0 30px rgba(124,58,237,0.2)',
              }} />
              {/* Middle ring */}
              <div className="absolute inset-3 rounded-full nc-portal-ring" style={{
                border: '1px solid #4a7dff44',
                boxShadow: '0 0 20px rgba(74,125,255,0.15)',
                animationDirection: 'reverse',
                animationDuration: '4s',
              }} />
              {/* Inner glow */}
              <div className="absolute inset-6 rounded-full nc-portal-glow" style={{
                background: 'radial-gradient(circle, #7c3aed33, transparent)',
              }} />
              {/* Center dot */}
              <div className="absolute inset-[38%] rounded-full" style={{
                background: '#c9a84c',
                boxShadow: '0 0 20px #c9a84c, 0 0 40px #c9a84c66',
              }} />
            </div>

            {/* Text */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-bold uppercase tracking-[0.2em]" style={{ color: '#c9a84c' }}>
                {t('nc.hub.findingMatch')}
              </p>
              {mp.roomCode && (
                <p className="text-xs font-mono tracking-widest" style={{ color: '#4a4a5a' }}>{mp.roomCode}</p>
              )}
            </div>

            {/* Player silhouettes */}
            <div className="flex items-center gap-10">
              {/* You */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-16 rounded-lg flex items-center justify-center" style={{
                  background: 'linear-gradient(135deg, #1a1a3a, #12121f)',
                  border: '1px solid #4a7dff44',
                  boxShadow: '0 0 10px rgba(74,125,255,0.1)',
                }}>
                  <svg viewBox="0 0 20 20" className="w-5 h-5"><circle cx="10" cy="7" r="4" fill="#4a7dff"/><path d="M3 18C3 14 6 12 10 12C14 12 17 14 17 18" fill="#4a7dff" opacity="0.5"/></svg>
                </div>
                <span className="text-[10px] font-semibold" style={{ color: '#4a7dff' }}>YOU</span>
              </div>

              {/* VS */}
              <span className="text-xs font-black" style={{ color: '#c9a84c44' }}>VS</span>

              {/* Opponent (mystery) */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-16 rounded-lg flex items-center justify-center nc-portal-glow" style={{
                  background: 'linear-gradient(135deg, #1a1a2e, #12121f)',
                  border: '1px solid #3a3a4a',
                }}>
                  <span className="text-2xl font-black" style={{ color: '#3a3a4a' }}>?</span>
                </div>
                <span className="text-[10px] font-semibold" style={{ color: '#4a4a5a' }}>???</span>
              </div>
            </div>

            {/* Cancel */}
            <button
              onClick={mp.leaveRoom}
              className="px-6 py-2.5 rounded font-semibold text-sm uppercase tracking-wider transition-all nc-btn-ghost"
              style={{
                border: '1px solid #2a2a3a',
                color: '#6a6a7a',
                background: '#0a0a1299',
              }}
            >
              {t('nc.hub.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* ── Daily Login Calendar (auto-claim or manual view) ─────────── */}
      {(ncProfile.dailyLoginReward || showDailyCalendar) && (() => {
        const isClaim = !!ncProfile.dailyLoginReward;
        // loginDay = last claimed day number (continuous)
        const claimedUpTo = ncProfile.profile.loginDay || 0;
        const todayReward = isClaim ? ncProfile.dailyLoginReward! : null;
        // Show 7 days: today (or next unclaimed) + 6 upcoming
        const startDay = isClaim ? claimedUpTo : claimedUpTo + 1;
        const days = Array.from({ length: 7 }, (_, i) => {
          const dayNum = startDay + i;
          return { dayNum, reward: getNcDailyReward(dayNum) };
        });
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{
          background: 'radial-gradient(ellipse at center, #0a0a12dd, #050510ee)',
          backdropFilter: 'blur(4px)',
        }} onClick={!isClaim ? () => setShowDailyCalendar(false) : undefined}>
          <div className="nc-daily-login flex flex-col items-center gap-5 p-6 rounded-xl max-w-md w-full mx-4" style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #12121f 50%, #0e0e1a 100%)',
            border: '1px solid #c9a84c44',
            boxShadow: '0 0 60px rgba(201,168,76,0.15), 0 8px 32px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <p className="text-xl font-black uppercase tracking-[0.2em]" style={{ color: '#c9a84c' }}>
                {t('nc.dailyLogin.title')}
              </p>
              <p className="text-xs mt-1" style={{ color: '#6a6a7a' }}>
                {isClaim ? t('nc.dailyLogin.subtitle') : t('nc.dailyLogin.progress')}
              </p>
            </div>

            {/* 7-day reward track */}
            <div className="grid grid-cols-7 gap-1.5 w-full">
              {days.map(({ dayNum, reward }, i) => {
                const isToday = i === 0 && isClaim;
                const isNext = i === 0 && !isClaim;
                const isFuture = i > 0;
                return (
                  <div key={dayNum} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{
                      color: isToday || isNext ? '#c9a84c' : '#4a4a5a',
                    }}>
                      {isToday ? t('nc.dailyLogin.today') : isNext ? t('nc.dailyLogin.next') : `+${i}`}
                    </span>
                    <div
                      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg w-full aspect-square transition-all ${isToday || isNext ? 'nc-daily-today-pulse' : ''}`}
                      style={{
                        background: isToday || isNext
                          ? 'linear-gradient(135deg, #2a2a0e, #1a1a08)'
                          : '#0e0e16',
                        border: isToday || isNext
                          ? '2px solid #c9a84c'
                          : '1px solid #2a2a3a',
                        boxShadow: isToday || isNext ? '0 0 16px rgba(201,168,76,0.25)' : 'none',
                        opacity: isFuture ? 0.55 : 1,
                      }}
                    >
                      <div className="flex items-center gap-0.5">
                        <CoinIcon size={10} />
                        <span className="text-[9px] font-bold" style={{ color: '#e8d48b' }}>{reward.coins}</span>
                      </div>
                      {reward.shards > 0 && (
                        <div className="flex items-center gap-0.5">
                          <ShardIcon size={10} />
                          <span className="text-[9px] font-bold" style={{ color: '#67e8f9' }}>{reward.shards}</span>
                        </div>
                      )}
                      {reward.gems && (
                        <div className="flex items-center gap-0.5">
                          <GemIcon size={10} />
                          <span className="text-[9px] font-bold" style={{ color: '#a78bfa' }}>{reward.gems}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Streak counter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#5a5a6a' }}>
                {t('nc.dailyLogin.streak')}
              </span>
              <span className="text-sm font-black" style={{ color: '#c9a84c' }}>{claimedUpTo}</span>
            </div>

            {/* Today's reward highlight (only on claim) */}
            {todayReward && (
              <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg w-full justify-center" style={{
                background: 'linear-gradient(135deg, #1a1a08, #12120a)',
                border: '1px solid #c9a84c33',
              }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6a6a7a' }}>
                  {t('nc.dailyLogin.today')}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <CoinIcon size={16} />
                    <span className="text-sm font-black" style={{ color: '#e8d48b' }}>+{todayReward.coins}</span>
                  </div>
                  {todayReward.shards > 0 && (
                    <div className="flex items-center gap-1">
                      <ShardIcon size={16} />
                      <span className="text-sm font-black" style={{ color: '#67e8f9' }}>+{todayReward.shards}</span>
                    </div>
                  )}
                  {todayReward.gems && (
                    <div className="flex items-center gap-1">
                      <GemIcon size={16} />
                      <span className="text-sm font-black" style={{ color: '#a78bfa' }}>+{todayReward.gems}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (isClaim) ncProfile.dismissDailyLogin();
                setShowDailyCalendar(false);
              }}
              className="w-full py-3 rounded-lg font-black text-sm uppercase tracking-wider transition-all hover:scale-[1.02]"
              style={{
                background: isClaim
                  ? 'linear-gradient(135deg, #c9a84c, #a07c2a)'
                  : 'linear-gradient(135deg, #2a2a3a, #1e1e2e)',
                border: isClaim ? '1px solid #e8d48b' : '1px solid #3a3a4a',
                color: isClaim ? '#0a0a12' : '#8a8a9a',
                boxShadow: isClaim ? '0 0 20px rgba(201,168,76,0.3)' : 'none',
              }}
            >
              {isClaim ? t('nc.dailyLogin.claim') : t('nc.dailyLogin.close')}
            </button>
          </div>
        </div>
        );
      })()}

      {/* Tutorial overlay */}
      {showTutorial && <NexusClashTutorial onClose={() => setShowTutorial(false)} />}

      {/* NC Global Styles (hub view copy) */}
      <style jsx global>{`
        .nc-noise-overlay {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          background-repeat: repeat;
        }
        @keyframes nc-legendary-pulse {
          0%, 100% { box-shadow: 0 0 12px rgba(201,168,76,0.3), inset 0 0 8px rgba(201,168,76,0.1); }
          50% { box-shadow: 0 0 24px rgba(201,168,76,0.6), inset 0 0 16px rgba(201,168,76,0.15); }
        }
        .nc-legendary-pulse { animation: nc-legendary-pulse 2s ease-in-out infinite; }
        @keyframes nc-epic-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .nc-epic-shimmer { background-size: 200% 100%; animation: nc-epic-shimmer 3s linear infinite; }
        @keyframes nc-legendary-reveal {
          0% { transform: scale(0.5) rotate(-5deg); filter: brightness(3); }
          50% { transform: scale(1.15) rotate(2deg); filter: brightness(2); }
          100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
        }
        .nc-legendary-reveal { animation: nc-legendary-reveal 0.8s ease-out; }
        @keyframes nc-epic-reveal {
          0% { transform: scale(0.5); filter: brightness(2); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        .nc-epic-reveal { animation: nc-epic-reveal 0.6s ease-out; }
        @keyframes nc-play-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(124,58,237,0.15), 0 0 60px rgba(74,125,255,0.08); }
          50% { box-shadow: 0 0 40px rgba(124,58,237,0.3), 0 0 80px rgba(74,125,255,0.15); }
        }
        .nc-play-glow { animation: nc-play-glow 2.5s ease-in-out infinite; }
        @keyframes nc-hub-bg-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .nc-hub-bg {
          background: linear-gradient(135deg, #0a0a12 0%, #0e0a1a 25%, #0a0a12 50%, #0a1218 75%, #0a0a12 100%);
          background-size: 400% 400%;
          animation: nc-hub-bg-shift 20s ease infinite;
        }
        @keyframes nc-portal-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes nc-portal-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        .nc-portal-ring { animation: nc-portal-spin 3s linear infinite; }
        .nc-portal-glow { animation: nc-portal-pulse 2s ease-in-out infinite; }
        .nc-btn-ghost:hover { border-color: #c9a84c44 !important; color: #c9a84c !important; }

        /* ── Hub title shimmer ──*/
        @keyframes nc-hub-title-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .nc-hub-title {
          background-size: 200% 100%;
          animation: nc-hub-title-shimmer 6s linear infinite;
        }

        /* ── Tab indicator ──*/
        .nc-hub-tab { position: relative; }
        .nc-hub-tab:hover { color: #8a8a9a !important; }
        @keyframes nc-tab-indicator-enter {
          0% { transform: scaleX(0); opacity: 0; }
          100% { transform: scaleX(1); opacity: 1; }
        }
        .nc-tab-indicator { animation: nc-tab-indicator-enter 0.3s ease-out; }

        /* ── Play tab enter ──*/
        @keyframes nc-play-tab-enter {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .nc-play-tab-enter { animation: nc-play-tab-enter 0.4s ease-out; }

        /* ── Mulligan card entrance ── */
        @keyframes nc-mulligan-card-enter {
          0% { opacity: 0; transform: translateY(20px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .nc-mulligan-card-enter {
          animation: nc-mulligan-card-enter 0.4s ease-out both;
        }

        /* ── Play button shimmer ──*/
        @keyframes nc-btn-shimmer-anim {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .nc-btn-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          animation: nc-btn-shimmer-anim 3s ease-in-out infinite;
        }

        /* ── Play button glow pulse ──*/
        @keyframes nc-play-btn-glow {
          0%, 100% {
            box-shadow: 0 0 60px rgba(124,58,237,0.3), 0 0 120px rgba(74,125,255,0.08), inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.4);
          }
          50% {
            box-shadow: 0 0 80px rgba(124,58,237,0.45), 0 0 160px rgba(74,125,255,0.15), inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 32px rgba(0,0,0,0.4);
          }
        }
        .nc-play-btn:not(:disabled) { animation: nc-play-btn-glow 3s ease-in-out infinite; }

        /* ── Rune circle decoration ──*/
        @keyframes nc-rune-rotate {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .nc-rune-circle {
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: nc-rune-rotate 30s linear infinite;
        }
        .nc-rune-circle-inner {
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: nc-rune-rotate 20s linear infinite reverse;
        }

        /* ── Floating particles ──*/
        @keyframes nc-particle-float {
          0%, 100% { opacity: 0; }
          10% { opacity: 0.4; }
          90% { opacity: 0.4; }
        }
        .nc-hub-particles {
          background-image:
            radial-gradient(1px 1px at 10% 20%, #c9a84c33, transparent),
            radial-gradient(1px 1px at 30% 60%, #7c3aed22, transparent),
            radial-gradient(1px 1px at 50% 10%, #4a7dff22, transparent),
            radial-gradient(1px 1px at 70% 40%, #c9a84c22, transparent),
            radial-gradient(1px 1px at 90% 70%, #7c3aed22, transparent),
            radial-gradient(1px 1px at 20% 80%, #4a7dff22, transparent),
            radial-gradient(1px 1px at 80% 90%, #c9a84c22, transparent),
            radial-gradient(1px 1px at 60% 30%, #7c3aed22, transparent);
          animation: nc-particle-float 8s ease-in-out infinite;
        }

        /* ── Currency pill hover ──*/
        .nc-currency-pill { transition: all 0.2s ease; }
        .nc-currency-pill:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important; }

        /* ── Tooltip ──*/
        @keyframes nc-tooltip-enter {
          0% { opacity: 0; transform: translateX(-50%) translateY(4px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .nc-tooltip { animation: nc-tooltip-enter 0.15s ease-out; }

        /* ── Daily login popup ──*/
        @keyframes nc-daily-login-enter {
          0% { opacity: 0; transform: scale(0.9) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .nc-daily-login { animation: nc-daily-login-enter 0.4s ease-out; }

        @keyframes nc-daily-today-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(201,168,76,0.2); }
          50% { box-shadow: 0 0 20px rgba(201,168,76,0.45); }
        }
        .nc-daily-today-pulse { animation: nc-daily-today-pulse 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
