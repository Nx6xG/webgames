'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/components/providers/LanguageProvider';
import {
  loadShowcaseConfig,
  saveShowcaseConfig,
  getAvailableStats,
  getPlayedGameIds,
  GAME_EMOJI,
  type ShowcaseConfig,
  type ShowcaseStatChoice,
  type AvailableStat,
} from '@/lib/showcase';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import { loadUnlocked } from '@/lib/achievements/store';

export interface ShowcaseEditorProps {
  onClose: () => void;
  onSaved?: () => void;
}

type Tab = 'game' | 'stats' | 'achievements';

export function ShowcaseEditor({ onClose, onSaved }: ShowcaseEditorProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('game');
  const [config, setConfig] = useState<ShowcaseConfig>({});
  const [saved, setSaved] = useState(false);

  // Load data
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

  function handleSave() {
    saveShowcaseConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  }

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

  if (!mounted) return null;

  const unlockedAchs = ACHIEVEMENTS.filter((a) => unlockedAchIds.has(a.id));
  const selectedStats = config.stats ?? [];
  const selectedAchs = config.achievements ?? [];

  const TABS: { id: Tab; label: string; icon: string; count?: string }[] = [
    { id: 'game', label: t('showcase.favoriteGame'), icon: '🎮' },
    { id: 'stats', label: t('showcase.featuredStats'), icon: '📊', count: `${selectedStats.length}/3` },
    { id: 'achievements', label: t('showcase.featuredAch'), icon: '🏆', count: `${selectedAchs.length}/3` },
  ];

  // Group stats by game for display
  const statsByGame = new Map<string, AvailableStat[]>();
  for (const s of availableStats) {
    const arr = statsByGame.get(s.gameId) ?? [];
    arr.push(s);
    statsByGame.set(s.gameId, arr);
  }

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-[min(95vw,520px)] max-h-[85vh] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-sm:w-full max-sm:mx-2">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-bold text-zinc-100">{t('showcase.edit')}</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">{t('profileViewer.noStatsHint')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                tab === tb.id
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <span className="text-sm">{tb.icon}</span>
              <span className="hidden sm:inline">{tb.label}</span>
              {tb.count && (
                <span className={`text-[10px] px-1.5 py-px rounded-full font-semibold ${
                  tab === tb.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {tb.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 min-h-0">
          {tab === 'game' && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-3">{t('showcase.pickFavorite')}</p>
              {playedGames.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-8">{t('showcase.none')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {playedGames.map((gid) => {
                    const selected = config.favoriteGameId === gid;
                    return (
                      <button
                        key={gid}
                        onClick={() => toggleFavorite(gid)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                          selected
                            ? 'border-indigo-500/60 bg-indigo-950/30 ring-1 ring-indigo-500/20'
                            : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/60'
                        }`}
                      >
                        <span className="text-lg shrink-0">{GAME_EMOJI[gid] ?? '🎮'}</span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-semibold truncate ${selected ? 'text-indigo-300' : 'text-zinc-300'}`}>
                            {t(`game.name.${gid}`)}
                          </p>
                        </div>
                        {selected && (
                          <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'stats' && (
            <div className="space-y-4">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">{t('showcase.pickStats')}</p>
              {availableStats.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-8">{t('showcase.none')}</p>
              ) : (
                [...statsByGame.entries()].map(([gameId, stats]) => (
                  <div key={gameId}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm">{GAME_EMOJI[gameId] ?? '📊'}</span>
                      <span className="text-[11px] font-semibold text-zinc-400">
                        {gameId === 'total' ? t('showcase.total') : t(`game.name.${gameId}`)}
                      </span>
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
                            className={`rounded-lg border px-2 py-2 text-center transition-all ${
                              sel
                                ? 'border-indigo-500/60 bg-indigo-950/30 ring-1 ring-indigo-500/20'
                                : atMax
                                ? 'border-zinc-800 bg-zinc-900/50 opacity-40 cursor-not-allowed'
                                : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/60'
                            }`}
                          >
                            <p className="text-sm font-bold text-zinc-100">{s.value}</p>
                            <p className={`text-[9px] uppercase tracking-wider mt-0.5 ${sel ? 'text-indigo-400' : 'text-zinc-500'}`}>
                              {t(`showcase.stat.${s.statKey}`)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'achievements' && (
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-3">{t('showcase.pickAch')}</p>
              {unlockedAchs.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-8">{t('showcase.none')}</p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5">
                  {unlockedAchs.map((ach) => {
                    const sel = selectedAchs.includes(ach.id);
                    const atMax = selectedAchs.length >= 3 && !sel;
                    return (
                      <button
                        key={ach.id}
                        onClick={() => toggleAchievement(ach.id)}
                        disabled={atMax}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                          sel
                            ? 'border-yellow-500/40 bg-yellow-950/20 ring-1 ring-yellow-500/10'
                            : atMax
                            ? 'border-zinc-800 bg-zinc-900/50 opacity-40 cursor-not-allowed'
                            : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/60'
                        }`}
                      >
                        <span className="text-xl shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-zinc-800/60">
                          {ach.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-semibold truncate ${sel ? 'text-yellow-300' : 'text-zinc-200'}`}>
                            {t(ach.nameKey)}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">{t(ach.descKey)}</p>
                        </div>
                        {sel && (
                          <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-900/80">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className={`px-5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {saved ? t('showcase.saved') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
