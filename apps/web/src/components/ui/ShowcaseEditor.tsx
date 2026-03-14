'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/components/providers/LanguageProvider';
import {
  loadShowcaseConfig,
  saveShowcaseConfig,
  getAvailableStats,
  getPlayedGameIds,
  GAME_EMOJI,
  type ShowcaseConfig,
  type AvailableStat,
} from '@/lib/showcase';
import { ACHIEVEMENTS, type AchievementDefinition } from '@/lib/achievements/definitions';
import { loadUnlocked } from '@/lib/achievements/store';
import { getAchievementById } from '@/lib/achievements';

export interface ShowcaseEditorProps {
  onClose: () => void;
  onSaved?: () => void;
}

type Section = 'game' | 'stats' | 'achievements';

// ── Slot indicator dots ──────────────────────────────────────────────────────

function SlotDots({ filled, max }: { filled: number; max: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            i < filled
              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
              : 'bg-zinc-700'
          }`}
        />
      ))}
    </div>
  );
}

// ── Corner bracket decoration ────────────────────────────────────────────────

function CornerBrackets({ children, active }: { children: React.ReactNode; active?: boolean }) {
  const color = active ? 'border-emerald-500/40' : 'border-zinc-700/30';
  return (
    <div className="relative">
      {/* TL */}
      <span className={`absolute -top-px -left-px w-2.5 h-2.5 border-t border-l ${color} rounded-tl transition-colors duration-300`} />
      {/* TR */}
      <span className={`absolute -top-px -right-px w-2.5 h-2.5 border-t border-r ${color} rounded-tr transition-colors duration-300`} />
      {/* BL */}
      <span className={`absolute -bottom-px -left-px w-2.5 h-2.5 border-b border-l ${color} rounded-bl transition-colors duration-300`} />
      {/* BR */}
      <span className={`absolute -bottom-px -right-px w-2.5 h-2.5 border-b border-r ${color} rounded-br transition-colors duration-300`} />
      {children}
    </div>
  );
}

// ── Live preview mini-card ───────────────────────────────────────────────────

function LivePreview({
  config,
  availableStats,
  t,
}: {
  config: ShowcaseConfig;
  availableStats: AvailableStat[];
  t: (k: string) => string;
}) {
  const favGame = config.favoriteGameId;
  const stats = config.stats ?? [];
  const achs = config.achievements ?? [];
  const isEmpty = !favGame && stats.length === 0 && achs.length === 0;

  return (
    <div className="relative">
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-lg opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 4px)',
        }}
      />

      <CornerBrackets active={!isEmpty}>
        <div className="rounded-lg bg-zinc-900/80 border border-zinc-800/50 p-3 min-h-[80px]">
          {isEmpty ? (
            <div className="flex items-center justify-center h-[68px] text-zinc-600 text-[11px] italic">
              {t('showcase.none')}
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Favorite game */}
              {favGame && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">{GAME_EMOJI[favGame] ?? '🎮'}</span>
                  <span className="text-[10px] text-zinc-500">{t('showcase.favoriteGame')}</span>
                  <span className="text-[11px] font-semibold text-zinc-200">{t(`game.name.${favGame}`)}</span>
                </div>
              )}

              {/* Stats */}
              {stats.length > 0 && (
                <div className={`grid gap-1.5 ${stats.length === 1 ? 'grid-cols-1' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {stats.map((sc, i) => {
                    const found = availableStats.find((a) => a.gameId === sc.gameId && a.statKey === sc.statKey);
                    const gameName = sc.gameId === 'total' ? t('showcase.total') : t(`game.name.${sc.gameId}`);
                    return (
                      <div key={i} className="rounded-md bg-zinc-800/50 border border-zinc-700/20 px-2 py-1.5 text-center">
                        <p className="text-[10px] font-bold text-zinc-100">{found?.value ?? '—'}</p>
                        <p className="text-[8px] text-zinc-500 uppercase tracking-wider truncate">
                          {gameName} {t(`showcase.stat.${sc.statKey}`)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Achievements */}
              {achs.length > 0 && (
                <div className="flex gap-1.5">
                  {achs.map((id) => {
                    const def = getAchievementById(id);
                    if (!def) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/40 border border-zinc-700/20"
                        title={t(def.nameKey)}
                      >
                        <span className="text-[11px]">{def.icon}</span>
                        <span className="text-[9px] font-medium text-zinc-400 truncate max-w-[60px]">{t(def.nameKey)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </CornerBrackets>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  slotsFilled,
  slotsMax,
  expanded,
  onToggle,
}: {
  icon: string;
  label: string;
  slotsFilled?: number;
  slotsMax?: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 border border-zinc-800/40 transition-colors group"
    >
      <span className="text-sm">{icon}</span>
      <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex-1 text-left">{label}</span>
      {slotsMax !== undefined && slotsFilled !== undefined && (
        <SlotDots filled={slotsFilled} max={slotsMax} />
      )}
      <svg
        className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ShowcaseEditor({ onClose, onSaved }: ShowcaseEditorProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<ShowcaseConfig>({});
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState<Section>('game');
  const backdropRef = useRef<HTMLDivElement>(null);

  // Data
  const [playedGames, setPlayedGames] = useState<string[]>([]);
  const [availableStats, setAvailableStats] = useState<AvailableStat[]>([]);
  const [unlockedAchIds, setUnlockedAchIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    setConfig(loadShowcaseConfig());
    setPlayedGames(getPlayedGameIds());
    setAvailableStats(getAvailableStats());
    setUnlockedAchIds(loadUnlocked());
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const handleSave = useCallback(() => {
    saveShowcaseConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  }, [config, onSaved]);

  function toggleFavorite(gid: string) {
    setConfig((c) => ({ ...c, favoriteGameId: c.favoriteGameId === gid ? undefined : gid }));
  }

  function toggleStat(gameId: string, statKey: string) {
    setConfig((c) => {
      const current = c.stats ?? [];
      const exists = current.some((s) => s.gameId === gameId && s.statKey === statKey);
      if (exists) return { ...c, stats: current.filter((s) => !(s.gameId === gameId && s.statKey === statKey)) };
      if (current.length >= 3) return c;
      return { ...c, stats: [...current, { gameId, statKey }] };
    });
  }

  function toggleAchievement(id: string) {
    setConfig((c) => {
      const current = c.achievements ?? [];
      if (current.includes(id)) return { ...c, achievements: current.filter((a) => a !== id) };
      if (current.length >= 3) return c;
      return { ...c, achievements: [...current, id] };
    });
  }

  function isStatSelected(gameId: string, statKey: string) {
    return (config.stats ?? []).some((s) => s.gameId === gameId && s.statKey === statKey);
  }

  const toggleSection = useCallback((s: Section) => {
    setExpanded((prev) => prev === s ? s : s);
  }, []);

  const unlockedAchs = useMemo(() => ACHIEVEMENTS.filter((a) => unlockedAchIds.has(a.id)), [unlockedAchIds]);
  const selectedStats = config.stats ?? [];
  const selectedAchs = config.achievements ?? [];

  // Group stats by game
  const statsByGame = useMemo(() => {
    const map = new Map<string, AvailableStat[]>();
    for (const s of availableStats) {
      const arr = map.get(s.gameId) ?? [];
      arr.push(s);
      map.set(s.gameId, arr);
    }
    return map;
  }, [availableStats]);

  if (!mounted) return null;

  const modal = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('showcase.edit')}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Panel */}
      <div
        className="relative w-[min(95vw,540px)] max-h-[88vh] rounded-xl overflow-hidden flex flex-col max-sm:w-full max-sm:mx-2"
        style={{
          background: 'linear-gradient(180deg, #111318 0%, #0c0d10 100%)',
          boxShadow: '0 0 0 1px rgba(63,63,70,0.4), 0 0 40px rgba(0,0,0,0.5), 0 0 80px rgba(79,70,229,0.06)',
        }}
      >
        {/* Top accent line */}
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5) 30%, rgba(52,211,153,0.5) 70%, transparent)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600/20 to-emerald-600/20 border border-indigo-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 tracking-wide">{t('showcase.edit')}</h2>
              <p className="text-[10px] text-zinc-500 mt-0.5 tracking-wide uppercase">{t('profileViewer.noStatsHint')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Thin divider */}
        <div className="h-px mx-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(63,63,70,0.5), transparent)' }} />

        {/* Live preview */}
        <div className="px-5 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[9px] text-zinc-600 uppercase tracking-[0.15em] font-semibold">Live Preview</span>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
          </div>
          <LivePreview config={config} availableStats={availableStats} t={t} />
        </div>

        {/* Thin divider */}
        <div className="h-px mx-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(63,63,70,0.5), transparent)' }} />

        {/* Sections */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 min-h-0 space-y-2 scrollbar-thin">

          {/* ── Favorite Game ──────────────────────────────────────── */}
          <SectionHeader
            icon="🎮"
            label={t('showcase.favoriteGame')}
            expanded={expanded === 'game'}
            onToggle={() => toggleSection('game')}
          />
          {expanded === 'game' && (
            <div className="pl-1 pr-1 pb-1 space-y-1.5">
              {playedGames.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-6">{t('showcase.none')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {playedGames.map((gid) => {
                    const selected = config.favoriteGameId === gid;
                    return (
                      <button
                        key={gid}
                        onClick={() => toggleFavorite(gid)}
                        className={`group/item relative flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all duration-200 ${
                          selected
                            ? 'border-emerald-500/40 bg-emerald-950/20'
                            : 'border-zinc-800/50 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/40'
                        }`}
                        style={selected ? { boxShadow: '0 0 12px -3px rgba(52,211,153,0.15)' } : undefined}
                      >
                        <span className="text-base shrink-0">{GAME_EMOJI[gid] ?? '🎮'}</span>
                        <span className={`text-[11px] font-semibold truncate ${selected ? 'text-emerald-300' : 'text-zinc-400 group-hover/item:text-zinc-300'}`}>
                          {t(`game.name.${gid}`)}
                        </span>
                        {selected && (
                          <span className="ml-auto shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Stats ─────────────────────────────────────────────── */}
          <SectionHeader
            icon="📊"
            label={t('showcase.featuredStats')}
            slotsFilled={selectedStats.length}
            slotsMax={3}
            expanded={expanded === 'stats'}
            onToggle={() => toggleSection('stats')}
          />
          {expanded === 'stats' && (
            <div className="pl-1 pr-1 pb-1 space-y-3">
              {availableStats.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-6">{t('showcase.none')}</p>
              ) : (
                [...statsByGame.entries()].map(([gameId, stats]) => (
                  <div key={gameId}>
                    <div className="flex items-center gap-1.5 mb-1.5 px-1">
                      <span className="text-xs">{GAME_EMOJI[gameId] ?? '📊'}</span>
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                        {gameId === 'total' ? t('showcase.total') : t(`game.name.${gameId}`)}
                      </span>
                      <div className="flex-1 h-px bg-zinc-800/50" />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {stats.map((s) => {
                        const sel = isStatSelected(s.gameId, s.statKey);
                        const atMax = selectedStats.length >= 3 && !sel;
                        return (
                          <button
                            key={`${s.gameId}-${s.statKey}`}
                            onClick={() => toggleStat(s.gameId, s.statKey)}
                            disabled={atMax}
                            className={`relative rounded-lg border px-2 py-2 text-center transition-all duration-200 ${
                              sel
                                ? 'border-indigo-500/40 bg-indigo-950/25'
                                : atMax
                                ? 'border-zinc-800/30 bg-zinc-900/30 opacity-30 cursor-not-allowed'
                                : 'border-zinc-800/50 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/40'
                            }`}
                            style={sel ? { boxShadow: '0 0 12px -3px rgba(99,102,241,0.2)' } : undefined}
                          >
                            <p className={`text-sm font-bold ${sel ? 'text-indigo-200' : 'text-zinc-200'}`}>{s.value}</p>
                            <p className={`text-[8px] uppercase tracking-wider mt-0.5 font-medium ${sel ? 'text-indigo-400' : 'text-zinc-600'}`}>
                              {t(`showcase.stat.${s.statKey}`)}
                            </p>
                            {sel && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-500 flex items-center justify-center">
                                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Achievements ──────────────────────────────────────── */}
          <SectionHeader
            icon="🏆"
            label={t('showcase.featuredAch')}
            slotsFilled={selectedAchs.length}
            slotsMax={3}
            expanded={expanded === 'achievements'}
            onToggle={() => toggleSection('achievements')}
          />
          {expanded === 'achievements' && (
            <div className="pl-1 pr-1 pb-1 space-y-1">
              {unlockedAchs.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-6">{t('showcase.none')}</p>
              ) : (
                unlockedAchs.map((ach) => {
                  const sel = selectedAchs.includes(ach.id);
                  const atMax = selectedAchs.length >= 3 && !sel;
                  return (
                    <button
                      key={ach.id}
                      onClick={() => toggleAchievement(ach.id)}
                      disabled={atMax}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all duration-200 ${
                        sel
                          ? 'border-amber-500/30 bg-amber-950/15'
                          : atMax
                          ? 'border-zinc-800/30 bg-zinc-900/30 opacity-30 cursor-not-allowed'
                          : 'border-zinc-800/50 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/40'
                      }`}
                      style={sel ? { boxShadow: '0 0 12px -3px rgba(245,158,11,0.12)' } : undefined}
                    >
                      <span
                        className={`text-lg shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                          sel ? 'bg-amber-900/30' : 'bg-zinc-800/40'
                        }`}
                      >
                        {ach.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[11px] font-semibold truncate ${sel ? 'text-amber-200' : 'text-zinc-300'}`}>
                          {t(ach.nameKey)}
                        </p>
                        <p className="text-[9px] text-zinc-600 truncate">{t(ach.descKey)}</p>
                      </div>
                      {sel && (
                        <span className="shrink-0 w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-px mx-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(63,63,70,0.5), transparent)' }} />
        <div className="flex items-center justify-between px-5 py-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-zinc-800 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="relative px-5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-300 overflow-hidden"
            style={{
              background: saved
                ? 'linear-gradient(135deg, #059669, #10b981)'
                : 'linear-gradient(135deg, #4338ca, #6366f1)',
              boxShadow: saved
                ? '0 0 20px -4px rgba(16,185,129,0.4)'
                : '0 0 20px -4px rgba(99,102,241,0.3)',
              color: 'white',
            }}
          >
            {saved ? t('showcase.saved') : t('common.save')}
          </button>
        </div>

        {/* Bottom accent line */}
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.3) 30%, rgba(52,211,153,0.3) 70%, transparent)' }} />
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
