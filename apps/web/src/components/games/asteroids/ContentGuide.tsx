'use client';

import { useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import type { ShipId, MilestoneId } from './roguelite-types';
import {
  PERMANENT_UPGRADES,
  TEMP_BUFFS,
  ARTIFACTS,
  SHIPS,
  SHIP_MAP,
  MILESTONES,
  CURSES,
  ASTEROID_VARIANT_CONFIG,
  BOSS_VARIANT_CONFIG,
  ELITE_MODIFIER_CONFIG,
  WAVE_EVENT_CONFIG,
  MEGA_BOSS_CONFIG,
  TEMP_BUFF_MAP,
  ARTIFACT_MAP,
} from './roguelite-data';
import { isShipUnlocked } from './roguelite-state';
import type { RogueliteSave } from './roguelite-types';

interface ContentGuideProps {
  save: RogueliteSave;
  onClose: () => void;
}

type Tab = 'overview' | 'ships' | 'upgrades' | 'buffs' | 'artifacts' | 'curses' | 'enemies' | 'milestones';

const TABS: { id: Tab; icon: string; labelKey: string }[] = [
  { id: 'overview', icon: '📋', labelKey: 'asteroids.rl.content' },
  { id: 'ships', icon: '🚀', labelKey: 'asteroids.rl.content.ships' },
  { id: 'upgrades', icon: '⬆', labelKey: 'asteroids.rl.content.upgrades' },
  { id: 'buffs', icon: '⚡', labelKey: 'asteroids.rl.content.buffs' },
  { id: 'artifacts', icon: '💎', labelKey: 'asteroids.rl.content.artifacts' },
  { id: 'curses', icon: '🔥', labelKey: 'asteroids.rl.content.curses' },
  { id: 'enemies', icon: '👾', labelKey: 'asteroids.rl.content.bosses' },
  { id: 'milestones', icon: '🏆', labelKey: 'asteroids.rl.content.milestones' },
];

const POWERUPS = [
  { id: 'double', icon: '2x', color: '#3b82f6', nameKey: 'asteroids.rl.guide.pu.double', descKey: 'asteroids.rl.guide.pu.double.desc' },
  { id: 'triple', icon: '3x', color: '#22c55e', nameKey: 'asteroids.rl.guide.pu.triple', descKey: 'asteroids.rl.guide.pu.triple.desc' },
  { id: 'rapid', icon: 'RF', color: '#eab308', nameKey: 'asteroids.rl.guide.pu.rapid', descKey: 'asteroids.rl.guide.pu.rapid.desc' },
  { id: 'shield', icon: 'SH', color: '#06b6d4', nameKey: 'asteroids.rl.guide.pu.shield', descKey: 'asteroids.rl.guide.pu.shield.desc' },
  { id: 'bigbullet', icon: 'BG', color: '#f97316', nameKey: 'asteroids.rl.guide.pu.bigbullet', descKey: 'asteroids.rl.guide.pu.bigbullet.desc' },
  { id: 'homing', icon: 'HM', color: '#a855f7', nameKey: 'asteroids.rl.guide.pu.homing', descKey: 'asteroids.rl.guide.pu.homing.desc' },
  { id: 'multishot', icon: 'MS', color: '#ec4899', nameKey: 'asteroids.rl.guide.pu.multishot', descKey: 'asteroids.rl.guide.pu.multishot.desc' },
  { id: 'timeslow', icon: 'TS', color: '#f5f5f5', nameKey: 'asteroids.rl.guide.pu.timeslow', descKey: 'asteroids.rl.guide.pu.timeslow.desc' },
];

function getUnlockLabel(ms: (typeof MILESTONES)[number], t: (k: string) => string): string {
  const u = ms.unlock;
  if (u.type === 'ship') { const s = SHIP_MAP[u.shipId]; return s ? `${s.icon} ${t(s.nameKey)}` : u.shipId; }
  if (u.type === 'buff') { const b = TEMP_BUFF_MAP[u.buffId]; return b ? `${b.icon} ${t(b.nameKey)}` : u.buffId; }
  if (u.type === 'artifact') { const a = ARTIFACT_MAP[u.artifactId]; return a ? `${a.icon} ${t(a.nameKey)}` : u.artifactId; }
  return '';
}

export default function ContentGuide({ save, onClose }: ContentGuideProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]/95 animate-[fadeIn_0.25s_ease-out]" style={{ backdropFilter: 'blur(6px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-2xl font-black tracking-widest text-[var(--fg)] uppercase">{t('asteroids.rl.content')}</h1>
        <button onClick={onClose} className="flex items-center justify-center w-10 h-10 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)] transition-colors text-xl font-bold cursor-pointer">X</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 py-3 overflow-x-auto border-b border-[var(--border)]">
        {TABS.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${tab === tb.id ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/40' : 'text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-700'}`}>
            <span>{tb.icon}</span> {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <Section title={t('asteroids.rl.guide.howItWorks')} desc={t('asteroids.rl.guide.howItWorks.desc')} />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: t('asteroids.rl.content.ships'), value: `${SHIPS.filter(s => isShipUnlocked(save, s.id)).length}/${SHIPS.length}`, color: '#a78bfa', tab: 'ships' as Tab },
                  { label: t('asteroids.rl.content.upgrades'), value: `${PERMANENT_UPGRADES.length} (${PERMANENT_UPGRADES.reduce((s, u) => s + u.maxTier, 0)} Tiers)`, color: '#fbbf24', tab: 'upgrades' as Tab },
                  { label: t('asteroids.rl.content.buffs'), value: String(TEMP_BUFFS.length), color: '#60a5fa', tab: 'buffs' as Tab },
                  { label: t('asteroids.rl.content.artifacts'), value: String(ARTIFACTS.length), color: '#c084fc', tab: 'artifacts' as Tab },
                  { label: t('asteroids.rl.content.curses'), value: String(CURSES.length), color: '#f87171', tab: 'curses' as Tab },
                  { label: t('asteroids.rl.content.milestones'), value: `${save.unlockedMilestones.length}/${MILESTONES.length}`, color: '#f59e0b', tab: 'milestones' as Tab },
                ].map((item) => (
                  <button key={item.label} onClick={() => setTab(item.tab)} className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4 text-left cursor-pointer hover:border-zinc-600 transition-colors">
                    <div className="text-lg font-black tabular-nums" style={{ color: item.color }}>{item.value}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{item.label}</div>
                  </button>
                ))}
              </div>
              <Section title={t('asteroids.rl.guide.powerups')} desc={t('asteroids.rl.guide.powerups.desc')} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {POWERUPS.map((pu) => (
                  <div key={pu.id} className="flex items-center gap-3 rounded-lg bg-[var(--card)] border border-[var(--border)] p-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-md text-xs font-black" style={{ backgroundColor: pu.color + '22', color: pu.color, border: `1px solid ${pu.color}44` }}>{pu.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[var(--fg)]">{t(pu.nameKey)}</div>
                      <div className="text-xs text-[var(--muted)]">{t(pu.descKey)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Section title={t('asteroids.rl.guide.waveEvents')} desc={t('asteroids.rl.guide.waveEvents.desc')} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.keys(WAVE_EVENT_CONFIG) as Array<keyof typeof WAVE_EVENT_CONFIG>).map((key) => {
                  const cfg = WAVE_EVENT_CONFIG[key];
                  return (
                    <div key={key} className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-3">
                      <div className="text-sm font-bold text-amber-300">{t(cfg.nameKey)}</div>
                      <div className="text-xs text-[var(--muted)] mt-1">{t(cfg.descKey)}</div>
                      <div className="text-[10px] text-zinc-500 mt-1">{Math.round(cfg.duration / 1000)}s</div>
                    </div>
                  );
                })}
              </div>
              <Section title={t('asteroids.rl.content.ascension')} desc={t('asteroids.rl.guide.ascension.desc')} />
              <Section title={t('asteroids.rl.content.megaboss')} desc={t('asteroids.rl.guide.megaboss.desc')} />
            </div>
          )}

          {/* ── Ships ── */}
          {tab === 'ships' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SHIPS.map((ship) => {
                const unlocked = isShipUnlocked(save, ship.id);
                const ms = MILESTONES.find((m) => m.unlock.type === 'ship' && m.unlock.shipId === ship.id);
                return (
                  <div key={ship.id} className={`rounded-xl border p-5 ${unlocked ? 'border-[var(--border)] bg-[var(--card)]' : 'border-zinc-800 bg-zinc-900/50 opacity-60'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg text-2xl" style={{ backgroundColor: (unlocked ? ship.color : '#71717a') + '22', color: unlocked ? ship.color : '#71717a' }}>{ship.icon}</div>
                      <div>
                        <h3 className="text-lg font-bold text-[var(--fg)]">{t(ship.nameKey)}</h3>
                        {unlocked ? <span className="text-xs font-semibold text-emerald-400">{t('asteroids.rl.ship.unlocked')}</span> : <span className="text-xs font-semibold text-red-400">{t('asteroids.rl.ship.locked')}</span>}
                      </div>
                    </div>
                    <p className="text-sm text-[var(--muted)]">{t(ship.descKey)}</p>
                    <div className="text-xs font-semibold mt-2" style={{ color: unlocked ? ship.color : '#71717a' }}>{t('asteroids.rl.ship.passive')}: {t(ship.passiveKey)}</div>
                    <div className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-500 space-y-1">
                      {ship.hpMod !== 0 && <span className="inline-block mr-3">HP {ship.hpMod > 0 ? '+' : ''}{ship.hpMod}</span>}
                      {ship.accelMod !== 1 && <span className="inline-block mr-3">Accel x{ship.accelMod}</span>}
                      {ship.fireRateMod !== 1 && <span className="inline-block mr-3">Fire x{ship.fireRateMod}</span>}
                      {ship.bulletDamageMod !== 1 && <span className="inline-block mr-3">Dmg x{ship.bulletDamageMod}</span>}
                      {ship.scrapMultMod !== 1 && <span className="inline-block mr-3">Scrap x{ship.scrapMultMod}</span>}
                      {ship.scrapRadiusMod !== 1 && <span className="inline-block mr-3">Magnet x{ship.scrapRadiusMod}</span>}
                      {ship.shieldRechargeMod !== 1 && <span className="inline-block mr-3">Shield x{ship.shieldRechargeMod}</span>}
                      {ship.phaseChance > 0 && <span className="inline-block mr-3">Phase {Math.round(ship.phaseChance * 100)}%</span>}
                    </div>
                    {!unlocked && ms && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                        <span>{ms.icon}</span>
                        <span className="font-semibold">{t(ms.nameKey)}</span>
                        <span className="text-zinc-600">— {t(ms.descKey)}</span>
                      </div>
                    )}
                    {ship.id === 'vanguard' && <div className="mt-2 text-xs text-zinc-500">{t('asteroids.rl.ship.default')}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Upgrades ── */}
          {tab === 'upgrades' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PERMANENT_UPGRADES.map((upg) => {
                const tier = save.upgrades[upg.id] ?? 0;
                return (
                  <div key={upg.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg text-lg ${tier >= upg.maxTier ? 'bg-yellow-500/15 text-yellow-400' : 'bg-zinc-700/60 text-zinc-300'}`}>{upg.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[var(--fg)]">{t(upg.nameKey)}</h3>
                          <span className="text-xs font-bold tabular-nums text-zinc-500">{tier}/{upg.maxTier}</span>
                        </div>
                        <div className="flex gap-1 mt-1">{Array.from({ length: upg.maxTier }, (_, i) => <div key={i} className={`w-2.5 h-2.5 rounded-full border ${i < tier ? 'bg-yellow-400 border-yellow-500' : 'bg-transparent border-zinc-600'}`} />)}</div>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-2">{t(upg.descKey)}</p>
                    <div className="text-[10px] text-zinc-600 mt-1">{t('asteroids.rl.guide.costs')}: {upg.costs.map((c, i) => <span key={i} className={i < tier ? 'text-zinc-600 line-through' : 'text-zinc-400'}>{i > 0 ? ' → ' : ''}{c}</span>)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Buffs ── */}
          {tab === 'buffs' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--muted)]">{t('asteroids.rl.guide.buffs.intro')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TEMP_BUFFS.map((buff) => (
                  <div key={buff.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4" style={{ borderTopWidth: '3px', borderTopColor: buff.color }}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg text-lg" style={{ backgroundColor: buff.color + '22', color: buff.color }}>{buff.icon}</div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-[var(--fg)]">{t(buff.nameKey)}</h3>
                        <span className="text-xs font-semibold" style={{ color: buff.color }}>{buff.duration === -1 ? t('asteroids.rl.instant') : buff.duration === 0 ? t('asteroids.rl.permanent') : `${buff.duration} ${t('asteroids.rl.waves')}`}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-2">{t(buff.descKey)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Artifacts ── */}
          {tab === 'artifacts' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--muted)]">{t('asteroids.rl.guide.artifacts.intro')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ARTIFACTS.map((art) => (
                  <div key={art.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg text-lg" style={{ backgroundColor: art.color + '22', color: art.color }}>{art.icon}</div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-[var(--fg)]">{t(art.nameKey)}</h3>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-2">{t(art.descKey)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Curses ── */}
          {tab === 'curses' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--muted)]">{t('asteroids.rl.guide.curses.intro')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CURSES.map((curse) => (
                  <div key={curse.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg text-lg" style={{ backgroundColor: curse.color + '22', color: curse.color }}>{curse.icon}</div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-[var(--fg)]">{t(curse.nameKey)}</h3>
                        <span className="text-xs font-bold text-red-400">x{curse.scrapMultiplier.toFixed(1)} Scrap</span>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-2">{t(curse.descKey)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Enemies ── */}
          {tab === 'enemies' && (
            <div className="space-y-6">
              <Section title={t('asteroids.rl.bestiary.asteroids')} desc={t('asteroids.rl.guide.asteroids.desc')} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.entries(ASTEROID_VARIANT_CONFIG) as Array<[string, typeof ASTEROID_VARIANT_CONFIG.normal]>).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cfg.color }} />
                    <div className="flex-1">
                      <span className="text-sm font-bold text-[var(--fg)] capitalize">{key}</span>
                      <div className="text-[10px] text-zinc-500">HP x{cfg.hpMultiplier} · Scrap x{cfg.scrapMultiplier}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Section title={t('asteroids.rl.bestiary.elites')} desc={t('asteroids.rl.guide.elites.desc')} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.entries(ELITE_MODIFIER_CONFIG) as Array<[string, typeof ELITE_MODIFIER_CONFIG.fast]>).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cfg.color }} />
                    <div className="flex-1">
                      <span className="text-sm font-bold capitalize" style={{ color: cfg.color }}>{key}</span>
                      <div className="text-[10px] text-zinc-500">Scrap x{cfg.scrapMultiplier}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Section title={t('asteroids.rl.bestiary.bosses')} desc={t('asteroids.rl.guide.bosses.desc')} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.entries(BOSS_VARIANT_CONFIG) as Array<[string, typeof BOSS_VARIANT_CONFIG.standard]>).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                    <span className="text-lg">👾</span>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-[var(--fg)] capitalize">{key}</span>
                      <div className="text-[10px] text-zinc-500">HP {cfg.hp} · Speed {cfg.speed}{cfg.shieldHp ? ` · Shield ${cfg.shieldHp}` : ''}{cfg.spawnInterval ? ' · Spawns minions' : ''}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Section title={t('asteroids.rl.content.megaboss')} desc={t('asteroids.rl.guide.megaboss.desc')} />
              <div className="grid grid-cols-3 gap-2">
                {(['shield', 'swarm', 'core'] as const).map((phase) => {
                  const cfg = MEGA_BOSS_CONFIG.phases[phase];
                  const colors: Record<string, string> = { shield: '#38bdf8', swarm: '#ef4444', core: '#f59e0b' };
                  return (
                    <div key={phase} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center">
                      <div className="text-sm font-bold capitalize" style={{ color: colors[phase] }}>{t(`asteroids.rl.megaboss.phase.${phase}`)}</div>
                      <div className="text-xs text-zinc-500 mt-1">HP {cfg.hp}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Milestones ── */}
          {tab === 'milestones' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-bold text-amber-400 tabular-nums">{save.unlockedMilestones.length}/{MILESTONES.length}</span>
                <div className="flex-1 h-2 rounded-full bg-zinc-800 border border-zinc-700/50 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all" style={{ width: `${MILESTONES.length > 0 ? Math.round((save.unlockedMilestones.length / MILESTONES.length) * 100) : 0}%` }} />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {MILESTONES.map((ms) => {
                  const done = save.unlockedMilestones.includes(ms.id);
                  return (
                    <div key={ms.id} className={`flex items-start gap-4 rounded-xl border p-4 ${done ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--border)] bg-[var(--card)]'}`}>
                      <span className="text-2xl">{ms.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-sm font-bold ${done ? 'text-amber-300' : 'text-[var(--fg)]'}`}>{t(ms.nameKey)}</h3>
                          {done && <span className="text-[10px] font-semibold text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">{t('asteroids.rl.milestones.unlocked')}</span>}
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-0.5">{t(ms.descKey)}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <span className="text-zinc-500 font-semibold">{t('asteroids.rl.ms.reward')}:</span>
                          <span className={`font-bold ${done ? 'text-amber-300' : 'text-zinc-300'}`}>{getUnlockLabel(ms, t)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}

function Section({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--fg)]">{title}</h2>
      <p className="text-sm text-[var(--muted)] mt-1">{desc}</p>
    </div>
  );
}
