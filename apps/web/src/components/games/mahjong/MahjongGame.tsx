'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GamePhase, LayoutId, LayoutDifficulty, MahjongTile } from './types';
import {
  generateBoard,
  isTileFree,
  hasValidMoves,
  remainingCount,
  availablePairs,
  findHint,
} from './engine';
import { LAYOUTS, getLayout } from './layouts';
import type { LayoutPosition } from './layouts';
import { facesMatch, tileChar, suitIndicator, faceColor } from './tiles';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { saveGame, loadGame, clearSave } from '@/lib/gameSave';
import { getSupabase } from '@/lib/supabaseClient';
import {
  loadGameProgress,
  saveGameProgress,
  fetchCloudGameProgress,
  saveCloudGameProgress,
} from '@/lib/cloudSync';

const SAVE_ID = 'mahjong';

// ── Tile sizing ─────────────────────────────────────────────────────────────
const FACE_W = 52;
const FACE_H = 64;
const EDGE = 6;
const GRID = 28;

interface SaveData {
  tiles: MahjongTile[];
  layoutId: LayoutId;
  elapsed: number;
  moves: number;
  hintsUsed: number;
}

// ── Progress helpers ────────────────────────────────────────────────────────

interface MahjongProgress {
  completed: LayoutId[];
  unlocked: LayoutId[];
}

/** First layout of each difficulty is always unlocked. */
const DEFAULT_UNLOCKED: LayoutId[] = (() => {
  const ids: LayoutId[] = [];
  for (const diff of ['easy', 'medium', 'hard'] as LayoutDifficulty[]) {
    const first = LAYOUTS.find(l => l.difficulty === diff);
    if (first) ids.push(first.id);
  }
  return ids;
})();

function loadProgress(): { completed: Set<LayoutId>; unlocked: Set<LayoutId> } {
  const data = loadGameProgress();
  const p = data.mahjong as MahjongProgress | LayoutId[] | undefined;
  // Migration: old format stored just LayoutId[]
  if (Array.isArray(p) && typeof p[0] === 'string') {
    const completed = new Set(p as LayoutId[]);
    // Derive unlocked from old sequential logic + defaults
    const unlocked = new Set<LayoutId>(DEFAULT_UNLOCKED);
    for (const id of completed) unlocked.add(id);
    return { completed, unlocked };
  }
  if (p && typeof p === 'object' && 'completed' in p) {
    const unlocked = new Set<LayoutId>([...DEFAULT_UNLOCKED, ...(p.unlocked ?? [])]);
    // Completed layouts are also always unlocked
    for (const id of p.completed) unlocked.add(id);
    return { completed: new Set(p.completed), unlocked };
  }
  return { completed: new Set(), unlocked: new Set(DEFAULT_UNLOCKED) };
}

function saveProgress(completed: Set<LayoutId>, unlocked: Set<LayoutId>) {
  const data = loadGameProgress();
  data.mahjong = { completed: [...completed], unlocked: [...unlocked] } satisfies MahjongProgress;
  saveGameProgress(data);
}

export function MahjongGame() {
  const { t } = useI18n();
  const { user } = useAuth();
  const ach = useAchievements('mahjong');

  const [phase, setPhase] = useState<GamePhase>('menu');
  const [layoutId, setLayoutId] = useState<LayoutId>('flat');
  const [tiles, setTiles] = useState<MahjongTile[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [matchAnim, setMatchAnim] = useState<Set<number>>(new Set());
  const [wrongAnim, setWrongAnim] = useState<Set<number>>(new Set());
  const [hintTiles, setHintTiles] = useState<Set<number>>(new Set());
  const [elapsed, setElapsed] = useState(0);
  const [moves, setMoves] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hasSaved, setHasSaved] = useState(false);

  // Progress
  const [completed, setCompleted] = useState<Set<LayoutId>>(new Set());
  const [unlocked, setUnlocked] = useState<Set<LayoutId>>(new Set());
  /** Whether this win grants an unlock pick (first time completing this layout & there are locked layouts left) */
  const [canPickUnlock, setCanPickUnlock] = useState(false);
  const cloudSyncRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const userIdRef = useRef<string | null>(null);

  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Track user id for cloud sync
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user]);

  // ── Load progress on mount + cloud merge on auth ────────────────────────
  useEffect(() => {
    const { completed: c, unlocked: u } = loadProgress();
    setCompleted(c);
    setUnlocked(u);
    setHasSaved(loadGame(SAVE_ID) !== null);
  }, []);

  useEffect(() => {
    if (!user) return;
    const sb = getSupabase();
    if (!sb) return;
    fetchCloudGameProgress(sb, user.id)
      .then(cloud => {
        if (!cloud) return;
        const raw = cloud.mahjong;
        if (!raw) return;
        // Parse cloud data (may be old array format or new object format)
        let cloudCompleted: LayoutId[] = [];
        let cloudUnlocked: LayoutId[] = [];
        if (Array.isArray(raw)) {
          cloudCompleted = raw as LayoutId[];
        } else if (typeof raw === 'object' && 'completed' in raw) {
          const p = raw as MahjongProgress;
          cloudCompleted = p.completed ?? [];
          cloudUnlocked = p.unlocked ?? [];
        }
        if (cloudCompleted.length === 0 && cloudUnlocked.length === 0) return;
        setCompleted(prev => {
          const merged = new Set([...prev, ...cloudCompleted]);
          setUnlocked(prevU => {
            const mergedU = new Set([...prevU, ...cloudUnlocked, ...merged]);
            saveProgress(merged, mergedU);
            return mergedU;
          });
          return merged;
        });
      })
      .catch(err => console.error('[mahjong] cloud load error:', err));
  }, [user]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const saveRef = useRef<() => void>(() => {});
  saveRef.current = () => {
    if (phase !== 'playing' || moves === 0) return;
    const data: SaveData = {
      tiles, layoutId,
      elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000),
      moves, hintsUsed,
    };
    saveGame(SAVE_ID, data);
  };

  useEffect(() => {
    const onVis = () => { if (document.hidden) saveRef.current(); };
    const onUnload = () => saveRef.current();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);
  useEffect(() => () => { saveRef.current(); }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const remaining = useMemo(() => remainingCount(tiles), [tiles]);
  const pairs = useMemo(() => availablePairs(tiles), [tiles]);

  // ── Win/loss ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || tiles.length === 0) return;
    if (remaining === 0) {
      clearSave(SAVE_ID);
      setPhase('won');
      ach.trackWin();

      // Mark layout completed
      setCompleted(prev => {
        const wasNew = !prev.has(layoutId);
        if (!wasNew) return prev;
        const next = new Set(prev);
        next.add(layoutId);

        // Check if there are locked layouts in the same difficulty
        const meta = LAYOUTS.find(l => l.id === layoutId);
        if (meta) {
          const sameDiff = LAYOUTS.filter(l => l.difficulty === meta.difficulty);
          const hasLocked = sameDiff.some(l => !next.has(l.id) && !unlocked.has(l.id));
          if (hasLocked) setCanPickUnlock(true);
        }

        setUnlocked(prevU => {
          const u = new Set([...prevU, layoutId]);
          saveProgress(next, u);
          return u;
        });

        // Debounced cloud save
        if (userIdRef.current) {
          clearTimeout(cloudSyncRef.current);
          const uid = userIdRef.current;
          cloudSyncRef.current = setTimeout(() => {
            const sb = getSupabase();
            if (sb && uid) {
              const data = loadGameProgress();
              saveCloudGameProgress(sb, uid, data).catch(err =>
                console.error('[mahjong] cloud save error:', err),
              );
            }
          }, 1000);
        }

        return next;
      });
      return;
    }
    if (!hasValidMoves(tiles)) {
      clearSave(SAVE_ID); setPhase('lost');
    }
  }, [tiles, remaining, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start / continue ──────────────────────────────────────────────────────
  const resetState = useCallback(() => {
    setSelected(null);
    setMatchAnim(new Set());
    setWrongAnim(new Set());
    setHintTiles(new Set());
    setCanPickUnlock(false);
  }, []);

  const startGame = useCallback((lid: LayoutId) => {
    clearSave(SAVE_ID); setHasSaved(false);
    setLayoutId(lid); setTiles(generateBoard(lid));
    resetState(); setMoves(0); setHintsUsed(0); setElapsed(0);
    startTimeRef.current = Date.now();
    setPhase('playing'); ach.trackPlay();
  }, [ach, resetState]);

  const handleContinue = useCallback(() => {
    const data = loadGame<SaveData>(SAVE_ID);
    if (!data) return;
    clearSave(SAVE_ID); setHasSaved(false);
    setLayoutId(data.layoutId); setTiles(data.tiles);
    resetState(); setMoves(data.moves); setHintsUsed(data.hintsUsed);
    setElapsed(data.elapsed);
    startTimeRef.current = Date.now() - data.elapsed * 1000;
    setPhase('playing');
  }, [resetState]);

  // ── Tile click ────────────────────────────────────────────────────────────
  const handleTileClick = useCallback((tileId: number) => {
    if (phase !== 'playing') return;
    setHintTiles(new Set());

    const tile = tiles.find(tp => tp.id === tileId);
    if (!tile || tile.removed || !isTileFree(tile, tiles)) return;

    if (selected === null) { setSelected(tileId); return; }
    if (selected === tileId) { setSelected(null); return; }

    const selectedTile = tiles.find(tp => tp.id === selected);
    if (!selectedTile) { setSelected(tileId); return; }

    setMoves(m => m + 1);

    if (facesMatch(selectedTile.face, tile.face)) {
      setMatchAnim(new Set([selected, tileId]));
      setTimeout(() => {
        setTiles(prev => prev.map(tp =>
          tp.id === selected || tp.id === tileId ? { ...tp, removed: true } : tp
        ));
        setMatchAnim(new Set());
      }, 300);
      setSelected(null);
    } else {
      setWrongAnim(new Set([selected, tileId]));
      setTimeout(() => setWrongAnim(new Set()), 400);
      setSelected(tileId);
    }
  }, [phase, tiles, selected]);

  // ── Hint ──────────────────────────────────────────────────────────────────
  const handleHint = useCallback(() => {
    const hint = findHint(tiles);
    if (hint) {
      setHintTiles(new Set(hint));
      setHintsUsed(h => h + 1);
      setTimeout(() => setHintTiles(new Set()), 2000);
    }
  }, [tiles]);

  // ── Shuffle ───────────────────────────────────────────────────────────────
  // ── Unlock pick ─────────────────────────────────────────────────────────
  const handlePickUnlock = useCallback((id: LayoutId) => {
    setUnlocked(prev => {
      const next = new Set([...prev, id]);
      saveProgress(completed, next);
      // Cloud save
      if (userIdRef.current) {
        clearTimeout(cloudSyncRef.current);
        const uid = userIdRef.current;
        cloudSyncRef.current = setTimeout(() => {
          const sb = getSupabase();
          if (sb && uid) {
            const data = loadGameProgress();
            saveCloudGameProgress(sb, uid, data).catch(err =>
              console.error('[mahjong] cloud save error:', err),
            );
          }
        }, 1000);
      }
      return next;
    });
    setCanPickUnlock(false);
  }, [completed]);

  const handleShuffle = useCallback(() => {
    const active = tiles.filter(tp => !tp.removed);
    const faces = active.map(tp => tp.face);
    for (let i = faces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [faces[i], faces[j]] = [faces[j], faces[i]];
    }
    setTiles(prev => {
      let fi = 0;
      return prev.map(tp => tp.removed ? tp : { ...tp, face: faces[fi++] });
    });
    setSelected(null); setHintTiles(new Set());
  }, [tiles]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  // ── Board bounds ──────────────────────────────────────────────────────────
  const boardBounds = useMemo(() => {
    const active = tiles.filter(tp => !tp.removed);
    if (active.length === 0) return { width: 0, height: 0 };
    const maxCol = Math.max(...active.map(tp => tp.col));
    const maxRow = Math.max(...active.map(tp => tp.row));
    const maxLayer = Math.max(...active.map(tp => tp.layer));
    return {
      width: (maxCol + 2) * GRID + maxLayer * EDGE + FACE_W - GRID * 2 + GRID + 16,
      height: (maxRow + 2) * GRID + maxLayer * EDGE + FACE_H - GRID * 2 + GRID + 16,
    };
  }, [tiles]);

  // ── Menu ──────────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    const difficulties: { key: LayoutDifficulty; color: string; borderColor: string; label: string }[] = [
      { key: 'easy', color: 'text-emerald-400', borderColor: 'border-emerald-800/40', label: t('mahjong.difficulty.easy') },
      { key: 'medium', color: 'text-amber-400', borderColor: 'border-amber-800/40', label: t('mahjong.difficulty.medium') },
      { key: 'hard', color: 'text-rose-400', borderColor: 'border-rose-800/40', label: t('mahjong.difficulty.hard') },
    ];

    return (
      <div className="flex flex-col items-center gap-6 py-6 px-4 max-w-3xl mx-auto">
        <div className="text-center">
          <h2 className="text-3xl font-black text-zinc-100">{t('game.name.mahjong')}</h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">{t('mahjong.desc')}</p>
        </div>

        {hasSaved && (
          <button
            onClick={handleContinue}
            className="w-full max-w-xs px-6 py-3 rounded-xl border border-emerald-700/50 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 font-semibold transition-all"
          >
            {t('game.continue')}
          </button>
        )}

        {difficulties.map(diff => {
          const layouts = LAYOUTS.filter(l => l.difficulty === diff.key);
          const doneCount = layouts.filter(l => completed.has(l.id)).length;
          return (
            <div key={diff.key} className="w-full">
              <div className={`flex items-center gap-3 mb-3 ${diff.color}`}>
                <div className={`h-px flex-1 ${diff.borderColor} border-t`} />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">
                  {diff.label}
                  <span className="ml-2 text-[10px] opacity-60">{doneCount}/{layouts.length}</span>
                </span>
                <div className={`h-px flex-1 ${diff.borderColor} border-t`} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {layouts.map((l, idx) => (
                  <LayoutCard
                    key={l.id}
                    layoutId={l.id}
                    label={t(`mahjong.layout.${l.id}`)}
                    locked={!unlocked.has(l.id)}
                    done={completed.has(l.id)}
                    lockHint={t('mahjong.lockHint')}
                    onClick={() => startGame(l.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  const sortedTiles = [...tiles]
    .filter(tp => !tp.removed)
    .sort((a, b) => a.layer - b.layer || a.row - b.row || a.col - b.col);

  return (
    <div className="flex flex-col items-center gap-2 py-2 px-2 flex-1 min-h-0">
      {/* Stats bar */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <StatBox label={t('mahjong.tiles')} value={String(remaining)} />
        <StatBox label={t('mahjong.pairs')} value={String(pairs)} />
        <StatBox label={t('mahjong.moves')} value={String(moves)} />
        <StatBox label={t('mahjong.time')} value={formatTime(elapsed)} />
        <div className="flex gap-1.5">
          <ToolBtn onClick={handleHint} variant="amber">{t('mahjong.hint')}</ToolBtn>
          <ToolBtn onClick={handleShuffle}>{t('mahjong.shuffle')}</ToolBtn>
          <ToolBtn onClick={() => { clearSave(SAVE_ID); setPhase('menu'); }}>{t('mahjong.back')}</ToolBtn>
        </div>
      </div>

      {/* Board — green felt background */}
      <div
        className="flex-1 min-h-0 w-full flex items-center justify-center overflow-auto scrollbar-none rounded-xl border border-emerald-900/30"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, #1e3f2e, #0f2a1c 70%)' }}
      >
        <div className="relative" style={{ width: boardBounds.width, height: boardBounds.height }}>
          {sortedTiles.map(tile => (
            <MahjongTileView
              key={tile.id}
              tile={tile}
              tiles={tiles}
              selected={selected === tile.id}
              matched={matchAnim.has(tile.id)}
              wrong={wrongAnim.has(tile.id)}
              hinted={hintTiles.has(tile.id)}
              onClick={handleTileClick}
            />
          ))}
        </div>
      </div>

      {/* Win overlay */}
      {phase === 'won' && (
        <Overlay>
          <p className="text-3xl font-black text-emerald-300">{t('mahjong.won')}</p>
          <div className="flex gap-4 text-sm text-zinc-400">
            <span>{t('mahjong.time')}: {formatTime(elapsed)}</span>
            <span>{t('mahjong.moves')}: {moves}</span>
          </div>
          {canPickUnlock && (() => {
            const meta = LAYOUTS.find(l => l.id === layoutId);
            if (!meta) return null;
            const pickable = LAYOUTS.filter(l => l.difficulty === meta.difficulty && !completed.has(l.id) && !unlocked.has(l.id));
            if (pickable.length === 0) return null;
            return (
              <div className="flex flex-col items-center gap-2 mt-1">
                <span className="text-sm text-indigo-300 font-semibold">{t('mahjong.pickUnlock')}</span>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {pickable.map(l => (
                    <button
                      key={l.id}
                      onClick={() => handlePickUnlock(l.id)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg border border-indigo-700/50 bg-indigo-950/40 hover:bg-indigo-900/50 hover:border-indigo-600/60 transition-all"
                    >
                      <LayoutPreview positions={getLayout(l.id)} />
                      <span className="text-xs text-indigo-200 font-semibold">{t(`mahjong.layout.${l.id}`)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
          <button onClick={() => { setCanPickUnlock(false); setPhase('menu'); }} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
            {t('game.newGame')}
          </button>
        </Overlay>
      )}

      {/* Lost overlay */}
      {phase === 'lost' && (
        <Overlay>
          <p className="text-2xl font-black text-rose-400">{t('mahjong.noMoves')}</p>
          <p className="text-sm text-zinc-400">{remaining} {t('mahjong.tilesRemaining')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => { setPhase('playing'); handleShuffle(); }}
              className="px-5 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-semibold transition-colors"
            >
              {t('mahjong.shuffle')}
            </button>
            <button onClick={() => setPhase('menu')} className="px-5 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:text-zinc-100 font-semibold transition-colors">
              {t('game.newGame')}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ── Layout card with mini preview ───────────────────────────────────────────

function LayoutCard({ layoutId, label, locked, done, lockHint, onClick }: {
  layoutId: LayoutId;
  label: string;
  locked: boolean;
  done: boolean;
  lockHint?: string;
  onClick: () => void;
}) {
  const positions = useMemo(() => getLayout(layoutId), [layoutId]);

  return (
    <div className="relative group/card">
      <button
        onClick={locked ? undefined : onClick}
        disabled={locked}
        className={`w-full flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
          locked
            ? 'border-zinc-800/60 bg-zinc-900/30 cursor-not-allowed opacity-50'
            : done
              ? 'group/card border-emerald-800/40 bg-zinc-800/40 hover:bg-zinc-700/40 hover:border-emerald-700/50'
              : 'group/card border-zinc-700/60 bg-zinc-800/40 hover:bg-zinc-700/40 hover:border-zinc-600'
        }`}
      >
        {/* Lock overlay */}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center z-10 rounded-xl">
            <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        )}

        {/* Done check */}
        {done && !locked && (
          <div className="absolute top-1.5 right-1.5 z-10">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        <div className={locked ? 'blur-[2px]' : ''}>
          <LayoutPreview positions={positions} />
        </div>
        <span className={`text-xs font-semibold transition-colors truncate w-full text-center ${
          locked ? 'text-zinc-600' : done ? 'text-emerald-400 group-hover/card:text-emerald-300' : 'text-zinc-300 group-hover/card:text-zinc-100'
        }`}>
          {label}
        </span>
      </button>

      {/* Tooltip on hover for locked cards */}
      {locked && lockHint && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-[11px] text-zinc-300 whitespace-nowrap opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
          {lockHint}
        </div>
      )}
    </div>
  );
}

function LayoutPreview({ positions }: { positions: LayoutPosition[] }) {
  const W = 120, H = 72;

  const { dots, maxLayer } = useMemo(() => {
    if (positions.length === 0) return { dots: [], maxLayer: 0 };
    const maxCol = Math.max(...positions.map(p => p.col)) + 2;
    const maxRow = Math.max(...positions.map(p => p.row)) + 2;
    const ml = Math.max(...positions.map(p => p.layer));
    const scaleX = (W - 4) / maxCol;
    const scaleY = (H - 4) / maxRow;
    const scale = Math.min(scaleX, scaleY);
    const ofsX = (W - maxCol * scale) / 2;
    const ofsY = (H - maxRow * scale) / 2;

    const d = positions.map(p => ({
      x: ofsX + p.col * scale + p.layer * 0.8,
      y: ofsY + p.row * scale - p.layer * 0.8,
      w: Math.max(scale * 1.7, 2.5),
      h: Math.max(scale * 1.7, 3),
      layer: p.layer,
    }));
    return { dots: d, maxLayer: ml };
  }, [positions]);

  return (
    <div
      className="rounded-lg overflow-hidden flex-shrink-0"
      style={{
        width: W,
        height: H,
        background: 'radial-gradient(ellipse at 50% 40%, #1a3528, #0d1f15 80%)',
      }}
    >
      <svg width={W} height={H}>
        {dots.map((d, i) => {
          const lp = maxLayer > 0 ? d.layer / maxLayer : 0;
          const brightness = 0.45 + lp * 0.55;
          return (
            <rect
              key={i}
              x={d.x}
              y={d.y}
              width={d.w}
              height={d.h}
              rx={0.5}
              fill={`rgba(232, 224, 208, ${brightness})`}
              stroke="rgba(160, 140, 110, 0.2)"
              strokeWidth={0.3}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ── Tile component ──────────────────────────────────────────────────────────

function MahjongTileView({
  tile, tiles, selected, matched, wrong, hinted, onClick,
}: {
  tile: MahjongTile;
  tiles: MahjongTile[];
  selected: boolean;
  matched: boolean;
  wrong: boolean;
  hinted: boolean;
  onClick: (id: number) => void;
}) {
  const free = isTileFree(tile, tiles);

  const x = tile.col * GRID + tile.layer * EDGE;
  const y = tile.row * GRID - tile.layer * EDGE;
  const z = tile.layer * 100 + tile.row;

  let faceBg = '#e8e0d0';
  let borderColor = '#b8a88a';
  let edgeColor = '#9a8a6a';
  let shadowOpacity = 0.3;

  if (selected) {
    faceBg = '#c5d5f5';
    borderColor = '#6b8fd4';
    edgeColor = '#5070b0';
  } else if (matched) {
    faceBg = '#b0e8c0';
    borderColor = '#50b070';
    edgeColor = '#408060';
  } else if (wrong) {
    faceBg = '#f0c0c0';
    borderColor = '#d06060';
    edgeColor = '#b04040';
  } else if (hinted) {
    faceBg = '#f0e0a0';
    borderColor = '#c0a040';
    edgeColor = '#a08030';
  } else if (!free) {
    faceBg = '#d0c8b8';
    borderColor = '#a09880';
    edgeColor = '#887860';
    shadowOpacity = 0.15;
  }

  const charColor = faceColor(tile.face.suit, tile.face.value);

  return (
    <button
      onClick={() => onClick(tile.id)}
      disabled={!free}
      className={`absolute select-none transition-all duration-150 ${free ? 'cursor-pointer hover:brightness-105' : 'cursor-default'}`}
      style={{
        left: x,
        top: y,
        width: FACE_W,
        height: FACE_H + EDGE,
        zIndex: selected ? 9999 : z,
        animation: matched ? 'tile-pop 300ms ease-out' : undefined,
        transform: selected ? 'translateY(-3px) scale(1.04)' : undefined,
        filter: matched ? 'brightness(1.1)' : undefined,
      }}
    >
      <div
        className="absolute bottom-0 rounded-b-md"
        style={{
          left: 1,
          right: 0,
          height: EDGE + 3,
          background: `linear-gradient(to bottom, ${edgeColor}, ${edgeColor}cc)`,
          borderRadius: '0 0 5px 5px',
        }}
      />
      <div
        className="absolute top-0 left-0"
        style={{
          width: 3,
          height: FACE_H + 1,
          background: `linear-gradient(to right, ${edgeColor}dd, ${borderColor}88)`,
          borderRadius: '5px 0 0 5px',
        }}
      />
      <div
        className="absolute top-0 left-0 flex flex-col items-center justify-center rounded-md overflow-hidden"
        style={{
          width: FACE_W,
          height: FACE_H,
          background: `linear-gradient(160deg, ${faceBg} 0%, ${faceBg}e0 60%, ${faceBg}cc 100%)`,
          border: `1.5px solid ${borderColor}`,
          boxShadow: `2px 3px ${4 + tile.layer * 2}px rgba(0,0,0,${shadowOpacity}), inset 0 1px 0 rgba(255,255,255,0.3)`,
        }}
      >
        <span
          className={`font-bold leading-none ${charColor}`}
          style={{ fontSize: tile.face.suit === 'circle' ? 20 : 24 }}
        >
          {tileChar(tile.face)}
        </span>
        <span
          className="leading-none mt-0.5"
          style={{ fontSize: 9, color: '#8a7a68', opacity: 0.6 }}
        >
          {suitIndicator(tile.face.suit)}
        </span>
      </div>
    </button>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</span>
      <span className="text-sm font-bold text-zinc-200 tabular-nums">{value}</span>
    </div>
  );
}

function ToolBtn({ children, onClick, variant }: { children: React.ReactNode; onClick: () => void; variant?: 'amber' }) {
  const cls = variant === 'amber'
    ? 'bg-amber-900/40 border-amber-800/50 text-amber-300 hover:bg-amber-800/40'
    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200';
  return (
    <button onClick={onClick} className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${cls}`}>
      {children}
    </button>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 bg-zinc-950/85 flex flex-col items-center justify-center gap-4 backdrop-blur-[2px] z-30 rounded-xl">
      {children}
    </div>
  );
}
