'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type {
  NexusClashState, NexusClashAction, NcLane,
  NcPendingPlay, NcLaneModifier,
} from 'shared';
import { NC_CARD_MAP, NC_CARDS } from 'shared';
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

// ── Tug of war bar ──────────────────────────────────────────────────────────

function TugBar({ value, locked, winner, myIdx }: { value: number; locked: boolean; winner: 0 | 1 | null; myIdx: number | null }) {
  const position = Math.max(0, Math.min(100, (value + 100) / 2));

  const p0IsMe = myIdx === 0;
  const leftColor = p0IsMe ? '#4a7dff' : '#ef4444';
  const rightColor = p0IsMe ? '#ef4444' : '#4a7dff';

  return (
    <div className={[
      'relative h-5 rounded overflow-hidden',
      locked ? 'opacity-70' : '',
    ].join(' ')}
    style={{
      background: '#0a0a12',
      border: '1px solid #2a2a3a',
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
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
        className="absolute top-0 h-full transition-all duration-700 ease-out"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
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
}: {
  lane: NcLane;
  laneIndex: number;
  myIdx: number | null;
  pendingPlays: NcPendingPlay[];
  selectedCardId: string | null;
  onLaneClick: (laneIndex: 0 | 1 | 2) => void;
  t: (key: string) => string;
}) {
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
        <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{
          background: 'linear-gradient(135deg, #1a1a2e, #12121f)',
          border: '1px solid #c9a84c44',
          boxShadow: '0 0 8px rgba(201,168,76,0.1)',
        }}>
          <ModifierIcon modifier={lane.modifier} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#c9a84c' }}>
            {t(`nc.modifier.${lane.modifier}`)}
          </span>
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
        <TugBar value={lane.tugValue} locked={lane.locked} winner={lane.breakthroughWinner} myIdx={myIdx} />
      </div>

      {/* Opponent cards (top) */}
      <div className="flex gap-1 justify-center min-h-[20px] flex-wrap relative z-10">
        {oppCards.map((ci) => (
          <NexusClashCard
            key={ci.uid}
            card={ci.cardId}
            compact
            displayPower={ci.power}
          />
        ))}
      </div>

      {/* Lane divider */}
      <div className="relative h-px my-0.5" style={{
        background: 'linear-gradient(to right, transparent, #c9a84c33, transparent)',
      }} />

      {/* My cards (bottom) */}
      <div className="flex gap-1 justify-center min-h-[20px] flex-wrap relative z-10">
        {myCards.map((ci) => (
          <NexusClashCard
            key={ci.uid}
            card={ci.cardId}
            compact
            displayPower={ci.power}
          />
        ))}
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

  const { chatOpen, setChatOpen, unread } = useUnreadMessages(mp);
  useAutoJoin(mp, initialRoomCode, isQuickPlay, 'nexusclash');

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
    setSelectedCard(null);
  }, [selectedCard, gs, haveConfirmed, mp, availableMana]);

  const handleUndo = useCallback((cardUid: number) => {
    if (haveConfirmed || !gs || gs.phase !== 'placing') return;
    mp.sendAction({ type: 'nc_undo', cardUid } as NexusClashAction);
  }, [haveConfirmed, gs, mp]);

  const handleConfirm = useCallback(() => {
    if (haveConfirmed || !gs || gs.phase !== 'placing') return;
    mp.sendAction({ type: 'nc_confirm' } as NexusClashAction);
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

        {/* ── Playing phase ──────────────────────────────────────────────── */}
        {mp.phase === 'playing' && gs && (
          <div className="flex flex-col gap-4 relative z-10">
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
                  selectedCardId={selectedCard}
                  onLaneClick={handleLaneClick}
                  t={t}
                />
              ))}
            </div>

            {/* Pending plays undo area */}
            {myPending && myPending.length > 0 && !haveConfirmed && (
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
            {myIdx !== null && gs.phase === 'placing' && (
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

            {/* Reveal phase indicator */}
            {gs.phase === 'revealing' && (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="nc-reveal-spinner w-6 h-6" />
                <span className="text-sm font-bold uppercase tracking-widest" style={{ color: '#c9a84c' }}>{t('nc.revealing')}</span>
              </div>
            )}

            {/* Hand area */}
            {myIdx !== null && gs.phase === 'placing' && !mp.isSpectator && (
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
                      <div key={`${cardId}-${i}`} className={[
                        'transition-all duration-200',
                        isSelected ? 'nc-hand-card-selected' : 'nc-hand-card',
                      ].join(' ')}>
                        <NexusClashCard
                          card={cardId}
                          selected={isSelected}
                          disabled={!canAfford || haveConfirmed}
                          onClick={() => handleCardClick(cardId)}
                        />
                      </div>
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
        background: 'radial-gradient(ellipse at center, transparent 40%, #0a0a12 100%)',
      }} />

      {/* ── Header Bar ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5">
        {/* Title treatment */}
        <div className="flex flex-col">
          <div className="text-3xl font-black uppercase tracking-[0.2em] select-none" style={{
            background: 'linear-gradient(to right, #e8d48b, #c9a84c, #e8d48b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 10px rgba(201,168,76,0.3))',
          }}>
            NEXUS CLASH
          </div>
          <div className="h-px mt-1" style={{
            background: 'linear-gradient(to right, #c9a84c66, transparent)',
            width: '80%',
          }} />
        </div>

        {/* Currency display */}
        <div className="flex items-center gap-3">
          {/* Coins */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{
            background: 'linear-gradient(135deg, #1a1a08, #12121f)',
            border: '1px solid #c9a84c33',
          }}>
            <CoinIcon size={18} />
            <span className="text-sm font-bold tabular-nums" style={{ color: '#e8d48b' }}>{ncProfile.profile.currencies.coins}</span>
          </div>
          {/* Gems */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{
            background: 'linear-gradient(135deg, #1a0a2a, #12121f)',
            border: '1px solid #7c3aed33',
          }}>
            <GemIcon size={18} />
            <span className="text-sm font-bold tabular-nums" style={{ color: '#a78bfa' }}>{ncProfile.profile.currencies.gems}</span>
          </div>
          {/* Connection */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded" style={{
            background: '#0a0a1299',
            border: '1px solid #2a2a3a',
          }}>
            <span className={`w-2 h-2 rounded-full ${
              mp.connection === 'connected'  ? 'bg-emerald-400' :
              mp.connection === 'connecting' ? 'bg-amber-400 animate-pulse' :
              'bg-rose-500'
            }`} />
          </div>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 px-6">
        <div className="flex items-center gap-0">
          {TAB_ITEMS.map((tab, idx) => {
            const isActive = hubTab === tab.id;
            return (
              <div key={tab.id} className="flex items-center">
                {idx > 0 && (
                  <div className="w-px h-5 mx-1" style={{ background: '#2a2a3a' }} />
                )}
                <button
                  onClick={() => setHubTab(tab.id)}
                  className={[
                    'flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-all',
                    isActive ? 'nc-tab-active' : '',
                  ].join(' ')}
                  style={{
                    color: isActive ? '#c9a84c' : '#5a5a6a',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: isActive ? '2px solid #c9a84c' : '2px solid transparent',
                  }}
                >
                  <TabIcon tab={tab.id} active={isActive} />
                  {t(tab.labelKey)}
                </button>
              </div>
            );
          })}
        </div>
        <div className="nc-ornament-divider" />
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
          <div className="flex flex-col items-center gap-10 max-w-xl mx-auto">
            {/* Atmospheric center glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none" style={{
              background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.06) 0%, transparent 70%)',
            }} />

            {/* Big PLAY button */}
            <div className="relative">
              {/* Outer glow ring */}
              <div className="absolute -inset-4 rounded-2xl nc-play-glow" style={{
                background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.08), transparent 70%)',
              }} />
              <button
                onClick={() => mp.quickPlay()}
                disabled={mp.connection !== 'connected' || mp.phase === 'waiting'}
                className={[
                  'relative px-20 py-6 rounded-lg font-black text-2xl uppercase tracking-[0.2em] transition-all',
                  mp.connection === 'connected' && mp.phase !== 'waiting'
                    ? 'nc-play-glow cursor-pointer hover:scale-105'
                    : 'cursor-not-allowed',
                ].join(' ')}
                style={{
                  background: mp.connection === 'connected' && mp.phase !== 'waiting'
                    ? 'linear-gradient(135deg, #7c3aed, #5b21b6, #4a7dff)'
                    : 'linear-gradient(135deg, #1a1a2e, #12121f)',
                  border: mp.connection === 'connected' && mp.phase !== 'waiting'
                    ? '2px solid #a78bfa'
                    : '1px solid #2a2a3a',
                  color: mp.connection === 'connected' && mp.phase !== 'waiting' ? 'white' : '#4a4a5a',
                  boxShadow: mp.connection === 'connected' && mp.phase !== 'waiting'
                    ? '0 0 40px rgba(124,58,237,0.3), inset 0 0 30px rgba(74,125,255,0.1)'
                    : 'none',
                }}
              >
                {t('nc.hub.play')}
                {/* Decorative corner accents */}
                <div className="absolute top-0 left-0 w-4 h-4" style={{
                  borderTop: '2px solid #c9a84c66',
                  borderLeft: '2px solid #c9a84c66',
                }} />
                <div className="absolute top-0 right-0 w-4 h-4" style={{
                  borderTop: '2px solid #c9a84c66',
                  borderRight: '2px solid #c9a84c66',
                }} />
                <div className="absolute bottom-0 left-0 w-4 h-4" style={{
                  borderBottom: '2px solid #c9a84c66',
                  borderLeft: '2px solid #c9a84c66',
                }} />
                <div className="absolute bottom-0 right-0 w-4 h-4" style={{
                  borderBottom: '2px solid #c9a84c66',
                  borderRight: '2px solid #c9a84c66',
                }} />
              </button>
            </div>

            {/* Selected deck info */}
            <div className="flex items-center gap-4 px-5 py-3 rounded-lg" style={{
              background: 'linear-gradient(135deg, #12121f, #0e0e1a)',
              border: '1px solid #2a2a3a',
            }}>
              {/* Mini card back */}
              <div className="w-8 h-12 rounded flex items-center justify-center" style={{
                background: 'linear-gradient(135deg, #1e1e3a, #12121f)',
                border: '1px solid #3a3a5a',
              }}>
                <svg viewBox="0 0 12 12" className="w-3 h-3"><polygon points="6,1 11,4 9,11 3,11 1,4" fill="#4a7dff44" stroke="#4a7dff" strokeWidth="0.8"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-[0.15em] font-semibold" style={{ color: '#6a6a7a' }}>{t('nc.selectedDeck')}</span>
                <span className="text-sm font-bold" style={{ color: '#e0e0e8' }}>
                  {ncProfile.profile.decks.find(d => d.id === ncProfile.profile.selectedDeckId)?.name ?? 'Starter'}
                </span>
              </div>
              <button
                onClick={() => setHubTab('decks')}
                className="text-xs font-semibold transition-all nc-btn-ghost px-2 py-1 rounded"
                style={{ color: '#c9a84c88', border: '1px solid #c9a84c22' }}
              >
                {t('nc.changeDeck')}
              </button>
            </div>

            {/* Stats row */}
            <div className="flex gap-3 w-full">
              {[
                { value: ncProfile.profile.wins, label: t('nc.stats.wins'), accent: '#4a7dff' },
                { value: ncProfile.profile.matchesPlayed, label: t('nc.stats.matches'), accent: '#c9a84c' },
                { value: `${winRate}%`, label: t('nc.stats.winrate'), accent: '#7c3aed' },
              ].map((stat, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 py-4 rounded-lg relative overflow-hidden" style={{
                  background: 'linear-gradient(180deg, #12121f, #0e0e1a)',
                  border: '1px solid #1e1e3a',
                }}>
                  {/* Accent line at top */}
                  <div className="absolute top-0 left-[20%] right-[20%] h-px" style={{ background: stat.accent + '44' }} />
                  <span className="text-xl font-black" style={{ color: stat.accent }}>{stat.value}</span>
                  <span className="text-[9px] uppercase tracking-[0.15em] font-semibold" style={{ color: '#5a5a6a' }}>{stat.label}</span>
                </div>
              ))}
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
          <div className="relative w-full">
            <PackOpening
              profile={ncProfile.profile}
              onUpdateProfile={ncProfile.updateProfile}
              onClose={() => setHubTab('play')}
            />
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
        .nc-tab-active { border-bottom: 2px solid #c9a84c !important; color: #c9a84c !important; }
        .nc-ornament-divider { height: 1px; background: linear-gradient(to right, transparent, #c9a84c33, transparent); }
        .nc-btn-ghost:hover { border-color: #c9a84c44 !important; color: #c9a84c !important; }
      `}</style>
    </div>
  );
}
