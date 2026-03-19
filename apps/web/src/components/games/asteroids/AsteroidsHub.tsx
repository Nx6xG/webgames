'use client';

import { useState, useMemo } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import type {
  RogueliteSave, ShipId, CurseId, MilestoneId, DailyRunResult,
  PermanentUpgrade, ShipDef, CurseDef, MilestoneDef, DailyModifierDef,
  BestiaryEntry, TempBuffId, ArtifactId,
} from './roguelite-types';
import {
  PERMANENT_UPGRADES, SHIPS, SHIP_MAP, CURSES, MILESTONES,
  getCurseScrapMultiplier, ASTEROID_VARIANT_CONFIG, BOSS_VARIANT_CONFIG,
  ELITE_MODIFIER_CONFIG, getDailyModifiers, TEMP_BUFF_MAP, ARTIFACT_MAP,
} from './roguelite-data';
import { isShipUnlocked, hasDailyRunToday, getDailyRunDate } from './roguelite-state';
import type { AsteroidsStats } from './stats';

// ── Types ────────────────────────────────────────────────────────────────────

type GameMode = 'endless' | 'roguelite';
type Difficulty = 'easy' | 'medium' | 'hard';
type HubTab = 'launch' | 'upgrades' | 'ships' | 'curses' | 'bestiary' | 'milestones' | 'daily';

interface AsteroidsHubProps {
  mode: GameMode;
  setMode: (m: GameMode) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  rlSave: RogueliteSave | null;
  activeCurses: CurseId[];
  setActiveCurses: React.Dispatch<React.SetStateAction<CurseId[]>>;
  dailyResult: DailyRunResult | null;
  stats: AsteroidsStats | null;
  onStart: () => void;
  onStartDaily: () => void;
  onBuyUpgrade: (id: string) => void;
  onAscend: () => void;
  onSelectShip: (id: ShipId) => void;
}

// ── Design tokens ────────────────────────────────────────────────────────────

const C = {
  hull: '#0a0c10',
  panel: '#0d1117',
  surface: '#141922',
  surfaceHover: '#1a2332',
  border: '#1e2a3a',
  borderActive: '#2a3a4f',
  cyan: '#0ff0fc',
  cyanDim: '#06b6d4',
  cyanGlow: 'rgba(15,240,252,0.08)',
  cyanBorder: 'rgba(6,182,212,0.3)',
  amber: '#f59e0b',
  amberDim: '#d97706',
  amberGlow: 'rgba(245,158,11,0.08)',
  amberBorder: 'rgba(217,119,6,0.3)',
  red: '#ef4444',
  redDim: '#dc2626',
  redGlow: 'rgba(239,68,68,0.06)',
  redBorder: 'rgba(220,38,38,0.3)',
  green: '#22c55e',
  muted: '#5a6a7f',
  text: '#c8d6e5',
  textBright: '#e8eef5',
} as const;

// ── Tab definitions ──────────────────────────────────────────────────────────

const TAB_DEFS: { id: HubTab; labelKey: string; rogueliteOnly: boolean }[] = [
  { id: 'launch', labelKey: 'asteroids.hub.launch', rogueliteOnly: false },
  { id: 'upgrades', labelKey: 'asteroids.rl.upgrades', rogueliteOnly: true },
  { id: 'ships', labelKey: 'asteroids.rl.ship.select', rogueliteOnly: true },
  { id: 'curses', labelKey: 'asteroids.rl.curses', rogueliteOnly: true },
  { id: 'bestiary', labelKey: 'asteroids.rl.bestiary', rogueliteOnly: true },
  { id: 'milestones', labelKey: 'asteroids.rl.milestones', rogueliteOnly: true },
  { id: 'daily', labelKey: 'asteroids.rl.daily', rogueliteOnly: true },
];

// ── Bestiary entries ─────────────────────────────────────────────────────────

const ALL_BESTIARY: Array<{ key: string; category: 'asteroids' | 'bosses' | 'elites'; label: string; color: string }> = [
  ...Object.keys(ASTEROID_VARIANT_CONFIG).map(k => ({
    key: `asteroid_${k}`, category: 'asteroids' as const,
    label: k.charAt(0).toUpperCase() + k.slice(1),
    color: ASTEROID_VARIANT_CONFIG[k as keyof typeof ASTEROID_VARIANT_CONFIG].color,
  })),
  ...Object.keys(BOSS_VARIANT_CONFIG).map(k => ({
    key: `boss_${k}`, category: 'bosses' as const,
    label: k.charAt(0).toUpperCase() + k.slice(1), color: '#ef4444',
  })),
  ...Object.keys(ELITE_MODIFIER_CONFIG).map(k => ({
    key: `elite_${k}`, category: 'elites' as const,
    label: k.charAt(0).toUpperCase() + k.slice(1),
    color: ELITE_MODIFIER_CONFIG[k as keyof typeof ELITE_MODIFIER_CONFIG].color,
  })),
  { key: 'megaboss', category: 'bosses', label: 'Mega-Boss', color: '#f59e0b' },
];

// ── Milestone unlock label helpers ───────────────────────────────────────────

function getUnlockLabel(ms: MilestoneDef, t: (k: string) => string): string {
  const u = ms.unlock;
  if (u.type === 'ship') { const s = SHIPS.find(s2 => s2.id === u.shipId); return s ? `${s.icon} ${t(s.nameKey)}` : u.shipId; }
  if (u.type === 'buff') { const b = TEMP_BUFF_MAP[u.buffId]; return b ? `${b.icon} ${t(b.nameKey)}` : u.buffId; }
  if (u.type === 'artifact') { const a = ARTIFACT_MAP[u.artifactId]; return a ? `${a.icon} ${t(a.nameKey)}` : u.artifactId; }
  return '';
}

function getUnlockTypeLabel(ms: MilestoneDef, t: (k: string) => string): string {
  if (ms.unlock.type === 'ship') return 'SHIP';
  if (ms.unlock.type === 'buff') return 'BUFF';
  if (ms.unlock.type === 'artifact') return 'ARTIFACT';
  return '';
}

// ── Scanline overlay ─────────────────────────────────────────────────────────

function Scanlines() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10" style={{
      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(15,240,252,0.015) 2px, rgba(15,240,252,0.015) 4px)',
      mixBlendMode: 'overlay',
    }} />
  );
}

// ── Hex separator ────────────────────────────────────────────────────────────

function HexDivider() {
  return (
    <div className="flex items-center gap-2 my-1 px-2" style={{ color: C.border }}>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${C.border})` }} />
      <svg viewBox="0 0 12 10" style={{ width: 10, height: 8 }}>
        <polygon points="6,0 12,5 6,10 0,5" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, transparent, ${C.border})` }} />
    </div>
  );
}

// ── Status indicator ─────────────────────────────────────────────────────────

function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: 8, height: 8 }}>
      <span className="absolute inset-0 rounded-full" style={{
        background: color,
        boxShadow: `0 0 6px ${color}`,
        animation: pulse ? 'statusPulse 2s ease-in-out infinite' : undefined,
      }} />
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function AsteroidsHub({
  mode, setMode, difficulty, setDifficulty,
  rlSave, activeCurses, setActiveCurses, dailyResult, stats,
  onStart, onStartDaily, onBuyUpgrade, onAscend, onSelectShip,
}: AsteroidsHubProps) {
  const { t } = useI18n();
  const [hubTab, setHubTab] = useState<HubTab>('launch');

  const showRoguelite = mode === 'roguelite' && rlSave;
  const visibleTabs = TAB_DEFS.filter(td => !td.rogueliteOnly || showRoguelite);

  // Upgrade stats
  const upgStats = useMemo(() => {
    if (!rlSave) return { total: 0, owned: 0, pct: 0, allMaxed: false };
    const total = PERMANENT_UPGRADES.reduce((s, u) => s + u.maxTier, 0);
    const owned = PERMANENT_UPGRADES.reduce((s, u) => s + (rlSave.upgrades[u.id] ?? 0), 0);
    return { total, owned, pct: total > 0 ? Math.round((owned / total) * 100) : 0, allMaxed: PERMANENT_UPGRADES.every(u => (rlSave.upgrades[u.id] ?? 0) >= u.maxTier) };
  }, [rlSave]);

  // Milestone stats
  const msStats = useMemo(() => {
    if (!rlSave) return { done: 0, total: 0, pct: 0 };
    return { done: rlSave.unlockedMilestones.length, total: MILESTONES.length, pct: MILESTONES.length > 0 ? Math.round((rlSave.unlockedMilestones.length / MILESTONES.length) * 100) : 0 };
  }, [rlSave]);

  const diffLabels: Record<Difficulty, string> = {
    easy: t('asteroids.easy'), medium: t('asteroids.medium'), hard: t('asteroids.hard'),
  };

  const curseMultiplier = getCurseScrapMultiplier(activeCurses);
  const alreadyPlayedDaily = hasDailyRunToday();
  const dailyMods = useMemo(() => getDailyModifiers(), []);
  const todayDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  // Ship unlock helper
  const getShipUnlockInfo = (shipId: ShipId) => {
    if (shipId === 'vanguard') return null;
    const ms = MILESTONES.find(m => m.unlock.type === 'ship' && m.unlock.shipId === shipId);
    if (!ms || !rlSave) return null;
    return { milestone: ms, done: rlSave.unlockedMilestones.includes(ms.id) };
  };

  // If switching to endless, snap back to launch tab
  const handleSetMode = (m: GameMode) => {
    setMode(m);
    if (m === 'endless' && hubTab !== 'launch') setHubTab('launch');
  };

  return (
    <div className="flex flex-col flex-1 relative overflow-hidden" style={{
      background: `radial-gradient(ellipse at 50% 0%, ${C.panel} 0%, ${C.hull} 60%)`,
    }}>
      <Scanlines />

      {/* ═══ COCKPIT HEADER ═══ */}
      <div className="relative z-20 shrink-0 px-4 sm:px-6 pt-4 pb-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            {/* Hex icon */}
            <div className="w-9 h-9 flex items-center justify-center" style={{
              background: C.cyanGlow,
              border: `1px solid ${C.cyanBorder}`,
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }}>
              <svg viewBox="0 0 20 20" style={{ width: 16, height: 16 }}>
                <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" fill="none" stroke={C.cyan} strokeWidth="1.2" />
                <circle cx="10" cy="10" r="2" fill={C.cyan} />
              </svg>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-[0.2em]" style={{
                color: C.textBright,
                textShadow: `0 0 20px rgba(15,240,252,0.15)`,
              }}>
                ASTEROIDS
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusDot color={C.cyan} pulse />
                <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: C.muted }}>
                  {t('asteroids.hub.systemOnline')}
                </span>
              </div>
            </div>
          </div>

          {/* Scrap + Ascension (roguelite) */}
          {showRoguelite && (
            <div className="flex items-center gap-3">
              {(rlSave.ascensionLevel ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded" style={{
                  background: C.amberGlow,
                  border: `1px solid ${C.amberBorder}`,
                }}>
                  <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: C.amber }}>
                    ASC {rlSave.ascensionLevel}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{
                background: C.amberGlow,
                border: `1px solid ${C.amberBorder}`,
              }}>
                <svg viewBox="0 0 12 12" style={{ width: 12, height: 12 }}>
                  <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" fill={C.amber} />
                </svg>
                <span className="text-sm font-black tabular-nums" style={{ color: C.amber }}>
                  {rlSave.scrap.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Ship + Curse bar (roguelite) */}
        {showRoguelite && (
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
            <span style={{ color: SHIP_MAP[rlSave.selectedShip].color }}>
              {SHIP_MAP[rlSave.selectedShip].icon} {t(SHIP_MAP[rlSave.selectedShip].nameKey)}
            </span>
            {activeCurses.length > 0 && (
              <span style={{ color: C.redDim }}>
                {activeCurses.map(c => CURSES.find(cc => cc.id === c)?.icon).join(' ')} x{curseMultiplier.toFixed(1)}
              </span>
            )}
            {rlSave.totalRuns > 0 && (
              <span>
                {t('asteroids.rl.bestRun')}: W{rlSave.bestWave}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ═══ TAB BAR ═══ */}
      <div className="relative z-20 shrink-0 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto pb-0.5" style={{
          borderBottom: `1px solid ${C.border}`,
        }}>
          {visibleTabs.map(td => {
            const active = hubTab === td.id;
            return (
              <button key={td.id} onClick={() => setHubTab(td.id)}
                className="relative px-3 sm:px-4 py-2.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.12em] whitespace-nowrap transition-all cursor-pointer"
                style={{
                  color: active ? C.cyan : C.muted,
                  background: active ? C.cyanGlow : 'transparent',
                }}
              >
                {t(td.labelKey)}
                {active && (
                  <div className="absolute bottom-0 left-1 right-1 h-[2px]" style={{
                    background: C.cyan,
                    boxShadow: `0 0 8px ${C.cyan}`,
                  }} />
                )}
                {/* Badge indicators */}
                {td.id === 'daily' && !alreadyPlayedDaily && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full" style={{ background: C.green, boxShadow: `0 0 4px ${C.green}` }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ CONTENT AREA ═══ */}
      <div className="relative z-20 flex-1 overflow-y-auto px-4 sm:px-6 py-4" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: `${C.border} transparent`,
      }}>

        {/* ── LAUNCH TAB ── */}
        {hubTab === 'launch' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Mode selector */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: C.muted }}>
                {t('asteroids.rl.selectMode')}
              </span>
              <div className="flex gap-2">
                {(['endless', 'roguelite'] as GameMode[]).map(m => {
                  const active = mode === m;
                  const mColor = m === 'roguelite' ? C.amber : C.cyan;
                  return (
                    <button key={m} onClick={() => handleSetMode(m)}
                      className="px-6 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition-all cursor-pointer"
                      style={{
                        background: active ? `${mColor}12` : C.surface,
                        border: `1px solid ${active ? mColor + '60' : C.border}`,
                        color: active ? mColor : C.muted,
                        boxShadow: active ? `0 0 16px ${mColor}15, inset 0 0 12px ${mColor}08` : 'none',
                        clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
                      }}
                    >
                      {m === 'endless' ? t('asteroids.rl.endless') : t('asteroids.rl.mode')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty selector (endless) */}
            {mode === 'endless' && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: C.muted }}>
                  {t('asteroids.difficulty')}
                </span>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => {
                    const active = difficulty === d;
                    return (
                      <button key={d} onClick={() => setDifficulty(d)}
                        className="px-5 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                        style={{
                          background: active ? C.cyanGlow : C.surface,
                          border: `1px solid ${active ? C.cyanBorder : C.border}`,
                          color: active ? C.cyan : C.muted,
                        }}
                      >
                        {diffLabels[d]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <HexDivider />

            {/* LAUNCH button */}
            <div className="flex flex-col items-center gap-3">
              <button onClick={onStart}
                disabled={mode === 'roguelite' && !rlSave}
                className="group relative px-14 py-4 font-black text-base uppercase tracking-[0.2em] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, ${C.surface}, ${C.panel})`,
                  border: `2px solid ${C.cyanBorder}`,
                  color: C.cyan,
                  clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
                  boxShadow: `0 0 30px rgba(15,240,252,0.1), inset 0 0 20px rgba(15,240,252,0.03)`,
                }}
              >
                <span className="relative z-10">{t('asteroids.hub.launch')}</span>
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{
                  background: `linear-gradient(135deg, rgba(15,240,252,0.06), rgba(15,240,252,0.02))`,
                  clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
                }} />
              </button>

              <p className="text-[9px] font-mono max-sm:hidden" style={{ color: C.border }}>
                ARROW KEYS / WASD + SPACE + P
              </p>
            </div>

            {/* Stats readout */}
            {mode === 'endless' && stats && stats.games > 0 && (
              <>
                <HexDivider />
                <div className="rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div className="text-[9px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: C.muted }}>
                    {t('asteroids.hub.flightLog')}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: t('game.score'), value: stats.bestScore.toLocaleString() },
                      { label: t('asteroids.wave'), value: String(stats.bestWave) },
                      { label: t('asteroids.totalDestroyed'), value: stats.totalAsteroids.toLocaleString() },
                    ].map(row => (
                      <div key={row.label} className="text-center">
                        <div className="text-lg font-black tabular-nums" style={{ color: C.textBright }}>{row.value}</div>
                        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{row.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Roguelite run stats */}
            {showRoguelite && rlSave.totalRuns > 0 && (
              <>
                <HexDivider />
                <div className="rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div className="text-[9px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: C.muted }}>
                    {t('asteroids.hub.flightLog')}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: t('asteroids.rl.bestRun'), value: `W${rlSave.bestWave}` },
                      { label: t('game.score'), value: rlSave.bestScore.toLocaleString() },
                      { label: t('asteroids.rl.totalRuns'), value: String(rlSave.totalRuns) },
                    ].map(row => (
                      <div key={row.label} className="text-center">
                        <div className="text-lg font-black tabular-nums" style={{ color: C.textBright }}>{row.value}</div>
                        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{row.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Daily run result */}
            {showRoguelite && dailyResult && dailyResult.date === getDailyRunDate() && (
              <div className="rounded-lg p-3 flex items-center gap-4" style={{
                background: C.surface,
                border: `1px solid ${C.green}30`,
              }}>
                <StatusDot color={C.green} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.green }}>
                  {t('asteroids.rl.daily.today')}
                </span>
                <span className="text-[10px] font-mono tabular-nums" style={{ color: C.text }}>
                  W{dailyResult.wave} / {dailyResult.score.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── UPGRADES TAB ── */}
        {hubTab === 'upgrades' && rlSave && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Progress bar */}
            <div className="rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: C.muted }}>
                  {t('asteroids.rl.progress')}
                </span>
                <span className="text-[10px] font-black tabular-nums" style={{ color: C.amber }}>
                  {upgStats.owned}/{upgStats.total} ({upgStats.pct}%)
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: C.hull, border: `1px solid ${C.border}` }}>
                <div className="h-full rounded-full transition-all duration-500" style={{
                  width: `${upgStats.pct}%`,
                  background: `linear-gradient(90deg, ${C.amberDim}, ${C.amber})`,
                  boxShadow: `0 0 8px ${C.amber}40`,
                }} />
              </div>
            </div>

            {/* Ascension panel */}
            {upgStats.allMaxed && (
              <div className="rounded-lg p-5 flex items-center justify-between gap-4" style={{
                background: C.amberGlow,
                border: `2px solid ${C.amberBorder}`,
                boxShadow: `0 0 30px ${C.amber}10`,
              }}>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: C.amber }}>
                    {t('asteroids.rl.ascend')}
                  </h3>
                  <p className="text-[10px] mt-1" style={{ color: C.muted }}>{t('asteroids.rl.ascend.confirm')}</p>
                  <p className="text-[10px] mt-0.5 font-bold" style={{ color: C.amberDim }}>{t('asteroids.rl.ascend.bonus')}</p>
                </div>
                <button onClick={onAscend}
                  className="px-5 py-2.5 font-black text-xs uppercase tracking-wider transition-all cursor-pointer hover:brightness-110 active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, ${C.amberDim}, ${C.amber})`,
                    color: C.hull,
                    clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
                  }}
                >
                  {t('asteroids.rl.ascend')} → {(rlSave.ascensionLevel ?? 0) + 1}
                </button>
              </div>
            )}

            {/* Upgrade grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PERMANENT_UPGRADES.map(upg => {
                const currentTier = rlSave.upgrades[upg.id] ?? 0;
                const isMaxed = currentTier >= upg.maxTier;
                const nextCost = isMaxed ? 0 : upg.costs[currentTier] ?? 0;
                const canAfford = rlSave.scrap >= nextCost;
                return (
                  <div key={upg.id} className="rounded-lg p-4 flex flex-col gap-2.5 transition-all" style={{
                    background: C.surface,
                    border: `1px solid ${isMaxed ? C.amberBorder : C.border}`,
                    boxShadow: isMaxed ? `inset 0 0 20px ${C.amber}06` : 'none',
                  }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded flex items-center justify-center text-lg" style={{
                        background: isMaxed ? C.amberGlow : `${C.hull}`,
                        border: `1px solid ${isMaxed ? C.amberBorder : C.border}`,
                      }}>
                        {upg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black truncate" style={{ color: C.textBright }}>{t(upg.nameKey)}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          {Array.from({ length: upg.maxTier }, (_, i) => (
                            <div key={i} className="w-2.5 h-2.5 rounded-sm transition-all" style={{
                              background: i < currentTier ? C.amber : 'transparent',
                              border: `1px solid ${i < currentTier ? C.amber : i === currentTier && !isMaxed ? C.amberDim + '80' : C.border}`,
                              boxShadow: i < currentTier ? `0 0 4px ${C.amber}40` : 'none',
                            }} />
                          ))}
                          {isMaxed && <span className="ml-1.5 text-[8px] font-black tracking-wider" style={{ color: C.amber }}>MAX</span>}
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color: C.muted }}>{t(upg.descKey)}</p>
                    {!isMaxed && (
                      <button onClick={() => onBuyUpgrade(upg.id)} disabled={!canAfford}
                        className="mt-auto flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed"
                        style={{
                          background: canAfford ? C.amberGlow : C.hull,
                          border: `1px solid ${canAfford ? C.amberBorder : C.border}`,
                          color: canAfford ? C.amber : C.border,
                          clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
                        }}
                      >
                        <svg viewBox="0 0 12 12" style={{ width: 10, height: 10 }}>
                          <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" fill="currentColor" />
                        </svg>
                        {nextCost.toLocaleString()}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SHIPS TAB ── */}
        {hubTab === 'ships' && rlSave && (
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {SHIPS.map(ship => {
                const unlocked = isShipUnlocked(rlSave, ship.id);
                const active = ship.id === rlSave.selectedShip;
                const info = getShipUnlockInfo(ship.id);
                return (
                  <button key={ship.id}
                    onClick={() => unlocked && onSelectShip(ship.id)}
                    disabled={!unlocked}
                    className="relative flex flex-col gap-3 rounded-lg p-4 text-left transition-all cursor-pointer disabled:cursor-not-allowed"
                    style={{
                      background: active ? `${ship.color}08` : unlocked ? C.surface : C.hull,
                      border: active ? `2px solid ${ship.color}60` : `1px solid ${unlocked ? C.border : C.border + '60'}`,
                      opacity: unlocked ? 1 : 0.5,
                      boxShadow: active ? `0 0 24px ${ship.color}15, inset 0 0 16px ${ship.color}05` : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded flex items-center justify-center text-xl" style={{
                        background: `${unlocked ? ship.color : C.muted}15`,
                        border: `1px solid ${unlocked ? ship.color : C.muted}30`,
                      }}>
                        {ship.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-black" style={{ color: unlocked ? C.textBright : C.muted }}>
                          {t(ship.nameKey)}
                        </h3>
                        {active && (
                          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: ship.color }}>
                            ACTIVE
                          </span>
                        )}
                        {unlocked && !active && (
                          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: C.green }}>
                            {t('asteroids.rl.ship.unlocked')}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color: C.muted }}>{t(ship.descKey)}</p>
                    <div className="text-[9px] font-bold" style={{ color: unlocked ? ship.color : C.muted }}>
                      {t('asteroids.rl.ship.passive')}: {t(ship.passiveKey)}
                    </div>
                    {!unlocked && info && (
                      <div className="mt-auto pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                        <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: C.redDim }}>
                          {t('asteroids.rl.ship.locked')}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[9px]" style={{ color: C.muted }}>
                          <span>{info.milestone.icon}</span>
                          <span className="font-bold" style={{ color: C.text }}>{t(info.milestone.nameKey)}</span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CURSES TAB ── */}
        {hubTab === 'curses' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] leading-relaxed" style={{ color: C.muted }}>{t('asteroids.rl.curses.desc')}</p>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded shrink-0 ml-4" style={{
                background: C.redGlow,
                border: `1px solid ${C.redBorder}`,
              }}>
                <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: C.redDim }}>
                  {t('asteroids.rl.curses.bonus')}
                </span>
                <span className="text-sm font-black tabular-nums" style={{ color: C.red }}>
                  x{curseMultiplier.toFixed(1)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CURSES.map(curse => {
                const active = activeCurses.includes(curse.id);
                return (
                  <button key={curse.id}
                    onClick={() => setActiveCurses(prev => prev.includes(curse.id) ? prev.filter(c => c !== curse.id) : [...prev, curse.id])}
                    className="flex items-start gap-3 rounded-lg p-4 text-left transition-all cursor-pointer"
                    style={{
                      background: active ? C.redGlow : C.surface,
                      border: `1px solid ${active ? C.redBorder : C.border}`,
                      boxShadow: active ? `inset 0 0 20px ${C.red}06` : 'none',
                    }}
                  >
                    <div className="w-10 h-10 rounded flex items-center justify-center text-lg shrink-0" style={{
                      background: `${curse.color}18`,
                      border: `1px solid ${curse.color}30`,
                    }}>
                      {curse.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black" style={{ color: C.textBright }}>{t(curse.nameKey)}</h3>
                        <span className="text-[9px] font-black tabular-nums" style={{ color: curse.color }}>x{curse.scrapMultiplier.toFixed(1)}</span>
                      </div>
                      <p className="text-[10px] mt-1 leading-relaxed" style={{ color: C.muted }}>{t(curse.descKey)}</p>
                    </div>
                    <div className="w-5 h-5 rounded shrink-0 flex items-center justify-center mt-0.5 transition-all" style={{
                      background: active ? C.red : 'transparent',
                      border: `2px solid ${active ? C.red : C.border}`,
                    }}>
                      {active && (
                        <svg viewBox="0 0 10 10" style={{ width: 8, height: 8 }}>
                          <path d="M2 5L4.5 7.5L8 3" fill="none" stroke={C.hull} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── BESTIARY TAB ── */}
        {hubTab === 'bestiary' && rlSave && (
          <div className="max-w-4xl mx-auto space-y-6">
            {(['asteroids', 'bosses', 'elites'] as const).map(cat => {
              const items = ALL_BESTIARY.filter(e => e.category === cat);
              const catLabelKey = cat === 'asteroids' ? 'asteroids.rl.bestiary.asteroids' : cat === 'bosses' ? 'asteroids.rl.bestiary.bosses' : 'asteroids.rl.bestiary.elites';
              return (
                <div key={cat}>
                  <h2 className="text-xs font-black uppercase tracking-[0.15em] mb-3" style={{ color: C.text }}>
                    {t(catLabelKey)}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {items.map(item => {
                      const entry = rlSave.bestiary[item.key];
                      const seen = entry?.seen ?? false;
                      return (
                        <div key={item.key} className="rounded-lg p-3 transition-all" style={{
                          background: seen ? C.surface : C.hull,
                          border: `1px solid ${seen ? C.border : C.border + '40'}`,
                          opacity: seen ? 1 : 0.35,
                        }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm">{seen ? '◆' : '?'}</span>
                            <span className="text-[11px] font-black" style={{ color: seen ? item.color : C.muted }}>
                              {seen ? item.label : '???'}
                            </span>
                          </div>
                          {seen && entry ? (
                            <div className="text-[9px] space-y-0.5 font-mono" style={{ color: C.muted }}>
                              <div>{t('asteroids.rl.bestiary.encounters')}: <span className="font-bold" style={{ color: C.text }}>{entry.count}</span></div>
                              {entry.firstWave && <div>{t('asteroids.rl.bestiary.firstWave')} <span className="font-bold" style={{ color: C.text }}>{entry.firstWave}</span></div>}
                            </div>
                          ) : (
                            <div className="text-[9px] font-mono" style={{ color: C.border }}>{t('asteroids.rl.bestiary.notSeen')}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── MILESTONES TAB ── */}
        {hubTab === 'milestones' && rlSave && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Progress */}
            <div className="rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: C.muted }}>
                  {t('asteroids.rl.milestones')}
                </span>
                <span className="text-[10px] font-black tabular-nums" style={{ color: C.amber }}>
                  {msStats.done}/{msStats.total} ({msStats.pct}%)
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: C.hull, border: `1px solid ${C.border}` }}>
                <div className="h-full rounded-full transition-all duration-500" style={{
                  width: `${msStats.pct}%`,
                  background: `linear-gradient(90deg, ${C.amberDim}, ${C.amber})`,
                  boxShadow: `0 0 8px ${C.amber}40`,
                }} />
              </div>
            </div>

            {/* Milestone list */}
            <div className="flex flex-col gap-2">
              {MILESTONES.map(ms => {
                const done = rlSave.unlockedMilestones.includes(ms.id);
                return (
                  <div key={ms.id} className="flex items-start gap-3 rounded-lg p-4 transition-all" style={{
                    background: done ? C.amberGlow : C.surface,
                    border: `1px solid ${done ? C.amberBorder : C.border}`,
                  }}>
                    <div className="w-10 h-10 rounded flex items-center justify-center text-lg shrink-0" style={{
                      background: done ? `${C.amber}15` : C.hull,
                      border: `1px solid ${done ? C.amberBorder : C.border}`,
                    }}>
                      {ms.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black" style={{ color: done ? C.amber : C.textBright }}>
                          {t(ms.nameKey)}
                        </h3>
                        {done && (
                          <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style={{
                            background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}30`,
                          }}>
                            {t('asteroids.rl.milestones.unlocked')}
                          </span>
                        )}
                        {!done && (
                          <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style={{
                            background: C.hull, color: C.muted, border: `1px solid ${C.border}`,
                          }}>
                            {t('asteroids.rl.ms.locked')}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] mt-1 leading-relaxed" style={{ color: C.muted }}>{t(ms.descKey)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: C.muted }}>
                          {t('asteroids.rl.ms.reward')}:
                        </span>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{
                          background: C.hull, color: C.text, border: `1px solid ${C.border}`,
                        }}>
                          {getUnlockTypeLabel(ms, t)}
                        </span>
                        <span className="text-[10px] font-black" style={{ color: done ? C.amber : C.text }}>
                          {getUnlockLabel(ms, t)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── DAILY TAB ── */}
        {hubTab === 'daily' && rlSave && (
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Date header */}
            <div className="text-center">
              <div className="text-sm font-black tracking-wider" style={{ color: C.cyan }}>{todayDate}</div>
              <p className="text-[10px] mt-1" style={{ color: C.muted }}>{t('asteroids.rl.daily.desc')}</p>
            </div>

            {/* Modifiers */}
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: C.muted }}>
                {t('asteroids.rl.daily.modifiers')}
              </div>
              <div className="flex flex-col gap-2">
                {dailyMods.map(mod => (
                  <div key={mod.id} className="flex items-start gap-3 rounded-lg p-3" style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${mod.color}`,
                  }}>
                    <div className="w-9 h-9 rounded flex items-center justify-center text-lg shrink-0" style={{
                      background: `${mod.color}18`,
                    }}>
                      {mod.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-black" style={{ color: C.textBright }}>{t(mod.nameKey)}</h3>
                      <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{t(mod.descKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Previous result */}
            {alreadyPlayedDaily && dailyResult && (
              <div className="rounded-lg p-4" style={{
                background: C.amberGlow,
                border: `1px solid ${C.amberBorder}`,
              }}>
                <div className="text-[9px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: C.amber }}>
                  {t('asteroids.rl.daily.yourResult')}
                </div>
                <div className="flex items-center gap-8">
                  <div>
                    <span className="text-[9px] font-bold uppercase" style={{ color: C.muted }}>{t('asteroids.rl.daily.wave')}</span>
                    <div className="text-xl font-black tabular-nums" style={{ color: C.textBright }}>{dailyResult.wave}</div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase" style={{ color: C.muted }}>{t('asteroids.rl.daily.score')}</span>
                    <div className="text-xl font-black tabular-nums" style={{ color: C.textBright }}>{dailyResult.score.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Start daily button */}
            <button onClick={onStartDaily} disabled={alreadyPlayedDaily}
              className="w-full py-3 font-black text-sm uppercase tracking-[0.15em] transition-all cursor-pointer disabled:cursor-not-allowed"
              style={{
                background: alreadyPlayedDaily ? C.hull : `linear-gradient(135deg, ${C.surface}, ${C.panel})`,
                border: `2px solid ${alreadyPlayedDaily ? C.border : C.cyanBorder}`,
                color: alreadyPlayedDaily ? C.muted : C.cyan,
                clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
                opacity: alreadyPlayedDaily ? 0.4 : 1,
              }}
            >
              {alreadyPlayedDaily ? t('asteroids.rl.daily.done') : t('asteroids.rl.daily.start')}
            </button>
          </div>
        )}
      </div>

      {/* ═══ GLOBAL STYLES ═══ */}
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
