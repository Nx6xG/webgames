'use client';

import { useMemo, useState } from 'react';
import type { NcRankedState, NcRankDef, NcRankTier, NcRankReward } from 'shared';
import { NC_RANK_DEFS, NC_RANK_REWARDS, getNcRank, getNcRankLabel } from 'shared';
import { useI18n } from '@/components/providers/LanguageProvider';

// ── Inline icons ────────────────────────────────────────────────────────

function CoinIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" style={{ width: size, height: size, flexShrink: 0 }}>
      <circle cx="10" cy="10" r="8" fill="#c9a84c" stroke="#a07c2a" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="5.5" fill="none" stroke="#e8d48b" strokeWidth="0.8"/>
      <text x="10" y="13.5" textAnchor="middle" fill="#7a5c1a" fontSize="8" fontWeight="bold">C</text>
    </svg>
  );
}

function GemIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" style={{ width: size, height: size, flexShrink: 0 }}>
      <polygon points="10,2 16,7 14,17 6,17 4,7" fill="#7c3aed" stroke="#a78bfa" strokeWidth="1"/>
      <polygon points="10,2 12,7 10,15 8,7" fill="#9f67ff" opacity="0.5"/>
    </svg>
  );
}

// ── Tier config ─────────────────────────────────────────────────────────

const TIER_COLORS: Record<NcRankTier, { main: string; bg: string; glow: string; gradient: string }> = {
  bronze:   { main: '#cd7f32', bg: 'rgba(205,127,50,0.10)',  glow: 'rgba(205,127,50,0.25)', gradient: 'linear-gradient(135deg, #cd7f32, #a0612a)' },
  silver:   { main: '#b0b0b8', bg: 'rgba(176,176,184,0.10)', glow: 'rgba(176,176,184,0.25)', gradient: 'linear-gradient(135deg, #b0b0b8, #8a8a92)' },
  gold:     { main: '#c9a84c', bg: 'rgba(201,168,76,0.10)',  glow: 'rgba(201,168,76,0.25)', gradient: 'linear-gradient(135deg, #c9a84c, #a07c2a)' },
  platinum: { main: '#56c8d8', bg: 'rgba(86,200,216,0.10)',  glow: 'rgba(86,200,216,0.25)', gradient: 'linear-gradient(135deg, #56c8d8, #3a9aaa)' },
  diamond:  { main: '#b388ff', bg: 'rgba(179,136,255,0.10)', glow: 'rgba(179,136,255,0.25)', gradient: 'linear-gradient(135deg, #b388ff, #8a5cf5)' },
  master:   { main: '#ff6e40', bg: 'rgba(255,110,64,0.10)',  glow: 'rgba(255,110,64,0.25)', gradient: 'linear-gradient(135deg, #ff6e40, #e64a19)' },
};

const TIER_ICONS: Record<NcRankTier, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', diamond: '👑', master: '🔥',
};

const TIER_ORDER: NcRankTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];

function daysUntilReset(): number {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return Math.max(0, Math.ceil((endOfMonth.getTime() - now.getTime()) / 86_400_000));
}

// ── Reward pills ────────────────────────────────────────────────────────

function RewardPills({ reward, size = 'sm' }: { reward: NcRankReward; size?: 'sm' | 'md' }) {
  const { t } = useI18n();
  const iconSize = size === 'md' ? 14 : 11;
  const textClass = size === 'md' ? 'text-[11px]' : 'text-[9px]';
  const py = size === 'md' ? 'py-1 px-2' : 'py-0.5 px-1.5';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`${textClass} font-bold flex items-center gap-1 ${py} rounded-full`}
        style={{ background: 'rgba(201,168,76,0.1)', color: '#c9a84c' }}>
        <CoinIcon size={iconSize} /> {reward.coins}
      </span>
      {reward.gems > 0 && (
        <span className={`${textClass} font-bold flex items-center gap-1 ${py} rounded-full`}
          style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa' }}>
          <GemIcon size={iconSize} /> {reward.gems}
        </span>
      )}
      {reward.packs && (
        <span className={`${textClass} font-bold ${py} rounded-full`}
          style={{
            background: reward.packs.type === 'premium' ? 'rgba(201,168,76,0.1)' : 'rgba(74,222,128,0.1)',
            color: reward.packs.type === 'premium' ? '#c9a84c' : '#4ade80',
          }}>
          {reward.packs.count}× {reward.packs.type === 'premium' ? t('nc.rank.premiumPack') : t('nc.rank.standardPack')}
        </span>
      )}
    </div>
  );
}

// ── Main RankDisplay (hub card) ─────────────────────────────────────────

interface RankDisplayProps {
  ranked?: NcRankedState;
  compact?: boolean;
}

export function RankDisplay({ ranked, compact }: RankDisplayProps) {
  const { t } = useI18n();
  const [showOverview, setShowOverview] = useState(false);

  const rank = useMemo(() => getNcRank(ranked?.points ?? 0), [ranked?.points]);
  const colors = TIER_COLORS[rank.tier];
  const label = getNcRankLabel(rank);
  const points = ranked?.points ?? 0;

  const progressInRank = points - rank.minPoints;
  const rankRange = rank.maxPoints - rank.minPoints;
  const progressPct = rank.tier === 'master' ? 100 : Math.min(100, (progressInRank / rankRange) * 100);

  const nextRankIdx = NC_RANK_DEFS.indexOf(rank) + 1;
  const nextRank = nextRankIdx < NC_RANK_DEFS.length ? NC_RANK_DEFS[nextRankIdx] : null;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: colors.bg, border: `1px solid ${colors.main}30` }}>
        <span className="text-sm">{TIER_ICONS[rank.tier]}</span>
        <span className="text-xs font-bold" style={{ color: colors.main }}>{label}</span>
        <span className="text-[10px] font-semibold" style={{ color: '#6a6a7a' }}>{points} RP</span>
      </div>
    );
  }

  const seasonReward = NC_RANK_REWARDS[rank.tier];
  const days = daysUntilReset();

  return (
    <>
      <div
        className="flex flex-col gap-3 p-4 rounded-xl cursor-pointer transition-all hover:brightness-110"
        style={{
          background: `linear-gradient(135deg, ${colors.bg}, #0a0a12)`,
          border: `1px solid ${colors.main}25`,
          boxShadow: `0 0 20px ${colors.glow}`,
        }}
        onClick={() => setShowOverview(true)}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{
            background: `linear-gradient(135deg, ${colors.main}20, ${colors.main}40)`,
            border: `2px solid ${colors.main}50`,
            boxShadow: `0 0 12px ${colors.glow}`,
          }}>
            {TIER_ICONS[rank.tier]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black" style={{ color: colors.main }}>{label}</p>
            <p className="text-[11px] font-semibold" style={{ color: '#6a6a7a' }}>
              {points} RP
              {ranked && ranked.peakPoints > points && (
                <span style={{ color: '#4a4a5a' }}> · {t('nc.rank.peak')} {ranked.peakPoints}</span>
              )}
            </p>
          </div>
          {ranked && (
            <div className="text-right">
              <p className="text-[11px] font-bold" style={{ color: '#4ade80' }}>{ranked.seasonWins}W</p>
              <p className="text-[11px] font-bold" style={{ color: '#ef4444' }}>{ranked.seasonLosses}L</p>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-[9px] font-semibold" style={{ color: '#4a4a5a' }}>{rank.minPoints}</span>
            {nextRank && <span className="text-[9px] font-semibold" style={{ color: '#4a4a5a' }}>{rank.maxPoints}</span>}
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1a1a2e' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${colors.main}80, ${colors.main})`, boxShadow: `0 0 8px ${colors.glow}` }} />
          </div>
          {nextRank && (
            <p className="text-[9px] font-semibold text-center" style={{ color: '#4a4a5a' }}>
              {rank.maxPoints - points} RP {t('nc.rank.toNext')} {getNcRankLabel(nextRank)}
            </p>
          )}
        </div>

        {/* Timer + rewards */}
        <div className="flex items-center gap-2 pt-1 flex-wrap" style={{ borderTop: '1px solid #1a1a2e' }}>
          <span className="text-[9px] font-bold" style={{ color: '#6a6a7a' }}>⏱ {days} {t('nc.rank.daysLeft')}</span>
          <span className="text-[9px]" style={{ color: '#2a2a3a' }}>·</span>
          <RewardPills reward={seasonReward} />
        </div>
      </div>

      {showOverview && <RankOverview ranked={ranked} onClose={() => setShowOverview(false)} />}
    </>
  );
}

// ── Rank Overview (polished modal) ──────────────────────────────────────

function RankOverview({ ranked, onClose }: { ranked?: NcRankedState; onClose: () => void }) {
  const { t } = useI18n();
  const currentRank = useMemo(() => getNcRank(ranked?.points ?? 0), [ranked?.points]);
  const points = ranked?.points ?? 0;
  const days = daysUntilReset();
  const currentColors = TIER_COLORS[currentRank.tier];

  const tiers = useMemo(() => {
    return TIER_ORDER.map(tier => {
      const defs = NC_RANK_DEFS.filter(d => d.tier === tier);
      return { tier, defs, colors: TIER_COLORS[tier], reward: NC_RANK_REWARDS[tier], icon: TIER_ICONS[tier] };
    });
  }, []);

  // Progress within current rank
  const progressInRank = points - currentRank.minPoints;
  const rankRange = currentRank.maxPoints - currentRank.minPoints;
  const progressPct = currentRank.tier === 'master' ? 100 : Math.min(100, (progressInRank / rankRange) * 100);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="flex flex-col max-w-md w-full mx-4 max-h-[88vh] rounded-2xl overflow-hidden"
        style={{
          background: '#0a0a12',
          border: '1px solid #1a1a2e',
          boxShadow: `0 0 80px ${currentColors.glow}, 0 0 0 1px #0a0a12`,
        }}
        onClick={e => e.stopPropagation()}>

        {/* ── Hero section ── */}
        <div className="relative shrink-0 overflow-hidden">
          {/* Gradient bg */}
          <div className="absolute inset-0" style={{
            background: `radial-gradient(ellipse at 50% 20%, ${currentColors.main}18, transparent 70%), linear-gradient(180deg, #10101e, #0a0a12)`,
          }} />
          {/* Content */}
          <div className="relative flex flex-col items-center gap-3 px-6 pt-5 pb-4">
            {/* Close button */}
            <button onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
              style={{ color: '#4a4a5a' }}>✕</button>

            {/* Rank icon + ring */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#1a1a2e" strokeWidth="3" />
                <circle cx="40" cy="40" r="36" fill="none" stroke={currentColors.main} strokeWidth="3"
                  strokeDasharray={`${226.2 * progressPct / 100} 226.2`}
                  strokeLinecap="round" transform="rotate(-90 40 40)"
                  style={{ filter: `drop-shadow(0 0 4px ${currentColors.glow})`, transition: 'stroke-dasharray 0.6s ease' }} />
              </svg>
              <span className="text-3xl">{TIER_ICONS[currentRank.tier]}</span>
            </div>

            <div className="text-center">
              <p className="text-lg font-black tracking-tight" style={{ color: currentColors.main }}>
                {getNcRankLabel(currentRank)}
              </p>
              <p className="text-sm font-bold tabular-nums" style={{ color: '#8a8a9a' }}>
                {points} <span className="text-[10px] font-semibold" style={{ color: '#4a4a5a' }}>RP</span>
                {ranked && ranked.peakPoints > points && (
                  <span className="ml-2 text-[10px]" style={{ color: '#3a3a5a' }}>({t('nc.rank.peak')} {ranked.peakPoints})</span>
                )}
              </p>
            </div>

            {/* W / L chips */}
            {ranked && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                  {ranked.seasonWins} {t('nc.rank.wins')}
                </span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  {ranked.seasonLosses} {t('nc.rank.losses')}
                </span>
              </div>
            )}

            {/* Season timer */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a2e' }}>
              <span className="text-[10px]" style={{ color: '#4a4a5a' }}>⏱</span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: '#6a6a7a' }}>
                {days} {t('nc.rank.daysLeft')}
              </span>
            </div>
          </div>
          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${currentColors.main}30, transparent)` }} />
        </div>

        {/* ── Tier ladder ── */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-1.5">
            {tiers.map(({ tier, defs, colors, reward, icon }) => {
              const isCurrentTier = currentRank.tier === tier;
              const isReached = points >= defs[0].minPoints;
              const isPast = points >= (defs[0].maxPoints);
              const tierIdx = TIER_ORDER.indexOf(tier);
              const currentIdx = TIER_ORDER.indexOf(currentRank.tier);

              return (
                <div key={tier}
                  className="relative rounded-xl transition-all"
                  style={{
                    background: isCurrentTier
                      ? `linear-gradient(135deg, ${colors.bg}, rgba(10,10,18,0.8))`
                      : '#0c0c16',
                    border: `1px solid ${isCurrentTier ? colors.main + '35' : '#141422'}`,
                    opacity: tierIdx <= currentIdx ? 1 : 0.45,
                  }}>

                  {/* Active indicator line */}
                  {isCurrentTier && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                      style={{ background: colors.gradient, boxShadow: `0 0 8px ${colors.glow}` }} />
                  )}

                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                      style={{
                        background: isCurrentTier ? `${colors.main}15` : '#0a0a12',
                        border: `1px solid ${isCurrentTier ? colors.main + '30' : '#1a1a2e'}`,
                      }}>
                      {icon}
                    </div>

                    {/* Name + range */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black" style={{ color: isReached ? colors.main : '#3a3a4a' }}>
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </p>
                        {isPast && !isCurrentTier && tierIdx < currentIdx && (
                          <svg viewBox="0 0 12 12" className="w-3 h-3" style={{ color: colors.main }}>
                            <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
                            <path d="M3.5 6L5.5 7.5L8.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
                          </svg>
                        )}
                      </div>
                      <p className="text-[9px] font-semibold" style={{ color: '#3a3a4a' }}>
                        {tier === 'master' ? `${defs[0].minPoints}+ RP` : `${defs[defs.length - 1].minPoints} – ${defs[0].maxPoints} RP`}
                      </p>
                    </div>

                    {/* Division dots */}
                    {tier !== 'master' ? (
                      <div className="flex items-center gap-1.5">
                        {defs.map(d => {
                          const isCurrent = isCurrentTier && currentRank.division === d.division;
                          const isDone = points >= d.maxPoints;
                          return (
                            <div key={d.division}
                              className="relative flex items-center justify-center"
                              style={{ width: 22, height: 22 }}>
                              {isCurrent && (
                                <div className="absolute inset-0 rounded-md"
                                  style={{ background: colors.main, opacity: 0.15, boxShadow: `0 0 8px ${colors.glow}` }} />
                              )}
                              <span className="relative text-[8px] font-black"
                                style={{
                                  color: isCurrent ? colors.main : isDone ? `${colors.main}90` : '#2a2a3a',
                                }}>
                                {['', 'I', 'II', 'III'][d.division]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      isCurrentTier && (
                        <div className="w-6 h-6 rounded-md flex items-center justify-center"
                          style={{ background: `${colors.main}20` }}>
                          <span className="text-[9px] font-black" style={{ color: colors.main }}>✦</span>
                        </div>
                      )
                    )}

                    {/* Reward preview */}
                    <div className="shrink-0 ml-1">
                      <RewardPills reward={reward} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #141422' }}>
          <p className="text-[10px] font-semibold" style={{ color: '#3a3a4a' }}>
            <span style={{ color: '#4ade80' }}>+30</span> / <span style={{ color: '#ef4444' }}>-15</span> RP
          </p>
          <p className="text-[10px] font-bold flex items-center gap-1.5" style={{ color: '#4a4a5a' }}>
            ⏱ {days} {t('nc.rank.daysLeft')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Season Reset Modal ──────────────────────────────────────────────────

export function RankSeasonResetModal({ peakTier, reward, prevPoints, onDismiss }: {
  peakTier: string;
  reward: NcRankReward;
  prevPoints: number;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const colors = TIER_COLORS[peakTier as NcRankTier] ?? TIER_COLORS.bronze;
  const peakRank = getNcRank(prevPoints);
  const label = getNcRankLabel(peakRank);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="flex flex-col items-center gap-5 p-7 rounded-2xl max-w-sm w-full mx-4"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${colors.main}10, #0a0a12 60%)`,
          border: `1px solid ${colors.main}25`,
          boxShadow: `0 0 60px ${colors.glow}`,
        }}>
        <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: '#4a4a5a' }}>
          {t('nc.rank.seasonEnd')}
        </p>

        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl">{TIER_ICONS[peakTier as NcRankTier] ?? '🏆'}</span>
          <p className="text-lg font-black" style={{ color: colors.main }}>{label}</p>
          <p className="text-xs font-semibold tabular-nums" style={{ color: '#6a6a7a' }}>
            {t('nc.rank.peak')}: {prevPoints} RP
          </p>
        </div>

        <div className="flex flex-col gap-2.5 w-full p-4 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a2e' }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-center" style={{ color: '#3a3a4a' }}>
            {t('nc.rank.rewards')}
          </p>
          <div className="flex items-center justify-center">
            <RewardPills reward={reward} size="md" />
          </div>
        </div>

        <button onClick={onDismiss}
          className="w-full py-3 rounded-xl font-black text-sm transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: colors.gradient, color: '#0a0a12', boxShadow: `0 4px 20px ${colors.glow}` }}>
          {t('nc.rank.claim')}
        </button>
      </div>
    </div>
  );
}
