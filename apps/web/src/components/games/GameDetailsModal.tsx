'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/providers/LanguageProvider';
import { usePartyCtx } from '@/components/providers/PartyProvider';
import { ACHIEVEMENTS, TIER_XP, TIER_TOKENS } from '@/lib/achievements/definitions';
import type { AchievementDefinition } from '@/lib/achievements/definitions';
import { loadStats } from '@/lib/achievements/store';

import { useOpenRooms } from '@/hooks/useOpenRooms';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GameModalData {
  gameId: string;
  emoji: string;
  titleKey: string;
  descKey: string;
  tags: readonly string[];
  controlsKey: string;
  /** multiplayer = quick play + custom; singleplayer = single play button */
  mode: 'multiplayer' | 'singleplayer';
  /** Route for primary play action (singleplayer) or quick play (multiplayer) */
  playHref: string;
  /** Route for custom room (multiplayer only) */
  customHref?: string;
  // stats
  plays: number;
  wins: number;
  winRate: number;
  bestScore: number | null;
  bestTime: number | null;
  bestTile: number | null;
  bestLines: number | null;
  isFavorite: boolean;
}

// ── Tag styling (duplicated from page.tsx to avoid coupling) ─────────────────

const TAG_KEYS: Record<string, string> = {
  classic: 'lobby.tags.classic',
  strategy: 'lobby.tags.strategy',
  '2 players': 'lobby.tags.twoPlayers',
  multiplayer: 'lobby.tags.multiplayer',
  singleplayer: 'lobby.tags.singleplayer',
  puzzle: 'lobby.tags.puzzle',
  casual: 'lobby.tags.casual',
  arcade: 'lobby.tags.arcade',
  cards: 'lobby.tags.cards',
  bluff: 'lobby.tags.bluff',
};

const TAG_COLORS: Record<string, string> = {
  classic: 'bg-amber-900/40 text-amber-300 border-amber-800',
  strategy: 'bg-indigo-900/40 text-indigo-300 border-indigo-800',
  '2 players': 'bg-rose-900/40 text-rose-300 border-rose-800',
  multiplayer: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  singleplayer: 'bg-violet-900/40 text-violet-300 border-violet-800',
  puzzle: 'bg-sky-900/40 text-sky-300 border-sky-800',
  casual: 'bg-teal-900/40 text-teal-300 border-teal-800',
  arcade: 'bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-800',
  cards: 'bg-orange-900/40 text-orange-300 border-orange-800',
  bluff: 'bg-pink-900/40 text-pink-300 border-pink-800',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GameDetailsModal({
  data,
  unlocked,
  onClose,
}: {
  data: GameModalData;
  unlocked: Set<string>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { isHost, launchGame } = usePartyCtx();
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC to close + lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Achievements for this game
  const achStats = loadStats();
  const gameAchs = ACHIEVEMENTS.filter(
    (a) => a.tags?.[0] === data.gameId,
  );
  const achUnlocked = gameAchs.filter((a) => unlocked.has(a.id)).length;
  const achTotal = gameAchs.length;

  const hasStats = data.plays > 0 || data.bestScore !== null || data.bestTime !== null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-700/60 bg-zinc-900 shadow-2xl outline-none animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          aria-label={t('common.close')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 space-y-6">
          {/* ── A) Header ───────────────────────────────────────────── */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl border bg-indigo-950 border-indigo-900 flex items-center justify-center text-3xl shrink-0 select-none">
              {data.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black">{t(data.titleKey)}</h2>
                {data.isFavorite && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                    ⭐ {t('cards.favorite')}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-1">{t(data.descKey)}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {data.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs px-2 py-0.5 rounded-full border ${TAG_COLORS[tag] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                  >
                    {t(TAG_KEYS[tag] ?? tag)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Controls ─────────────────────────────────────────── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/30 px-4 py-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">
              {t('modal.controls')}
            </p>
            <p className="text-sm text-zinc-300">{t(data.controlsKey)}</p>
          </div>

          {/* ── B) Actions ───────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex gap-3">
              {data.mode === 'multiplayer' ? (
                <>
                  {isHost ? (
                    <button
                      onClick={() => { launchGame(data.gameId as import('shared').GameId); onClose(); }}
                      className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold text-center transition-colors"
                    >
                      {t('party.launchGame')}
                    </button>
                  ) : (
                    <Link
                      href={data.playHref}
                      className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold text-center transition-colors"
                      onClick={onClose}
                    >
                      {t('modal.quickPlay')}
                    </Link>
                  )}
                  <Link
                    href={data.customHref!}
                    className="px-5 py-2.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
                    onClick={onClose}
                  >
                    {t('modal.custom')}
                  </Link>
                </>
              ) : (
                <Link
                  href={data.playHref}
                  className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold text-center transition-colors"
                  onClick={onClose}
                >
                  {t('modal.play')}
                </Link>
              )}
            </div>
            {isHost && data.mode === 'multiplayer' && (
              <p className="text-[11px] text-indigo-400/70 text-center">{t('party.launchHint')}</p>
            )}
          </div>

          {/* ── Active Rooms (multiplayer only) ────────────────────── */}
          {data.mode === 'multiplayer' && (
            <ActiveRoomsSection gameId={data.gameId} onClose={onClose} customHref={data.customHref!} />
          )}

          {/* ── C) Your Progress ─────────────────────────────────── */}
          <section>
            <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">
              {t('modal.yourProgress')}
            </h3>
            {!hasStats ? (
              <p className="text-sm text-zinc-600 italic">{t('modal.noStats')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {data.plays > 0 && (
                  <StatTile label={t('cards.played')} value={data.plays} />
                )}
                {data.wins > 0 && (
                  <StatTile label={t('cards.wins')} value={data.wins} />
                )}
                {data.plays > 0 && (
                  <StatTile label={t('cards.winrate')} value={`${data.winRate}%`} />
                )}
                {data.bestScore !== null && (
                  <StatTile label={t('cards.bestScore')} value={data.bestScore.toLocaleString()} />
                )}
                {data.bestTile !== null && (
                  <StatTile label={t('cards.bestTile')} value={data.bestTile} />
                )}
                {data.bestLines !== null && (
                  <StatTile label={t('cards.bestLines')} value={data.bestLines} />
                )}
                {data.bestTime !== null && (
                  <StatTile label={t('cards.bestTime')} value={formatTime(data.bestTime)} />
                )}
              </div>
            )}
          </section>

          {/* ── D) Achievements preview ──────────────────────────── */}
          {achTotal > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  {t('modal.achievements')}
                </h3>
                <span className={`text-xs font-bold tabular-nums ${achUnlocked > 0 ? 'text-yellow-400' : 'text-zinc-600'}`}>
                  {achUnlocked}/{achTotal}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {gameAchs.slice(0, 4).map((ach) => (
                  <AchievementRow
                    key={ach.id}
                    def={ach}
                    isUnlocked={unlocked.has(ach.id)}
                    stats={achStats}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── E) Footer links ──────────────────────────────────── */}
          <div className="flex items-center gap-4 pt-2 border-t border-zinc-800">
            {achTotal > 0 && (
              <Link
                href="/achievements"
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                onClick={onClose}
              >
                {t('modal.toAchievements')} →
              </Link>
            )}
            <Link
              href="/leaderboards"
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              onClick={onClose}
            >
              {t('modal.toStats')} →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ActiveRoomsSection({
  gameId,
  onClose,
  customHref,
}: {
  gameId: string;
  onClose: () => void;
  customHref: string;
}) {
  const { t } = useI18n();
  const { rooms, connected } = useOpenRooms('');

  const filtered = useMemo(
    () => rooms.filter((r) => r.gameId === gameId).slice(0, 5),
    [rooms, gameId],
  );

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
          {t('modal.activeRooms')}
        </h3>
        {connected && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 px-4 py-4 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-zinc-600 italic">{t('modal.noRooms')}</p>
          <Link
            href={customHref}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            onClick={onClose}
          >
            {t('modal.createRoom')}
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
          {filtered.map((room) => {
            const isFull = room.playerCount >= room.maxPlayers;
            const isEmpty = room.playerCount === 0;

            return (
              <div key={room.code} className="flex items-center gap-3 px-4 py-2.5 bg-zinc-800/20 hover:bg-zinc-800/40 transition-colors">
                <span className="text-xs font-mono text-zinc-500 shrink-0">{room.code}</span>
                <span className="text-xs text-zinc-400 truncate flex-1">
                  {room.hostNickname}
                </span>
                <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                  {room.playerCount}/{room.maxPlayers}
                </span>
                {isFull ? (
                  <span className="text-[10px] px-2 py-1 rounded-md bg-zinc-700/60 text-zinc-500 font-medium shrink-0">
                    {t('modal.full')}
                  </span>
                ) : isEmpty ? (
                  <span className="text-[10px] px-2 py-1 rounded-md bg-zinc-700/60 text-zinc-600 font-medium shrink-0">
                    —
                  </span>
                ) : (
                  <Link
                    href={`/games/${gameId}?room=${room.code}`}
                    className="text-[10px] px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shrink-0"
                    onClick={onClose}
                  >
                    {t('modal.join')}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link
        href={`/rooms?game=${gameId}`}
        className="mt-2 inline-block text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        onClick={onClose}
      >
        {t('modal.allRooms')} →
      </Link>
    </section>
  );
}

function AchievementRow({
  def,
  isUnlocked,
  stats,
  t,
}: {
  def: AchievementDefinition;
  isUnlocked: boolean;
  stats: ReturnType<typeof loadStats>;
  t: (k: string) => string;
}) {
  const progress = !isUnlocked && def.getProgress ? def.getProgress(stats) : null;
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        isUnlocked
          ? 'border-yellow-500/30 bg-yellow-500/5'
          : 'border-zinc-800 bg-zinc-800/20 opacity-60'
      }`}
    >
      <span className="text-xl shrink-0">{def.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium truncate ${isUnlocked ? 'text-zinc-200' : 'text-zinc-400'}`}>
          {t(def.nameKey)}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] font-semibold uppercase text-zinc-500">{t(`achievements.tier.${def.tier}`)}</span>
          {TIER_XP[def.tier] > 0 && <span className="text-[9px] font-semibold text-amber-400/70">+{TIER_XP[def.tier]} XP</span>}
          {TIER_TOKENS[def.tier] > 0 && <span className="text-[9px] font-semibold text-purple-400/70">+{TIER_TOKENS[def.tier]} Token</span>}
        </div>
        {progress && (
          <p className="text-[10px] text-zinc-500 tabular-nums">
            {progress.current}/{progress.target}
          </p>
        )}
      </div>
      {isUnlocked && <span className="text-yellow-400 text-xs shrink-0">✓</span>}
    </div>
  );
}
