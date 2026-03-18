'use client';

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import type { NcPlayerProfile, NcBpReward } from 'shared';
import { NC_BP_TIERS, NC_BP_PREMIUM_COST, getNcBpTier, NC_CARD_MAP } from 'shared';
import { NexusClashCard } from './NexusClashCard';
import { useI18n } from '@/components/providers/LanguageProvider';

interface BattlePassProps {
  profile: NcPlayerProfile;
  onClose: () => void;
  onClaimReward: (level: number, track: 'free' | 'paid') => void;
  onUnlockPremium: () => void;
}

// ── Reward display ─────────────────────────────────────────────────────────

function RewardDisplay({ reward, t, onClick }: { reward: NcBpReward; t: (k: string) => string; onClick?: () => void }) {
  if (reward.type === 'coins') return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 20 20" className="w-8 h-8 drop-shadow-md">
        <circle cx="10" cy="10" r="8" fill="#c9a84c" stroke="#a07c2a" strokeWidth="1.5"/>
        <circle cx="10" cy="10" r="5.5" fill="none" stroke="#e8d48b" strokeWidth="0.7"/>
        <text x="10" y="13.5" textAnchor="middle" fill="#7a5c1a" fontSize="8" fontWeight="bold">C</text>
      </svg>
      <span className="text-sm font-black tabular-nums" style={{ color: '#fbbf24' }}>{reward.amount}</span>
    </div>
  );
  if (reward.type === 'gems') return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 20 20" className="w-8 h-8 drop-shadow-md">
        <polygon points="10,2 16,7 14,17 6,17 4,7" fill="#7c3aed" stroke="#a78bfa" strokeWidth="1"/>
        <polygon points="10,2 12,7 10,15 8,7" fill="#9f67ff" opacity="0.5"/>
        <line x1="4" y1="7" x2="16" y2="7" stroke="#a78bfa" strokeWidth="0.8"/>
      </svg>
      <span className="text-sm font-black tabular-nums" style={{ color: '#c084fc' }}>{reward.amount}</span>
    </div>
  );
  if (reward.type === 'shards') return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 20 20" className="w-8 h-8 drop-shadow-md">
        <polygon points="10,1 14,8 12,19 8,19 6,8" fill="#22d3ee" stroke="#67e8f9" strokeWidth="0.8"/>
        <polygon points="10,3 12,8 11,16 9,16 8,8" fill="#a5f3fc" opacity="0.3"/>
        <polygon points="5,5 7,8 5,14 3,8" fill="#22d3ee" opacity="0.5" stroke="#67e8f9" strokeWidth="0.5"/>
      </svg>
      <span className="text-sm font-black tabular-nums" style={{ color: '#67e8f9' }}>{reward.amount}</span>
    </div>
  );
  if (reward.type === 'pack') return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 20 20" className="w-8 h-8 drop-shadow-md">
        <rect x="2" y="3" width="16" height="14" rx="2.5" fill="#2563eb"/>
        <rect x="4" y="5" width="12" height="10" rx="1.5" fill="#1e3a5f" opacity="0.5"/>
        <circle cx="10" cy="10" r="3" fill="#60a5fa" opacity="0.6"/>
        <circle cx="10" cy="10" r="1.5" fill="#bfdbfe"/>
      </svg>
      <span className="text-xs font-black" style={{ color: '#60a5fa' }}>{t('nc.bp.pack')}</span>
    </div>
  );
  if (reward.type === 'card' && reward.cardId) {
    const def = NC_CARD_MAP[reward.cardId];
    if (def) return (
      <div style={{ width: 56, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
        <NexusClashCard card={def} compact showPreview={false} />
      </div>
    );
  }
  return null;
}

// ── Claim Toast ───────────────────────────────────────────────────────────

function ClaimToast({ reward, t }: { reward: NcBpReward; t: (k: string) => string }) {
  const label = reward.type === 'coins' ? `+${reward.amount} ${t('nc.bp.coins')}`
    : reward.type === 'gems' ? `+${reward.amount} ${t('nc.bp.gems')}`
    : reward.type === 'shards' ? `+${reward.amount} ${t('nc.bp.shards')}`
    : reward.type === 'pack' ? `1x ${t('nc.bp.pack')}`
    : reward.type === 'card' && reward.cardId ? `${t('nc.bp.card')}: ${reward.cardId}`
    : t('nc.bp.claimed');

  const color = reward.type === 'coins' ? '#fbbf24'
    : reward.type === 'gems' ? '#c084fc'
    : reward.type === 'shards' ? '#67e8f9'
    : reward.type === 'pack' ? '#60a5fa'
    : '#c9a84c';

  return (
    <div className="bp-toast-enter flex items-center gap-2 px-4 py-2 rounded-lg" style={{
      background: 'linear-gradient(135deg, #1a1a2e, #12121f)',
      border: `1px solid ${color}40`,
      boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${color}15`,
    }}>
      <svg viewBox="0 0 12 12" className="w-4 h-4 shrink-0">
        <circle cx="6" cy="6" r="5" fill={color} opacity="0.2"/>
        <path d="M3.5 6L5.5 8L8.5 4" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      <span className="text-xs font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

// ── Card Preview Modal ────────────────────────────────────────────────────

function CardPreviewModal({ cardId, onClose, t }: { cardId: string; onClose: () => void; t: (k: string) => string }) {
  const def = NC_CARD_MAP[cardId];
  if (!def) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{
      background: 'rgba(5,5,16,0.85)', backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        <div style={{ width: 180 }}>
          <NexusClashCard card={def} showPreview={false} />
        </div>
        <h3 className="text-base font-black" style={{ color: '#e0e0e8' }}>{t(def.nameKey)}</h3>
        <p className="text-xs max-w-xs text-center leading-relaxed" style={{ color: '#8a8a9a' }}>
          {t(`nc.ability.${def.id}`)}
        </p>
        <button onClick={onClose} className="text-[10px] font-bold uppercase tracking-wider mt-1 transition-colors hover:text-[#6a6a7a]" style={{ color: '#4a4a5a' }}>
          {t('nc.bp.cancel')}
        </button>
      </div>
    </div>
  );
}

// ── Premium Modal ──────────────────────────────────────────────────────────

function PremiumModal({ profile, onConfirm, onCancel, t }: {
  profile: NcPlayerProfile; onConfirm: () => void; onCancel: () => void; t: (k: string) => string;
}) {
  const canAfford = profile.currencies.gems >= NC_BP_PREMIUM_COST;
  const summary = useMemo(() => {
    let coins = 0, gems = 0, shards = 0, packs = 0;
    const cards: string[] = [];
    for (const tier of NC_BP_TIERS) {
      const r = tier.paidReward;
      if (r.type === 'coins' && r.amount) coins += r.amount;
      if (r.type === 'gems' && r.amount) gems += r.amount;
      if (r.type === 'shards' && r.amount) shards += r.amount;
      if (r.type === 'pack') packs++;
      if (r.type === 'card' && r.cardId) cards.push(r.cardId);
    }
    return { coins, gems, shards, packs, cards };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{
      background: 'rgba(5,5,16,0.85)', backdropFilter: 'blur(8px)',
    }} onClick={onCancel}>
      <div style={{
        width: 360, maxWidth: '92vw',
        background: 'linear-gradient(180deg, #16142a, #0e0c1a)',
        border: '1px solid #c9a84c30', borderRadius: 10,
        boxShadow: '0 0 60px rgba(0,0,0,0.6), 0 0 30px rgba(201,168,76,0.06)',
      }} onClick={e => e.stopPropagation()}>
        <div className="h-[2px]" style={{ background: 'linear-gradient(to right, transparent, #c9a84c60, transparent)' }} />
        <div className="p-5 flex flex-col gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <svg viewBox="0 0 16 16" className="w-4 h-4"><polygon points="8,1 10,6 15,6 11,9 12.5,14 8,11 3.5,14 5,9 1,6 6,6" fill="#c9a84c"/></svg>
              <span className="text-sm font-black uppercase tracking-wider" style={{ color: '#c9a84c' }}>{t('nc.bp.premium')}</span>
              <svg viewBox="0 0 16 16" className="w-4 h-4"><polygon points="8,1 10,6 15,6 11,9 12.5,14 8,11 3.5,14 5,9 1,6 6,6" fill="#c9a84c"/></svg>
            </div>
            <p className="text-[11px]" style={{ color: '#6a6a7a' }}>{t('nc.bp.premiumDesc')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {summary.coins > 0 && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#fbbf2408', border: '1px solid #fbbf2418' }}>
                <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0"><circle cx="10" cy="10" r="8" fill="#c9a84c" stroke="#a07c2a" strokeWidth="1.5"/><text x="10" y="13.5" textAnchor="middle" fill="#7a5c1a" fontSize="8" fontWeight="bold">C</text></svg>
                <div><span className="text-sm font-bold" style={{ color: '#fbbf24' }}>{summary.coins}</span><span className="text-[10px] ml-1" style={{ color: '#6a6a5a' }}>{t('nc.bp.coins')}</span></div>
              </div>
            )}
            {summary.gems > 0 && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#7c3aed08', border: '1px solid #7c3aed18' }}>
                <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0"><polygon points="10,2 16,7 14,17 6,17 4,7" fill="#7c3aed" stroke="#a78bfa" strokeWidth="1"/></svg>
                <div><span className="text-sm font-bold" style={{ color: '#c084fc' }}>{summary.gems}</span><span className="text-[10px] ml-1" style={{ color: '#5a5a7a' }}>{t('nc.bp.gems')}</span></div>
              </div>
            )}
            {summary.shards > 0 && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#06b6d408', border: '1px solid #06b6d418' }}>
                <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0"><polygon points="10,1 14,8 12,19 8,19 6,8" fill="#22d3ee" stroke="#67e8f9" strokeWidth="0.8"/></svg>
                <div><span className="text-sm font-bold" style={{ color: '#67e8f9' }}>{summary.shards}</span><span className="text-[10px] ml-1" style={{ color: '#5a7a7a' }}>{t('nc.bp.shards')}</span></div>
              </div>
            )}
            {summary.packs > 0 && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#2563eb08', border: '1px solid #2563eb18' }}>
                <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0"><rect x="2" y="3" width="16" height="14" rx="2.5" fill="#2563eb"/><circle cx="10" cy="10" r="2.5" fill="#60a5fa" opacity="0.6"/></svg>
                <div><span className="text-sm font-bold" style={{ color: '#60a5fa' }}>{summary.packs}x</span><span className="text-[10px] ml-1" style={{ color: '#5a5a8a' }}>{t('nc.bp.pack')}</span></div>
              </div>
            )}
          </div>
          {summary.cards.length > 0 && (
            <div className="flex flex-col items-center gap-2 py-1">
              <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: '#c9a84c40' }}>{t('nc.bp.exclusive')}</span>
              <div className="flex gap-3 justify-center">
                {summary.cards.map(cid => { const d = NC_CARD_MAP[cid]; return d ? <div key={cid} style={{ width: 60 }}><NexusClashCard card={d} showPreview={false} /></div> : null; })}
              </div>
            </div>
          )}
          <button onClick={onConfirm} disabled={!canAfford}
            className="w-full py-2.5 rounded-lg font-black uppercase tracking-wider text-xs transition-all hover:brightness-110"
            style={{
              background: canAfford ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : '#1a1a2e',
              color: canAfford ? '#fff' : '#4a4a5a',
              border: `1px solid ${canAfford ? '#a78bfa40' : '#2a2a3a'}`,
              cursor: canAfford ? 'pointer' : 'not-allowed',
              boxShadow: canAfford ? '0 4px 16px rgba(124,58,237,0.2)' : 'none',
            }}
          >
            <span className="flex items-center justify-center gap-1.5">
              <svg viewBox="0 0 20 20" className="w-4 h-4"><polygon points="10,2 16,7 14,17 6,17 4,7" fill="#c084fc"/></svg>
              {NC_BP_PREMIUM_COST} {t('nc.bp.gems')}
            </span>
          </button>
          {!canAfford && <p className="text-[9px] text-center" style={{ color: '#ef444460' }}>{t('nc.bp.notEnoughGems')}</p>}
          <button onClick={onCancel} className="text-[10px] font-bold uppercase tracking-wider py-0.5 transition-colors hover:text-[#6a6a7a]" style={{ color: '#4a4a5a' }}>{t('nc.bp.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function BattlePass({ profile, onClose, onClaimReward, onUnlockPremium }: BattlePassProps) {
  const { t } = useI18n();
  const bp = profile.battlePass;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumSuccess, setPremiumSuccess] = useState(false);
  const [claimToast, setClaimToast] = useState<NcBpReward | null>(null);
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);

  const currentTier = useMemo(() => bp ? getNcBpTier(bp.xp) : 1, [bp]);

  // Count claimable rewards for header badge
  const claimableCount = useMemo(() => {
    if (!bp) return 0;
    let count = 0;
    for (const tier of NC_BP_TIERS) {
      if (currentTier >= tier.level) {
        if (!bp.claimedFree.includes(tier.level)) count++;
        if (bp.isPremium && !bp.claimedPaid.includes(tier.level)) count++;
      }
    }
    return count;
  }, [bp, currentTier]);

  // Scroll to current tier on mount
  useEffect(() => {
    if (scrollRef.current && currentTier > 3) {
      const el = scrollRef.current.querySelector(`[data-tier="${currentTier}"]`);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 120);
    }
  }, [currentTier]);

  // Auto-dismiss claim toast
  useEffect(() => {
    if (!claimToast) return;
    const timer = setTimeout(() => setClaimToast(null), 2000);
    return () => clearTimeout(timer);
  }, [claimToast]);

  // Auto-dismiss premium success
  useEffect(() => {
    if (!premiumSuccess) return;
    const timer = setTimeout(() => setPremiumSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [premiumSuccess]);

  // Claim with toast feedback (#1)
  const handleClaim = useCallback((level: number, track: 'free' | 'paid') => {
    const tier = NC_BP_TIERS.find(td => td.level === level);
    if (tier) {
      const reward = track === 'free' ? tier.freeReward : tier.paidReward;
      setClaimToast(reward);
    }
    onClaimReward(level, track);
  }, [onClaimReward]);

  // Premium unlock with celebration (#2)
  const handlePremiumUnlock = useCallback(() => {
    onUnlockPremium();
    setShowPremiumModal(false);
    setPremiumSuccess(true);
  }, [onUnlockPremium]);

  // Scroll to current tier (#3)
  const scrollToCurrent = useCallback(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-tier="${currentTier}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentTier]);

  if (!bp) return null;

  const isPremium = bp.isPremium;
  const nextTierDef = NC_BP_TIERS.find(td => td.level === currentTier + 1);
  const currentTierDef = NC_BP_TIERS.find(td => td.level === currentTier);
  const xpForCurrent = currentTierDef?.xpRequired ?? 0;
  const xpForNext = nextTierDef?.xpRequired ?? bp.xp;
  const xpInTier = bp.xp - xpForCurrent;
  const xpNeeded = xpForNext - xpForCurrent;
  const xpPct = xpNeeded > 0 ? Math.min((xpInTier / xpNeeded) * 100, 100) : 100;
  const isMaxTier = currentTier >= NC_BP_TIERS.length;

  return (
    <>
      <style>{`
        @keyframes bp-glow { 0%,100% { box-shadow: 0 0 6px rgba(201,168,76,0.25), inset 0 0 8px rgba(201,168,76,0.05); } 50% { box-shadow: 0 0 16px rgba(201,168,76,0.45), inset 0 0 12px rgba(201,168,76,0.08); } }
        @keyframes bp-glow-blue { 0%,100% { box-shadow: 0 0 6px rgba(74,125,255,0.25), inset 0 0 8px rgba(74,125,255,0.05); } 50% { box-shadow: 0 0 16px rgba(74,125,255,0.45), inset 0 0 12px rgba(74,125,255,0.08); } }
        @keyframes bp-badge-pulse { 0%,100% { box-shadow: 0 0 10px rgba(124,58,237,0.4); } 50% { box-shadow: 0 0 18px rgba(124,58,237,0.6), 0 0 30px rgba(74,125,255,0.15); } }
        @keyframes bp-shine { 0% { left: -100%; } 100% { left: 200%; } }
        @keyframes bp-toast-in { 0% { opacity: 0; transform: translateY(8px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes bp-toast-out { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; transform: translateY(-4px); } }
        @keyframes bp-premium-flash { 0% { opacity: 0; } 20% { opacity: 1; } 100% { opacity: 0; } }
        .bp-glow-gold { animation: bp-glow 2s ease-in-out infinite; }
        .bp-glow-blue { animation: bp-glow-blue 2s ease-in-out infinite; }
        .bp-badge-active { animation: bp-badge-pulse 2.5s ease-in-out infinite; }
        .bp-tier-cell { transition: transform 0.15s ease, border-color 0.2s ease; }
        .bp-tier-cell:hover { transform: translateY(-2px); }
        .bp-xp-shine::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0;
          width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          animation: bp-shine 3s ease-in-out infinite;
        }
        .bp-toast-enter { animation: bp-toast-in 0.25s ease-out, bp-toast-out 2s ease-in forwards; }
        .bp-premium-flash { animation: bp-premium-flash 2.5s ease-out forwards; }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{
        background: 'radial-gradient(ellipse at center, #0a0a12ee, #050510ff)',
        backdropFilter: 'blur(8px)',
      }} onClick={onClose}>
        <div
          className="flex flex-col overflow-hidden"
          style={{
            width: '95vw',
            maxWidth: 820,
            height: '75vh',
            maxHeight: 520,
            background: 'linear-gradient(180deg, #12121f, #0e0e1a)',
            border: '1px solid #2a2a3a',
            borderRadius: 8,
            boxShadow: '0 0 60px rgba(0,0,0,0.6), 0 0 20px rgba(124,58,237,0.05)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Subtle top accent line */}
          <div className="h-[1px] shrink-0" style={{ background: 'linear-gradient(to right, transparent, #c9a84c20, #7c3aed20, transparent)' }} />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{
            borderBottom: '1px solid #1e1e3a',
            background: 'linear-gradient(to right, #12121f, #1a1a2e, #12121f)',
          }}>
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="w-6 h-6">
                <path d="M12 2L20 7V17L12 22L4 17V7Z" fill="none" stroke="#c9a84c" strokeWidth="1.5"/>
                <path d="M12 6L17 9V15L12 18L7 15V9Z" fill="#c9a84c" opacity="0.08"/>
                <polygon points="12,8 13.5,11 17,11 14.5,13 15.5,16.5 12,14 8.5,16.5 9.5,13 7,11 10.5,11" fill="#c9a84c" opacity="0.7"/>
              </svg>
              <h2 className="text-base font-black uppercase tracking-[0.1em]" style={{ color: '#c9a84c' }}>{t('nc.bp.title')}</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline" style={{ color: '#3a3a4a' }}>{t('nc.bp.season')}</span>
              {/* Claimable badge */}
              {claimableCount > 0 && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full tabular-nums" style={{
                  background: '#c9a84c', color: '#0a0a12',
                  boxShadow: '0 0 8px rgba(201,168,76,0.3)',
                }}>{claimableCount}</span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {isPremium ? (
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full" style={{ color: '#c9a84c', background: '#c9a84c10', border: '1px solid #c9a84c20' }}>
                  <svg viewBox="0 0 10 10" className="w-3 h-3"><polygon points="5,0.5 6.5,3.5 10,3.5 7.5,6 8.5,9.5 5,7.5 1.5,9.5 2.5,6 0,3.5 3.5,3.5" fill="#c9a84c"/></svg>
                  {t('nc.bp.unlocked')}
                </span>
              ) : (
                <button onClick={() => setShowPremiumModal(true)}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all hover:brightness-110 hover:scale-[1.03] active:scale-[0.97]"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#e0d0ff', border: '1px solid #a78bfa30', boxShadow: '0 2px 10px rgba(124,58,237,0.2)' }}
                >
                  <svg viewBox="0 0 10 10" className="w-3 h-3"><polygon points="5,0.5 6.5,3.5 10,3.5 7.5,6 8.5,9.5 5,7.5 1.5,9.5 2.5,6 0,3.5 3.5,3.5" fill="#fbbf24"/></svg>
                  {t('nc.bp.unlock')}
                </button>
              )}
              <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-lg leading-none transition-all hover:bg-[#1e1e3a]" style={{ color: '#5a5a6a' }}
                onMouseOver={e => (e.currentTarget.style.color = '#c9a84c')}
                onMouseOut={e => (e.currentTarget.style.color = '#5a5a6a')}
              >&times;</button>
            </div>
          </div>

          {/* XP bar */}
          <div className="px-5 py-2.5 shrink-0 flex items-center gap-4" style={{ borderBottom: '1px solid #1a1a2a' }}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black tabular-nums" style={{
                background: isMaxTier ? 'linear-gradient(135deg, #c9a84c, #fbbf24)' : 'linear-gradient(135deg, #e0e0e8, #a0a0b0)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>{currentTier}</span>
              <span className="text-xs font-bold" style={{ color: '#3a3a4a' }}>/ {NC_BP_TIERS.length}</span>
            </div>
            <div className="flex-1 relative">
              <div className="h-4 rounded-full overflow-hidden" style={{
                background: '#08080f', border: '1px solid #1e1e3a',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
              }}>
                <div className="h-full rounded-full transition-all duration-700 relative overflow-hidden bp-xp-shine" style={{
                  width: `${xpPct}%`,
                  background: isMaxTier
                    ? 'linear-gradient(90deg, #b8943a, #c9a84c, #e8d48b, #c9a84c)'
                    : 'linear-gradient(90deg, #3b5bdb, #4a7dff, #7c3aed)',
                  boxShadow: isMaxTier ? '0 0 8px rgba(201,168,76,0.4)' : '0 0 8px rgba(74,125,255,0.3)',
                }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-bold tabular-nums" style={{ color: '#ffffffa0', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                  {isMaxTier ? t('nc.bp.max') : `${bp.xp.toLocaleString()} / ${(nextTierDef?.xpRequired ?? bp.xp).toLocaleString()} XP`}
                </span>
              </div>
            </div>
            {/* XP sources — visible on all sizes (#4) */}
            <div className="flex gap-2 sm:gap-3 text-[9px] shrink-0" style={{ color: '#4a4a5a' }}>
              <span><b style={{ color: '#4ade80' }}>+30</b> <span className="hidden sm:inline">{t('nc.bp.win')}</span><span className="sm:hidden">{t('nc.bp.winShort')}</span></span>
              <span><b style={{ color: '#ef4444' }}>+15</b> <span className="hidden sm:inline">{t('nc.bp.loss')}</span><span className="sm:hidden">{t('nc.bp.lossShort')}</span></span>
            </div>
          </div>

          {/* Tier track */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Row labels */}
            <div className="flex shrink-0 px-4 pt-2 justify-between items-center">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest" style={{ color: '#c9a84c50' }}>
                <svg viewBox="0 0 8 8" className="w-2.5 h-2.5"><polygon points="4,0.5 5,3 8,3 6,5 7,8 4,6 1,8 2,5 0,3 3,3" fill="#c9a84c50"/></svg>
                {t('nc.bp.premium')}
              </div>
              <div className="text-[9px] tabular-nums" style={{ color: '#2a2a3a' }}>
                {bp.claimedFree.length + bp.claimedPaid.length} / {NC_BP_TIERS.length * 2} {t('nc.bp.claimed')}
              </div>
            </div>

            {/* Scrollable area */}
            <div className="flex-1 relative min-h-0">
              <div ref={scrollRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden px-2" style={{
                scrollbarWidth: 'thin', scrollbarColor: '#2a2a3a transparent',
              }}>
                <div className="flex h-full py-1" style={{ minWidth: NC_BP_TIERS.length * 100 }}>
                  {NC_BP_TIERS.map((tier, idx) => {
                    const reached = currentTier >= tier.level;
                    const passed = currentTier > tier.level;
                    const freeClaimed = bp.claimedFree.includes(tier.level);
                    const paidClaimed = bp.claimedPaid.includes(tier.level);
                    const canClaimFree = reached && !freeClaimed;
                    const canClaimPaid = reached && isPremium && !paidClaimed;
                    const isCurrentTier = tier.level === currentTier;
                    const isFinal = tier.level === NC_BP_TIERS.length;

                    return (
                      <div key={tier.level} data-tier={tier.level} className="flex flex-col shrink-0" style={{ width: 100 }}>

                        {/* ── Paid reward ──────────────────────────────── */}
                        <div className={`bp-tier-cell flex-1 flex flex-col items-center justify-center mx-1 rounded-lg relative overflow-hidden ${canClaimPaid ? 'bp-glow-gold' : ''}`} style={{
                          background: paidClaimed
                            ? 'linear-gradient(180deg, #1a180e, #13111a)'
                            : reached ? 'linear-gradient(180deg, #18161f, #12101a)' : '#0c0b14',
                          border: `1px solid ${canClaimPaid ? '#c9a84c50' : paidClaimed ? '#c9a84c18' : reached ? '#25233a' : '#17162a'}`,
                          opacity: !reached ? 0.5 : 1,
                        }}>
                          {/* Gold top accent */}
                          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
                            background: reached ? 'linear-gradient(to right, transparent, #c9a84c30, transparent)' : 'transparent',
                          }} />
                          {/* Exclusive badge */}
                          {tier.paidReward.type === 'card' && isFinal && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[7px] font-black uppercase tracking-wider px-2 py-0.5 rounded-b z-20" style={{
                              background: 'linear-gradient(135deg, #c9a84c, #b8943a)', color: '#0a0a12',
                              boxShadow: '0 2px 6px rgba(201,168,76,0.3)',
                            }}>{t('nc.bp.exclusive')}</div>
                          )}
                          {/* Lock overlay */}
                          {!isPremium && !paidClaimed && reached && (
                            <div className="absolute inset-0 rounded-lg flex items-center justify-center z-10" style={{
                              background: 'rgba(6,5,14,0.45)', backdropFilter: 'blur(1px)',
                            }}>
                              <svg viewBox="0 0 16 16" className="w-5 h-5" fill="none" stroke="#c9a84c22" strokeWidth={1.2}>
                                <path d="M8 10v1m-3 2h6a1 1 0 001-1v-2.5a1 1 0 00-1-1H5a1 1 0 00-1 1V12a1 1 0 001 1zm5-5v-1.5a2 2 0 10-4 0V7h4z"/>
                              </svg>
                            </div>
                          )}
                          {/* Reward — card rewards are clickable (#9) */}
                          <div className="py-3">
                            <RewardDisplay reward={tier.paidReward} t={t}
                              onClick={tier.paidReward.type === 'card' && tier.paidReward.cardId ? () => setPreviewCardId(tier.paidReward.cardId!) : undefined}
                            />
                          </div>
                          {/* Claim / claimed */}
                          {paidClaimed ? (
                            <div className="absolute bottom-1.5 right-1.5">
                              <svg viewBox="0 0 12 12" className="w-4 h-4"><circle cx="6" cy="6" r="5" fill="#c9a84c" opacity="0.15"/><path d="M3.5 6L5.5 8L8.5 4" fill="none" stroke="#c9a84c" strokeWidth="1.2" strokeLinecap="round"/></svg>
                            </div>
                          ) : canClaimPaid ? (
                            <button onClick={() => handleClaim(tier.level, 'paid')}
                              className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase px-3 py-1 rounded transition-all hover:brightness-125 hover:scale-105 active:scale-95"
                              style={{
                                background: 'linear-gradient(135deg, #c9a84c, #a07c2a)', color: '#0a0a12',
                                boxShadow: '0 2px 8px rgba(201,168,76,0.3)',
                              }}
                            >{t('nc.bp.claim')}</button>
                          ) : null}
                        </div>

                        {/* ── Tier badge + line ────────────────────────── */}
                        <div className="relative flex items-center justify-center h-8 mx-1 shrink-0">
                          {idx > 0 && <div className="absolute left-0 right-1/2 top-1/2 -translate-y-1/2" style={{
                            height: 3, borderRadius: 2,
                            background: reached ? 'linear-gradient(to right, #4a7dff40, #7c3aed40)' : '#1a1a28',
                          }} />}
                          {idx < NC_BP_TIERS.length - 1 && <div className="absolute left-1/2 right-0 top-1/2 -translate-y-1/2" style={{
                            height: 3, borderRadius: 2,
                            background: passed ? 'linear-gradient(to right, #7c3aed40, #4a7dff40)' : '#1a1a28',
                          }} />}
                          <div className={`relative z-10 flex items-center justify-center rounded-full transition-all ${isCurrentTier ? 'bp-badge-active' : ''}`} style={{
                            width: isCurrentTier ? 28 : isFinal && reached ? 26 : 22,
                            height: isCurrentTier ? 28 : isFinal && reached ? 26 : 22,
                            background: isCurrentTier
                              ? 'linear-gradient(135deg, #4a7dff, #7c3aed)'
                              : reached ? (isFinal ? 'linear-gradient(135deg, #c9a84c, #b8943a)' : '#2a2a45') : '#0e0e1a',
                            border: `2px solid ${isCurrentTier ? '#a78bfa' : reached ? (isFinal ? '#e8d48b' : '#3a3a5a') : '#1e1e30'}`,
                            boxShadow: isFinal && reached && !isCurrentTier ? '0 0 8px rgba(201,168,76,0.3)' : undefined,
                          }}>
                            <span className="text-[10px] font-black" style={{
                              color: isCurrentTier ? '#fff' : reached ? (isFinal ? '#0a0a12' : '#9a9aaa') : '#2a2a3a',
                            }}>{tier.level}</span>
                          </div>
                        </div>

                        {/* ── Free reward ──────────────────────────────── */}
                        <div className={`bp-tier-cell flex-1 flex flex-col items-center justify-center mx-1 rounded-lg relative overflow-hidden ${canClaimFree ? 'bp-glow-blue' : ''}`} style={{
                          background: freeClaimed
                            ? 'linear-gradient(180deg, #0e1018, #0c0b14)'
                            : reached ? 'linear-gradient(180deg, #10121e, #0c0b14)' : '#0c0b14',
                          border: `1px solid ${canClaimFree ? '#4a7dff50' : freeClaimed ? '#4a7dff12' : reached ? '#1e2038' : '#17162a'}`,
                          opacity: !reached ? 0.5 : 1,
                        }}>
                          {/* Blue bottom accent */}
                          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{
                            background: reached ? 'linear-gradient(to right, transparent, #4a7dff20, transparent)' : 'transparent',
                          }} />
                          {/* Exclusive badge */}
                          {tier.freeReward.type === 'card' && isFinal && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[7px] font-black uppercase tracking-wider px-2 py-0.5 rounded-b z-20" style={{
                              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff',
                              boxShadow: '0 2px 6px rgba(124,58,237,0.3)',
                            }}>{t('nc.bp.exclusive')}</div>
                          )}
                          {/* Reward — card rewards are clickable (#9) */}
                          <div className="py-3">
                            <RewardDisplay reward={tier.freeReward} t={t}
                              onClick={tier.freeReward.type === 'card' && tier.freeReward.cardId ? () => setPreviewCardId(tier.freeReward.cardId!) : undefined}
                            />
                          </div>
                          {/* Claim / claimed */}
                          {freeClaimed ? (
                            <div className="absolute bottom-1.5 right-1.5">
                              <svg viewBox="0 0 12 12" className="w-4 h-4"><circle cx="6" cy="6" r="5" fill="#4a7dff" opacity="0.15"/><path d="M3.5 6L5.5 8L8.5 4" fill="none" stroke="#4a7dff" strokeWidth="1.2" strokeLinecap="round"/></svg>
                            </div>
                          ) : canClaimFree ? (
                            <button onClick={() => handleClaim(tier.level, 'free')}
                              className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase px-3 py-1 rounded transition-all hover:brightness-125 hover:scale-105 active:scale-95"
                              style={{
                                background: 'linear-gradient(135deg, #4a7dff, #3b5bdb)', color: '#fff',
                                boxShadow: '0 2px 8px rgba(74,125,255,0.3)',
                              }}
                            >{t('nc.bp.claim')}</button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scroll fade edges */}
              <div className="absolute top-0 left-0 bottom-0 w-4 pointer-events-none z-10" style={{ background: 'linear-gradient(to right, #0e0e1a, transparent)' }} />
              <div className="absolute top-0 right-0 bottom-0 w-4 pointer-events-none z-10" style={{ background: 'linear-gradient(to left, #0e0e1a, transparent)' }} />

              {/* Scroll to current tier button (#3) */}
              <button
                onClick={scrollToCurrent}
                className="absolute bottom-3 right-6 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all hover:brightness-125 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #1a1a2e, #12121f)',
                  border: '1px solid #3a3a5a',
                  color: '#8a8a9a',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              >
                <svg viewBox="0 0 12 12" className="w-3 h-3"><circle cx="6" cy="6" r="4" fill="none" stroke="#7c3aed" strokeWidth="1.2"/><circle cx="6" cy="6" r="1.5" fill="#7c3aed"/></svg>
                {currentTier}
              </button>
            </div>

            {/* Bottom labels */}
            <div className="flex shrink-0 px-4 pb-2 justify-between items-center">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest" style={{ color: '#4a7dff50' }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#4a7dff40' }} />
                {t('nc.bp.free')}
              </div>
              {isMaxTier && (
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#c9a84c' }}>{t('nc.bp.maxTier')}</span>
              )}
            </div>
          </div>

          {/* Bottom accent line */}
          <div className="h-[1px] shrink-0" style={{ background: 'linear-gradient(to right, transparent, #7c3aed15, #c9a84c15, transparent)' }} />
        </div>
      </div>

      {/* Claim toast (#1) */}
      {claimToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60]">
          <ClaimToast reward={claimToast} t={t} />
        </div>
      )}

      {/* Premium unlock celebration (#2) */}
      {premiumSuccess && (
        <div className="fixed inset-0 z-[60] pointer-events-none bp-premium-flash flex items-center justify-center" style={{
          background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.15), transparent 70%)',
        }}>
          <div className="flex flex-col items-center gap-2" style={{ animation: 'bp-toast-in 0.3s ease-out' }}>
            <svg viewBox="0 0 32 32" className="w-16 h-16">
              <polygon points="16,2 20,12 31,12 22,18 25,29 16,22 7,29 10,18 1,12 12,12" fill="#c9a84c" opacity="0.9"/>
            </svg>
            <span className="text-lg font-black uppercase tracking-wider" style={{ color: '#c9a84c', textShadow: '0 0 20px rgba(201,168,76,0.5)' }}>
              {t('nc.bp.unlocked')}!
            </span>
          </div>
        </div>
      )}

      {showPremiumModal && (
        <PremiumModal profile={profile}
          onConfirm={handlePremiumUnlock}
          onCancel={() => setShowPremiumModal(false)} t={t}
        />
      )}

      {/* Card preview modal (#9) */}
      {previewCardId && (
        <CardPreviewModal cardId={previewCardId} onClose={() => setPreviewCardId(null)} t={t} />
      )}
    </>
  );
}
