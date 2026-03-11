'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { webRegistry } from '@/lib/gameRegistry';
import type { WebGameEntry } from '@/lib/gameRegistry';
import { loadLocalProfile } from '@/lib/localStats';
import type { GameStat } from '@/lib/localStats';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import { loadUnlocked } from '@/lib/achievements/store';
import { loadScores } from '@/lib/personal-scores/storage';

// ── Singleplayer card metadata ───────────────────────────────────────────────
const SINGLEPLAYER_GAMES = [
  {
    id:           '2048',
    titleKey:     'lobby.games.2048.title',
    descKey:      'lobby.games.2048.desc',
    emoji:        '🔢',
    href:         '/games/2048',
    tags:         ['singleplayer', 'puzzle', 'casual'],
    bestScoreKey: 'webgames.2048.highscores',
  },
  {
    id:           'snake',
    titleKey:     'lobby.games.snake.title',
    descKey:      'lobby.games.snake.desc',
    emoji:        '🐍',
    href:         '/games/snake',
    tags:         ['singleplayer', 'arcade', 'classic'],
    bestScoreKey: 'webgames.snake.highscores',
  },
  {
    id:           'tictactoe-solo',
    titleKey:     'lobby.games.tictactoe-solo.title',
    descKey:      'lobby.games.tictactoe-solo.desc',
    emoji:        '✖️',
    href:         '/games/tictactoe-solo',
    tags:         ['singleplayer', 'classic'],
    bestScoreKey: '',
  },
  {
    id:           'sudoku',
    titleKey:     'lobby.games.sudoku.title',
    descKey:      'lobby.games.sudoku.desc',
    emoji:        '#️⃣',
    href:         '/games/sudoku',
    tags:         ['singleplayer', 'puzzle', 'classic'],
    bestScoreKey: '',
  },
  {
    id:           'tetris',
    titleKey:     'lobby.games.tetris.title',
    descKey:      'lobby.games.tetris.desc',
    emoji:        '🧱',
    href:         '/games/tetris',
    tags:         ['singleplayer', 'arcade', 'classic'],
    bestScoreKey: '',
  },
  {
    id:           'flappy',
    titleKey:     'lobby.games.flappy.title',
    descKey:      'lobby.games.flappy.desc',
    emoji:        '🐦',
    href:         '/games/flappy',
    tags:         ['singleplayer', 'arcade', 'classic'],
    bestScoreKey: 'webgames.flappy.highscores',
  },
  {
    id:           'pong',
    titleKey:     'lobby.games.pong.title',
    descKey:      'lobby.games.pong.desc',
    emoji:        '🏓',
    href:         '/games/pong',
    tags:         ['singleplayer', 'arcade', 'classic'],
    bestScoreKey: '',
  },
  {
    id:           'breakout',
    titleKey:     'lobby.games.breakout.title',
    descKey:      'lobby.games.breakout.desc',
    emoji:        '🧱',
    href:         '/games/breakout',
    tags:         ['singleplayer', 'arcade', 'classic'],
    bestScoreKey: '',
  },
  {
    id:           'minesweeper',
    titleKey:     'lobby.games.minesweeper.title',
    descKey:      'lobby.games.minesweeper.desc',
    emoji:        '💣',
    href:         '/games/minesweeper',
    tags:         ['singleplayer', 'puzzle', 'classic'],
    bestScoreKey: '',
  },
] as const;
import { GlobalChatWidget } from '@/components/chat/GlobalChatWidget';
import { ProfileMenu } from '@/components/ProfileMenu';
import { OnlineNavChip } from '@/components/social/OnlineNavChip';
import { TokenHeaderChip } from '@/components/ui/TokenHeaderChip';
import { useI18n } from '@/components/providers/LanguageProvider';
import { usePartyCtx } from '@/components/providers/PartyProvider';
import { GameDetailsModal } from '@/components/games/GameDetailsModal';
import type { GameModalData } from '@/components/games/GameDetailsModal';
import { DailyChallengesWidget } from '@/components/DailyChallengesWidget';
import { GameOfTheDay } from '@/components/GameOfTheDay';
import { RecentlyPlayed } from '@/components/RecentlyPlayed';
import { ActiveRoomsWidget } from '@/components/ActiveRoomsWidget';
import { LevelUpCelebration } from '@/components/LevelUpCelebration';

/** Maps internal category IDs (used as CSS-class keys) to i18n message keys. */
const CATEGORY_TAG_KEYS: Record<string, string> = {
  'classic':      'lobby.tags.classic',
  'strategy':     'lobby.tags.strategy',
  '2 players':    'lobby.tags.twoPlayers',
  'multiplayer':  'lobby.tags.multiplayer',
  'singleplayer': 'lobby.tags.singleplayer',
  'puzzle':       'lobby.tags.puzzle',
  'casual':       'lobby.tags.casual',
  'arcade':       'lobby.tags.arcade',
  'cards':        'lobby.tags.cards',
  'bluff':        'lobby.tags.bluff',
};

const CATEGORY_COLORS: Record<string, string> = {
  'classic':      'bg-amber-900/40 text-amber-300 border-amber-800',
  'strategy':     'bg-indigo-900/40 text-indigo-300 border-indigo-800',
  '2 players':    'bg-rose-900/40 text-rose-300 border-rose-800',
  'multiplayer':  'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  'singleplayer': 'bg-violet-900/40 text-violet-300 border-violet-800',
  'puzzle':       'bg-sky-900/40 text-sky-300 border-sky-800',
  'casual':       'bg-teal-900/40 text-teal-300 border-teal-800',
  'arcade':       'bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-800',
  'cards':        'bg-orange-900/40 text-orange-300 border-orange-800',
  'bluff':        'bg-pink-900/40 text-pink-300 border-pink-800',
};

// ── Per-game controls i18n keys ──────────────────────────────────────────────

const GAME_CONTROLS_KEY: Record<string, string> = {
  tictactoe:       'modal.controls.tictactoe',
  connect4:        'modal.controls.connect4',
  rps:             'modal.controls.rps',
  chess:           'modal.controls.chess',
  battleship:      'modal.controls.battleship',
  liarsbar:        'modal.controls.liarsbar',
  '2048':          'modal.controls.2048',
  snake:           'modal.controls.snake',
  'tictactoe-solo':'modal.controls.tictactoe',
  sudoku:          'modal.controls.sudoku',
  tetris:          'modal.controls.tetris',
  flappy:          'modal.controls.flappy',
  pong:            'modal.controls.pong',
  breakout:        'modal.controls.breakout',
  minesweeper:     'modal.controls.minesweeper',
  curvefever:      'modal.controls.curvefever',
  uno:             'modal.controls.uno',
};

// ── Badge system ─────────────────────────────────────────────────────────────

type BadgeType = 'mostWins' | 'bestWinrate' | 'hardGame' | 'favorite' | 'new';

interface BadgeInfo {
  type: BadgeType;
  icon: string;
  labelKey: string;
  tooltipKey: string;
  colors: string;
}

const BADGE_CONFIG: Record<BadgeType, Omit<BadgeInfo, 'type'>> = {
  mostWins:     { icon: '🏆', labelKey: 'cards.badge.mostWins',     tooltipKey: 'cards.badge.mostWinsTooltip',     colors: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  bestWinrate:  { icon: '🎯', labelKey: 'cards.badge.bestWinrate',  tooltipKey: 'cards.badge.bestWinrateTooltip',  colors: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  hardGame:     { icon: '💀', labelKey: 'cards.badge.hardGame',     tooltipKey: 'cards.badge.hardGameTooltip',     colors: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  favorite:     { icon: '⭐', labelKey: 'cards.badge.favorite',     tooltipKey: 'cards.badge.favoriteTooltip',     colors: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  new:          { icon: '🧪', labelKey: 'cards.badge.new',          tooltipKey: 'cards.badge.newTooltip',          colors: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
};

const WINRATE_MIN_PLAYS = 5;

/** Compute a single badge per game from stats. Only one badge per card; each special badge assigned to at most one game. */
function computeBadges(statsMap: Map<string, CardOverlayData>): Map<string, BadgeInfo> {
  const badges = new Map<string, BadgeInfo>();
  const entries = [...statsMap.entries()];

  // Find best candidates
  let topWinsId: string | null = null;
  let topWins = 0;
  let topWinrateId: string | null = null;
  let topWinrate = 0;
  let topLossesId: string | null = null;
  let topLosses = 0;
  let topPlaysId: string | null = null;
  let topPlays = 0;

  for (const [id, s] of entries) {
    if (s.wins > topWins) { topWins = s.wins; topWinsId = id; }
    if (s.plays >= WINRATE_MIN_PLAYS && s.winRate > topWinrate) { topWinrate = s.winRate; topWinrateId = id; }
    const losses = s.plays - s.wins;
    if (s.plays >= WINRATE_MIN_PLAYS && losses > topLosses) { topLosses = losses; topLossesId = id; }
    if (s.plays > topPlays) { topPlays = s.plays; topPlaysId = id; }
  }

  // Assign unique badges by priority: mostWins > bestWinrate > hardGame > favorite
  const claimed = new Set<string>();

  if (topWinsId && topWins > 0) {
    badges.set(topWinsId, { type: 'mostWins', ...BADGE_CONFIG.mostWins });
    claimed.add(topWinsId);
  }
  if (topWinrateId && topWinrate > 0 && !claimed.has(topWinrateId)) {
    badges.set(topWinrateId, { type: 'bestWinrate', ...BADGE_CONFIG.bestWinrate });
    claimed.add(topWinrateId);
  }
  if (topLossesId && topLosses > 0 && !claimed.has(topLossesId)) {
    badges.set(topLossesId, { type: 'hardGame', ...BADGE_CONFIG.hardGame });
    claimed.add(topLossesId);
  }
  if (topPlaysId && topPlays > 0 && !claimed.has(topPlaysId)) {
    badges.set(topPlaysId, { type: 'favorite', ...BADGE_CONFIG.favorite });
    claimed.add(topPlaysId);
  }

  // "New" badge for games with 0 plays
  for (const [id, s] of entries) {
    if (s.plays === 0 && !claimed.has(id)) {
      badges.set(id, { type: 'new', ...BADGE_CONFIG.new });
    }
  }

  return badges;
}

// ── Per-game overlay data ────────────────────────────────────────────────────

interface CardOverlayData {
  plays: number;
  wins: number;
  winRate: number;
  bestScore: number | null;
  bestTime: number | null;
  bestTile: number | null;
  bestLines: number | null;
  achUnlocked: number;
  achTotal: number;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Shared overlay rendered inside each card. */
function StatsOverlay({ data, t }: { data: CardOverlayData | null; t: (k: string) => string }) {
  const hasAny = data && (data.plays > 0 || data.bestScore !== null || data.bestTime !== null);

  return (
    <div className="absolute inset-x-0 top-0 rounded-t-2xl border-b border-zinc-700/60 bg-zinc-950/90 backdrop-blur-sm px-3 py-2 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-200 pointer-events-none">
      <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">
        {t('cards.progressTitle')}
      </p>

      {!hasAny ? (
        <p className="text-[10px] text-zinc-600 italic">{t('cards.noStats')}</p>
      ) : (
        <div className="flex items-center gap-2 text-[10px] text-zinc-400 tabular-nums flex-wrap">
          {data.plays > 0 && (
            <>
              <span>🎮 {data.plays}</span>
              <span className="text-zinc-700">|</span>
              <span>🏆 {data.wins}</span>
              <span className="text-zinc-700">|</span>
              <span>{data.winRate}%</span>
            </>
          )}
          {data.achTotal > 0 && (
            <>
              {data.plays > 0 && <span className="text-zinc-700">|</span>}
              <span className={data.achUnlocked > 0 ? 'text-yellow-400' : ''}>⭐ {data.achUnlocked}/{data.achTotal}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Card components ──────────────────────────────────────────────────────────

function CardBadge({ badge, t }: { badge: BadgeInfo | null; t: (k: string) => string }) {
  if (!badge) return null;
  return (
    <div className="absolute top-3 right-3 z-[2] group/badge">
      <span className={`text-[10px] px-2 py-0.5 rounded-full border backdrop-blur-sm font-medium ${badge.colors}`}>
        {badge.icon} {t(badge.labelKey)}
      </span>
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[10px] text-white opacity-0 transition group-hover/badge:opacity-100 backdrop-blur shadow-lg z-[3]">
        {t(badge.tooltipKey)}
      </div>
    </div>
  );
}

function SingleplayerCard({
  game,
  overlayData,
  badge,
  onOpenModal,
}: {
  game: typeof SINGLEPLAYER_GAMES[number];
  overlayData: CardOverlayData | null;
  badge: BadgeInfo | null;
  onOpenModal?: () => void;
}) {
  const { t } = useI18n();
  const [bestScore, setBestScore] = useState<number | null>(null);

  useEffect(() => {
    // Try new personal-scores system first
    const pbEntries = loadScores(game.id);
    if (pbEntries.length > 0 && pbEntries[0].score > 0) {
      setBestScore(pbEntries[0].score);
      return;
    }
    // Fallback: legacy format
    if (!game.bestScoreKey) return;
    try {
      const raw = localStorage.getItem(game.bestScoreKey);
      if (!raw) return;
      const entries = JSON.parse(raw) as Array<{ score: number }>;
      const best = entries.reduce((m, e) => Math.max(m, e.score), 0);
      if (best > 0) setBestScore(best);
    } catch {}
  }, [game.id, game.bestScoreKey]);

  return (
    <div
      className="group relative rounded-2xl border border-[var(--cardBorder)] bg-[var(--card)] p-6 hover:border-purple-500/50 hover:bg-zinc-800/50 hover:scale-[1.02] hover:shadow-xl transition-all duration-200 ease-out overflow-hidden cursor-pointer"
      onClick={onOpenModal}
    >
      <CardBadge badge={badge} t={t} />
      <div className="w-14 h-14 rounded-xl border bg-violet-950 border-violet-900 flex items-center justify-center mb-5 text-2xl select-none">
        {game.emoji}
      </div>
      <h3 className="font-bold text-lg mb-1">{t(game.titleKey)}</h3>
      <p className={`text-sm leading-relaxed text-zinc-400 ${bestScore !== null ? 'mb-3' : 'mb-4'}`}>
        {t(game.descKey)}
      </p>
      {bestScore !== null && (
        <p className="text-xs text-zinc-500 mb-4">
          Best:{' '}
          <span className="font-semibold tabular-nums text-zinc-300">
            {bestScore.toLocaleString()}
          </span>
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {game.tags.map((tag) => (
          <span
            key={tag}
            className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[tag] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
          >
            {t(CATEGORY_TAG_KEYS[tag] ?? tag)}
          </span>
        ))}
      </div>
      <Link
        href={game.href}
        className="relative z-[1] block w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold text-center transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {t('lobby.play')}
      </Link>

      <StatsOverlay data={overlayData} t={t} />
    </div>
  );
}

function GameCard({
  entry,
  overlayData,
  badge,
  onOpenModal,
}: {
  entry: WebGameEntry;
  overlayData: CardOverlayData | null;
  badge: BadgeInfo | null;
  onOpenModal?: () => void;
}) {
  const { manifest: game, titleKey, descKey, comingSoon } = entry;
  const { t } = useI18n();
  const { isHost, launchGame } = usePartyCtx();

  if (comingSoon) {
    return (
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 opacity-70 cursor-default">
        <div className="w-14 h-14 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-600 flex items-center justify-center mb-5 text-2xl">⊞</div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-lg text-zinc-500">{t(titleKey)}</h3>
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-800/60 text-zinc-500 font-medium">
            {t('lobby.soon')}
          </span>
        </div>
        <p className="text-sm mb-4 leading-relaxed text-zinc-600">{t(descKey)}</p>
        <div className="flex flex-wrap gap-1.5">
          {game.categories.map((cat) => (
            <span key={cat} className="text-xs px-2 py-0.5 rounded-full border bg-zinc-900 text-zinc-600 border-zinc-800">
              {t(CATEGORY_TAG_KEYS[cat] ?? cat)}
            </span>
          ))}
        </div>
        <p className="mt-5 text-sm text-zinc-600">{t('lobby.comingSoon')}</p>
      </div>
    );
  }

  return (
    <div
      className="group relative rounded-2xl border border-[var(--cardBorder)] bg-[var(--card)] p-6 hover:border-purple-500/50 hover:bg-zinc-800/50 hover:scale-[1.02] hover:shadow-xl transition-all duration-200 ease-out overflow-hidden cursor-pointer"
      onClick={onOpenModal}
    >
      <CardBadge badge={badge} t={t} />
      <div className="w-14 h-14 rounded-xl border bg-indigo-950 border-indigo-900 flex items-center justify-center mb-5 text-2xl">⊞</div>
      <h3 className="font-bold text-lg mb-1">{t(titleKey)}</h3>
      <p className="text-sm mb-4 leading-relaxed text-zinc-400">{t(descKey)}</p>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {game.categories.map((cat) => (
          <span
            key={cat}
            className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
          >
            {t(CATEGORY_TAG_KEYS[cat] ?? cat)}
          </span>
        ))}
      </div>
      <div className="relative z-[1] flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2">
          {isHost ? (
            <button
              onClick={() => launchGame(game.id as import('shared').GameId)}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold text-center transition-colors"
            >
              {t('party.launchGame')}
            </button>
          ) : (
            <Link
              href={`/games/${game.routeSlug}?quickplay=true`}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold text-center transition-colors"
            >
              {t('lobby.quickPlay')}
            </Link>
          )}
          <Link
            href={`/games/${game.routeSlug}`}
            className="px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            title="Create or join a custom room"
          >
            {t('lobby.customGame')}
          </Link>
        </div>
        {isHost && (
          <p className="text-[10px] text-indigo-400/70 text-center">{t('party.launchHint')}</p>
        )}
      </div>

      <StatsOverlay data={overlayData} t={t} />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type GameFilter = 'all' | 'multiplayer' | 'singleplayer';

const FILTER_LABELS: { value: GameFilter; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'multiplayer',  label: 'Multiplayer' },
  { value: 'singleplayer', label: 'Singleplayer' },
];

export default function HomePage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<GameFilter>('all');

  // Modal state
  const [modalData, setModalData] = useState<GameModalData | null>(null);

  // Load all stats once on mount (SSR-safe: runs only on client)
  const [statsMap, setStatsMap] = useState<Map<string, CardOverlayData> | null>(null);
  const [badgeMap, setBadgeMap] = useState<Map<string, BadgeInfo>>(new Map());
  const [favoriteGameId, setFavoriteGameId] = useState<string | null>(null);
  const [unlockedSet, setUnlockedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    const profile = loadLocalProfile();
    const unlocked = loadUnlocked();
    setUnlockedSet(unlocked);

    // Count achievements per game tag
    const achTotalByTag = new Map<string, number>();
    const achUnlockedByTag = new Map<string, number>();
    for (const def of ACHIEVEMENTS) {
      const tag = def.tags?.[0];
      if (!tag) continue;
      achTotalByTag.set(tag, (achTotalByTag.get(tag) ?? 0) + 1);
      if (unlocked.has(def.id)) {
        achUnlockedByTag.set(tag, (achUnlockedByTag.get(tag) ?? 0) + 1);
      }
    }

    const map = new Map<string, CardOverlayData>();
    for (const gs of profile.perGame) {
      const tag = gs.gameId;
      map.set(tag, {
        plays: gs.plays,
        wins: gs.wins,
        winRate: gs.winRate,
        bestScore: gs.bestScore,
        bestTime: gs.bestTime,
        bestTile: gs.bestTile,
        bestLines: gs.bestLines,
        achUnlocked: achUnlockedByTag.get(tag) ?? 0,
        achTotal: achTotalByTag.get(tag) ?? 0,
      });
    }
    setStatsMap(map);
    setBadgeMap(computeBadges(map));
    setFavoriteGameId(profile.favoriteGameId);
  }, []);

  const showMultiplayer  = filter !== 'singleplayer';
  const showSingleplayer = filter !== 'multiplayer';

  function openMultiplayerModal(entry: WebGameEntry) {
    const s = statsMap?.get(entry.manifest.id);
    setModalData({
      gameId: entry.manifest.id,
      emoji: '⊞',
      titleKey: entry.titleKey,
      descKey: entry.descKey,
      tags: entry.manifest.categories,
      controlsKey: GAME_CONTROLS_KEY[entry.manifest.id] ?? 'modal.controls.default',
      mode: 'multiplayer',
      playHref: `/games/${entry.manifest.routeSlug}?quickplay=true`,
      customHref: `/games/${entry.manifest.routeSlug}`,
      plays: s?.plays ?? 0,
      wins: s?.wins ?? 0,
      winRate: s?.winRate ?? 0,
      bestScore: s?.bestScore ?? null,
      bestTime: s?.bestTime ?? null,
      bestTile: s?.bestTile ?? null,
      bestLines: s?.bestLines ?? null,
      isFavorite: favoriteGameId === entry.manifest.id,
    });
  }

  function openSingleplayerModal(game: typeof SINGLEPLAYER_GAMES[number]) {
    const s = statsMap?.get(game.id);
    setModalData({
      gameId: game.id,
      emoji: game.emoji,
      titleKey: game.titleKey,
      descKey: game.descKey,
      tags: game.tags,
      controlsKey: GAME_CONTROLS_KEY[game.id] ?? 'modal.controls.default',
      mode: 'singleplayer',
      playHref: game.href,
      plays: s?.plays ?? 0,
      wins: s?.wins ?? 0,
      winRate: s?.winRate ?? 0,
      bestScore: s?.bestScore ?? null,
      bestTime: s?.bestTime ?? null,
      bestTile: s?.bestTile ?? null,
      bestLines: s?.bestLines ?? null,
      isFavorite: favoriteGameId === game.id,
    });
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Level-up celebration overlay */}
      <LevelUpCelebration />

      {/* Header */}
      <header className="border-b border-[var(--cardBorder)] bg-[var(--bg)]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-sm">
            W
          </div>
          <span className="font-bold text-lg tracking-tight">Web Games</span>
          <nav className="ml-auto flex items-center gap-3">
            <Link href="/rooms" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              {t('nav.rooms')}
            </Link>
            <Link href="/leaderboards" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              {t('nav.leaderboard')}
            </Link>
            <div className="w-px h-4 bg-zinc-700/60 shrink-0" aria-hidden />
            <TokenHeaderChip />
            <div className="w-px h-4 bg-zinc-700/60 shrink-0" aria-hidden />
            <div className="flex items-center gap-2">
              <OnlineNavChip />
              <ProfileMenu />
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12 text-center">
        {/*
          "Play. Together." is intentionally hardcoded in English for both locales.
          It is the platform's brand slogan and must never be translated.
          See lobby.hero.title in messages.ts (identical value in de + en) for reference.
        */}
        <h1 className="text-5xl font-black tracking-tight mb-4">
          Play.{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-rose-400">
            Together.
          </span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-md mx-auto">
          {t('lobby.hero.subtitle')}
        </p>
      </section>

      {/* Recently played */}
      <RecentlyPlayed />

      {/* Active rooms */}
      <ActiveRoomsWidget />

      {/* Filter toggle */}
      <div className="max-w-5xl mx-auto px-6 pb-8">
        <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg w-fit">
          {FILTER_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-1.5 text-xs rounded-md font-medium transition-colors ${
                filter === value ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Game of the Day */}
      <GameOfTheDay />

      {/* Daily challenges */}
      <DailyChallengesWidget />

      {/* Multiplayer games grid */}
      {showMultiplayer && (
        <section className="max-w-5xl mx-auto px-6 pb-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-6">
            Multiplayer
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(webRegistry).map((entry) => (
              <GameCard
                key={entry.manifest.id}
                entry={entry}
                overlayData={statsMap?.get(entry.manifest.id) ?? null}
                badge={badgeMap.get(entry.manifest.id) ?? null}
                onOpenModal={() => openMultiplayerModal(entry)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Singleplayer games grid */}
      {showSingleplayer && (
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-6">
            {t('lobby.singleplayer')}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SINGLEPLAYER_GAMES.map((game) => (
              <SingleplayerCard
                key={game.id}
                game={game}
                overlayData={statsMap?.get(game.id) ?? null}
                badge={badgeMap.get(game.id) ?? null}
                onOpenModal={() => openSingleplayerModal(game)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--cardBorder)] py-6">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-xs text-zinc-600">
          <span>Web Games</span>
          <a
            href="https://ko-fi.com/nicogrim"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
          >
            <span>☕</span>
            {t('support.label')}
          </a>
        </div>
      </footer>

      <GlobalChatWidget />

      {modalData && (
        <GameDetailsModal
          data={modalData}
          unlocked={unlockedSet}
          onClose={() => setModalData(null)}
        />
      )}
    </main>
  );
}
