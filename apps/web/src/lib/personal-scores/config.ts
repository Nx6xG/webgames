import type { ScoreGameConfig } from './types';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const P = 10;  // personal max entries
const G = 25;  // public/global max entries

export const SCORE_CONFIGS: Record<string, ScoreGameConfig> = {
  flappy: {
    sortDirection: 'desc',
    maxEntries: P,
    publicMaxEntries: G,
    shouldStore: (score) => score > 0,
    scoreLabelKey: 'pb.score',
    columns: [],
  },
  snake: {
    sortDirection: 'desc',
    maxEntries: P,
    publicMaxEntries: G,
    shouldStore: (score) => score > 0,
    scoreLabelKey: 'pb.score',
    columns: [
      { key: 'moves', labelKey: 'pb.moves' },
      { key: 'durationSec', labelKey: 'pb.time', format: (v) => `${v}s` },
    ],
  },
  tetris: {
    sortDirection: 'desc',
    maxEntries: P,
    publicMaxEntries: G,
    shouldStore: (score) => score > 0,
    scoreLabelKey: 'pb.score',
    columns: [
      { key: 'lines', labelKey: 'pb.lines' },
      { key: 'level', labelKey: 'pb.level' },
    ],
  },
  '2048': {
    sortDirection: 'desc',
    maxEntries: P,
    publicMaxEntries: G,
    shouldStore: (score) => score > 0,
    scoreLabelKey: 'pb.score',
    columns: [
      { key: 'maxTile', labelKey: 'pb.tile' },
      { key: 'moves', labelKey: 'pb.moves' },
    ],
  },
  'minesweeper-easy': {
    sortDirection: 'asc',
    maxEntries: P,
    publicMaxEntries: G,
    shouldStore: (_score, meta) => meta?.won === true,
    scoreLabelKey: 'pb.time',
    scoreFormat: formatTime,
    columns: [],
  },
  'minesweeper-medium': {
    sortDirection: 'asc',
    maxEntries: P,
    publicMaxEntries: G,
    shouldStore: (_score, meta) => meta?.won === true,
    scoreLabelKey: 'pb.time',
    scoreFormat: formatTime,
    columns: [],
  },
  'minesweeper-hard': {
    sortDirection: 'asc',
    maxEntries: P,
    publicMaxEntries: G,
    shouldStore: (_score, meta) => meta?.won === true,
    scoreLabelKey: 'pb.time',
    scoreFormat: formatTime,
    columns: [],
  },
  doodlejump: {
    sortDirection: 'desc',
    maxEntries: P,
    publicMaxEntries: G,
    shouldStore: (score) => score > 0,
    scoreLabelKey: 'pb.score',
    columns: [],
  },
  breakout: {
    sortDirection: 'desc',
    maxEntries: P,
    publicMaxEntries: G,
    shouldStore: (score) => score > 0,
    scoreLabelKey: 'pb.score',
    columns: [
      { key: 'level', labelKey: 'pb.level' },
    ],
  },
  crossyroad: {
    sortDirection: 'desc',
    maxEntries: P,
    publicMaxEntries: G,
    shouldStore: (score) => score > 0,
    scoreLabelKey: 'pb.score',
    columns: [
      { key: 'coins', labelKey: 'pb.coins' },
    ],
  },
};

export function getScoreConfig(gameId: string): ScoreGameConfig | null {
  return SCORE_CONFIGS[gameId] ?? null;
}
