'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { usePersonalScores } from '@/hooks/usePersonalScores';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { ScoreboardPanel } from '@/components/ui/ScoreboardPanel';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import * as sfx from './sound';

// ── Constants ────────────────────────────────────────────────────────────────

const GAME_W = 480;
const GAME_H = 640;

const BIRD_SIZE = 28;
const BIRD_X = 80;

const PIPE_WIDTH = 52;

const COUNTDOWN_STEPS = 3;
const COUNTDOWN_STEP_MS = 700;
const PIPE_MIN_TOP = 60;
const PIPE_MAX_BOTTOM = 60;

const GROUND_H = 40;

const BEST_KEY = 'webgames.flappy.bestScore';

// ── Difficulty ──────────────────────────────────────────────────────────────

type FlappyDifficulty = 'easy' | 'normal' | 'hard' | 'insane';

const DIFFICULTIES: FlappyDifficulty[] = ['easy', 'normal', 'hard', 'insane'];

const DIFF_CONFIG: Record<FlappyDifficulty, {
  gravity: number;
  flapVel: number;
  maxVel: number;
  pipeGap: number;
  pipeSpeedBase: number;
  pipeSpeedInc: number;
  pipeSpeedCap: number;
  pipeInterval: number;
}> = {
  easy:   { gravity: 0.25, flapVel: -6.0, maxVel: 6,   pipeGap: 190, pipeSpeedBase: 1.6, pipeSpeedInc: 0.015, pipeSpeedCap: 2.8, pipeInterval: 100 },
  normal: { gravity: 0.32, flapVel: -6.5, maxVel: 7,   pipeGap: 160, pipeSpeedBase: 2.0, pipeSpeedInc: 0.025, pipeSpeedCap: 3.6, pipeInterval: 90 },
  hard:   { gravity: 0.38, flapVel: -7.0, maxVel: 8,   pipeGap: 130, pipeSpeedBase: 2.4, pipeSpeedInc: 0.035, pipeSpeedCap: 4.2, pipeInterval: 80 },
  insane: { gravity: 0.42, flapVel: -7.5, maxVel: 9,   pipeGap: 105, pipeSpeedBase: 2.8, pipeSpeedInc: 0.045, pipeSpeedCap: 5.0, pipeInterval: 70 },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface Pipe {
  x: number;
  gapY: number; // center of the gap
  scored: boolean;
  id: number;
}

type Phase = 'idle' | 'countdown' | 'playing' | 'paused' | 'over';

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadBest(): number {
  if (typeof window === 'undefined') return 0;
  const v = localStorage.getItem(BEST_KEY);
  return v ? Number(v) || 0 : 0;
}

function saveBest(score: number) {
  localStorage.setItem(BEST_KEY, String(score));
}

// ── Component ────────────────────────────────────────────────────────────────

export function FlappyGame() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { nickname } = useNickname();
  const ach = useAchievements('flappy');
  const pb = usePersonalScores('flappy', user ? { userId: user.id, nickname } : undefined);

  // ── State ────────────────────────────────────────────────────────────────
  const [difficulty, setDifficulty] = useState<FlappyDifficulty>('normal');
  const diffRef = useRef<FlappyDifficulty>('normal');

  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [birdY, setBirdY] = useState(GAME_H / 2 - BIRD_SIZE / 2);
  const [birdVel, setBirdVel] = useState(0);
  const [birdAngle, setBirdAngle] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [scoreFlash, setScoreFlash] = useState(false);
  const [countdownNum, setCountdownNum] = useState(0);

  // Refs for the game loop (avoids stale closures)
  const phaseRef = useRef<Phase>('idle');
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const birdYRef = useRef(GAME_H / 2 - BIRD_SIZE / 2);
  const birdVelRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const frameRef = useRef(0);
  const pipeIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync refs
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Achievement tracking
  useEffect(() => {
    if (phase === 'playing') ach.trackPlay();
    if (phase === 'idle') ach.reset();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Achievement flag tracking
  useEffect(() => {
    if (phase !== 'playing') return;
    if (score >= 50) ach.trackEvent({ type: 'flag', key: 'flappy_score_50' });
  }, [score, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load persisted data
  useEffect(() => {
    const b = loadBest();
    setBest(b);
    bestRef.current = b;
  }, []);

  // ── Game loop ──────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    if (phaseRef.current !== 'playing') return;

    const cfg = DIFF_CONFIG[diffRef.current];
    const currentScore = scoreRef.current;
    const speed = Math.min(cfg.pipeSpeedBase + currentScore * cfg.pipeSpeedInc, cfg.pipeSpeedCap);

    // Bird physics
    let vel = birdVelRef.current + cfg.gravity;
    if (vel > cfg.maxVel) vel = cfg.maxVel;
    let y = birdYRef.current + vel;
    birdVelRef.current = vel;
    birdYRef.current = y;

    // Angle based on velocity
    const angle = Math.min(Math.max(vel * 3, -30), 70);

    // Pipe spawning
    frameRef.current += 1;
    let currentPipes = pipesRef.current;
    if (frameRef.current % cfg.pipeInterval === 0) {
      const minGapCenter = PIPE_MIN_TOP + cfg.pipeGap / 2;
      const maxGapCenter = GAME_H - GROUND_H - PIPE_MAX_BOTTOM - cfg.pipeGap / 2;
      const gapY = minGapCenter + Math.random() * (maxGapCenter - minGapCenter);
      pipeIdRef.current += 1;
      currentPipes = [...currentPipes, { x: GAME_W + 10, gapY, scored: false, id: pipeIdRef.current }];
    }

    // Move pipes + score + cull
    let newScore = currentScore;
    const updatedPipes: Pipe[] = [];
    for (const pipe of currentPipes) {
      const nx = pipe.x - speed;
      if (nx + PIPE_WIDTH < -10) continue; // off-screen
      let scored = pipe.scored;
      if (!scored && nx + PIPE_WIDTH < BIRD_X) {
        scored = true;
        newScore += 1;
      }
      updatedPipes.push({ ...pipe, x: nx, scored });
    }
    pipesRef.current = updatedPipes;

    // Collision detection
    const birdTop = y;
    const birdBottom = y + BIRD_SIZE;
    const birdLeft = BIRD_X;
    const birdRight = BIRD_X + BIRD_SIZE;
    let dead = false;

    // Ground / ceiling
    if (birdBottom >= GAME_H - GROUND_H || birdTop <= 0) {
      dead = true;
      if (birdBottom >= GAME_H - GROUND_H) {
        y = GAME_H - GROUND_H - BIRD_SIZE;
        birdYRef.current = y;
      }
    }

    // Pipe collision
    if (!dead) {
      for (const pipe of updatedPipes) {
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + PIPE_WIDTH;
        if (birdRight > pipeLeft && birdLeft < pipeRight) {
          const gapTop = pipe.gapY - cfg.pipeGap / 2;
          const gapBottom = pipe.gapY + cfg.pipeGap / 2;
          if (birdTop < gapTop || birdBottom > gapBottom) {
            dead = true;
            break;
          }
        }
      }
    }

    // Update score state
    if (newScore !== currentScore) {
      sfx.scoreSound();
      scoreRef.current = newScore;
      setScore(newScore);
      setScoreFlash(true);
      setTimeout(() => setScoreFlash(false), 200);
    }

    // Commit visual state
    setBirdY(y);
    setBirdVel(vel);
    setBirdAngle(angle);
    setPipes(updatedPipes);

    if (dead) {
      sfx.hitSound();
      phaseRef.current = 'over';
      setPhase('over');
      // Save best
      if (newScore > bestRef.current) {
        bestRef.current = newScore;
        setBest(newScore);
        saveBest(newScore);
      }
      if (!savedRef.current) {
        savedRef.current = true;
        pb.submit(newScore);
      }
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  // Start/stop loop based on phase
  useEffect(() => {
    if (phase === 'playing') {
      startLoop();
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, startLoop]);

  // ── Countdown helper ───────────────────────────────────────────────────
  const startCountdown = useCallback((thenFlap: boolean) => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    // Reset game state
    birdYRef.current = GAME_H / 2 - BIRD_SIZE / 2;
    birdVelRef.current = 0;
    pipesRef.current = [];
    frameRef.current = 0;
    pipeIdRef.current = 0;
    scoreRef.current = 0;
    savedRef.current = false;
    setScore(0);
    setBirdY(GAME_H / 2 - BIRD_SIZE / 2);
    setBirdVel(0);
    setBirdAngle(0);
    setPipes([]);

    setPhase('countdown');
    phaseRef.current = 'countdown';
    setCountdownNum(COUNTDOWN_STEPS);
    sfx.countdownBeep();

    let step = COUNTDOWN_STEPS;
    const advance = () => {
      step -= 1;
      if (step > 0) {
        sfx.countdownBeep();
        setCountdownNum(step);
        countdownTimerRef.current = setTimeout(advance, COUNTDOWN_STEP_MS);
      } else {
        // Go!
        sfx.countdownGo();
        setCountdownNum(0);
        countdownTimerRef.current = null;
        if (thenFlap) {
          const fv = DIFF_CONFIG[diffRef.current].flapVel;
          birdVelRef.current = fv;
          setBirdVel(fv);
        }
        phaseRef.current = 'playing';
        setPhase('playing');
      }
    };
    countdownTimerRef.current = setTimeout(advance, COUNTDOWN_STEP_MS);
  }, []);

  // Clean up countdown timer on unmount
  useEffect(() => {
    return () => { if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current); };
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────
  const flap = useCallback(() => {
    if (phaseRef.current === 'idle') {
      startCountdown(true);
      return;
    }
    if (phaseRef.current === 'playing') {
      sfx.flapSound();
      const fv = DIFF_CONFIG[diffRef.current].flapVel;
      birdVelRef.current = fv;
      setBirdVel(fv);
    }
  }, [startCountdown]);

  const restart = useCallback(() => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    if (phaseRef.current === 'over') {
      startCountdown(true);
    } else {
      birdYRef.current = GAME_H / 2 - BIRD_SIZE / 2;
      birdVelRef.current = 0;
      pipesRef.current = [];
      frameRef.current = 0;
      pipeIdRef.current = 0;
      scoreRef.current = 0;
      savedRef.current = false;
      setScore(0);
      setBirdY(GAME_H / 2 - BIRD_SIZE / 2);
      setBirdVel(0);
      setBirdAngle(0);
      setPipes([]);
      setPhase('idle');
      phaseRef.current = 'idle';
    }
  }, [startCountdown]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      phaseRef.current = 'paused';
      setPhase('paused');
    } else if (phaseRef.current === 'paused') {
      phaseRef.current = 'playing';
      setPhase('playing');
    }
  }, []);

  // ── Auto-pause on tab switch ──────────────────────────────────────────
  useVisibilityPause(phase === 'playing', togglePause);

  // ── Input ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        flap();
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        restart();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flap, togglePause, restart]);

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 w-full mx-auto select-none flex-1 min-h-0">
      {/* Score bar */}
      <div className="shrink-0 flex items-center justify-between w-full max-w-xl px-1">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{t('lobby.games.flappy.title')}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className={`font-bold tabular-nums transition-all duration-150 ${scoreFlash ? 'text-indigo-300 scale-125' : 'text-zinc-100'}`}>
            {score}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400 text-xs">
            {t('game.best')}: <span className="font-bold text-zinc-200 tabular-nums">{best}</span>
          </span>
        </div>
      </div>

      {/* Game viewport — height-driven: frame fills available vertical space, width derived from aspect ratio */}
      <div className="flex-1 min-h-0 w-full flex justify-center">
        <div
          className="relative h-full overflow-hidden rounded-2xl border-2 border-zinc-800 bg-zinc-950"
          style={{ aspectRatio: `${GAME_W} / ${GAME_H}`, maxWidth: '100%' }}
          onClick={() => { if (phase !== 'over') flap(); }}
          onPointerDown={(e) => { if (phase !== 'over') { e.preventDefault(); } }}
        >
        {/* Scale inner to game coordinates */}
        <div className="absolute inset-0" style={{ containerType: 'size' }}>
          <div className="relative w-full h-full">

            {/* Stars / background dots */}
            <div className="absolute inset-0 overflow-hidden">
              {[12, 45, 78, 120, 200, 280, 350, 410].map((x, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-zinc-800"
                  style={{ left: `${(x / GAME_W) * 100}%`, top: `${((i * 67 + 30) % (GAME_H - GROUND_H)) / GAME_H * 100}%` }}
                />
              ))}
            </div>

            {/* Pipes */}
            {pipes.map((pipe) => {
              const renderGap = DIFF_CONFIG[difficulty].pipeGap;
              const gapTop = pipe.gapY - renderGap / 2;
              const gapBottom = pipe.gapY + renderGap / 2;
              return (
                <div key={pipe.id}>
                  {/* Top pipe */}
                  <div
                    className="absolute bg-emerald-700 border-b-[3px] border-emerald-500 rounded-b-md transition-opacity duration-300"
                    style={{
                      left: `${(pipe.x / GAME_W) * 100}%`,
                      top: 0,
                      width: `${(PIPE_WIDTH / GAME_W) * 100}%`,
                      height: `${(gapTop / GAME_H) * 100}%`,
                      opacity: pipe.x > GAME_W - 30 ? 0 : 1,
                    }}
                  >
                    {/* Pipe cap */}
                    <div className="absolute bottom-0 left-[-4%] right-[-4%] h-[6%] bg-emerald-600 rounded-md" />
                  </div>
                  {/* Bottom pipe */}
                  <div
                    className="absolute bg-emerald-700 border-t-[3px] border-emerald-500 rounded-t-md transition-opacity duration-300"
                    style={{
                      left: `${(pipe.x / GAME_W) * 100}%`,
                      top: `${(gapBottom / GAME_H) * 100}%`,
                      width: `${(PIPE_WIDTH / GAME_W) * 100}%`,
                      height: `${((GAME_H - GROUND_H - gapBottom) / GAME_H) * 100}%`,
                      opacity: pipe.x > GAME_W - 30 ? 0 : 1,
                    }}
                  >
                    {/* Pipe cap */}
                    <div className="absolute top-0 left-[-4%] right-[-4%] h-[6%] bg-emerald-600 rounded-md" />
                  </div>
                </div>
              );
            })}

            {/* Bird */}
            <div
              className="absolute rounded-full bg-amber-400 border-2 border-amber-500 shadow-lg shadow-amber-500/20 z-10"
              style={{
                left: `${(BIRD_X / GAME_W) * 100}%`,
                top: `${(birdY / GAME_H) * 100}%`,
                width: `${(BIRD_SIZE / GAME_W) * 100}%`,
                height: `${(BIRD_SIZE / GAME_H) * 100}%`,
                transform: `rotate(${birdAngle}deg)`,
                transition: 'transform 0.1s ease-out',
              }}
            >
              {/* Eye */}
              <div
                className="absolute bg-white rounded-full"
                style={{ width: '30%', height: '30%', top: '18%', right: '15%' }}
              >
                <div
                  className="absolute bg-zinc-900 rounded-full"
                  style={{ width: '55%', height: '55%', bottom: '10%', right: '10%' }}
                />
              </div>
              {/* Beak */}
              <div
                className="absolute bg-orange-500 rounded-sm"
                style={{ width: '28%', height: '18%', top: '50%', right: '-12%' }}
              />
            </div>

            {/* Ground */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-zinc-800 border-t-2 border-zinc-700"
              style={{ height: `${(GROUND_H / GAME_H) * 100}%` }}
            >
              <div className="w-full h-full flex items-end justify-center overflow-hidden gap-[3%]">
                {Array.from({ length: 16 }, (_, i) => (
                  <div key={i} className="w-[3%] h-[40%] bg-zinc-750 rounded-t-sm bg-zinc-700/50" />
                ))}
              </div>
            </div>

            {/* ── Overlays ──────────────────────────────────────────────── */}

            {/* Start */}
            {phase === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] z-20">
                <div className="text-3xl font-black text-amber-400 mb-2 drop-shadow-lg">{t('game.name.flappy')}</div>
                <p className="text-sm text-zinc-300 mb-4">{t('lobby.games.flappy.desc')}</p>

                {/* Difficulty selector */}
                <div className="flex flex-col items-center gap-1.5 mb-5">
                  <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">{t('flappy.difficulty')}</span>
                  <div className="flex gap-1.5">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d}
                        onClick={(e) => { e.stopPropagation(); setDifficulty(d); diffRef.current = d; }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                          difficulty === d
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        {t(`flappy.diff.${d}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); flap(); }}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-indigo-900/40"
                >
                  {t('flappy.startButton')}
                </button>
                <p className="text-[11px] text-zinc-500 mt-4">{t('flappy.idleHint')}</p>
              </div>
            )}

            {/* Countdown */}
            {phase === 'countdown' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-20">
                <span className="text-7xl font-black text-white drop-shadow-lg tabular-nums animate-pulse">
                  {countdownNum}
                </span>
              </div>
            )}

            {/* Paused */}
            {phase === 'paused' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] z-20">
                <div className="text-2xl font-black text-zinc-100 mb-4">{t('game.paused')}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); togglePause(); }}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all active:scale-95"
                >
                  {t('game.resume')}
                </button>
              </div>
            )}

            {/* Game Over */}
            {phase === 'over' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
                <div className="text-2xl font-black text-rose-400 mb-1">{t('game.over')}</div>
                <div className="text-4xl font-black text-zinc-100 mb-1 tabular-nums">{score}</div>
                {score >= best && score > 0 && (
                  <span className="text-xs font-bold text-amber-400 mb-3">{t('game.newBest')}</span>
                )}
                <div className="text-xs text-zinc-400 mb-5">
                  {t('game.best')}: <span className="text-zinc-200 font-bold tabular-nums">{best}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); restart(); }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all active:scale-95"
                  >
                    {t('game.restart')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Mobile controls */}
      <div className="shrink-0 flex gap-2 w-full max-w-xl sm:hidden">
        <button
          onPointerDown={(e) => { e.preventDefault(); flap(); }}
          className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm active:scale-[0.97] transition-all"
        >
          {t('flappy.flap')}
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); togglePause(); }}
          className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 font-semibold text-sm active:scale-[0.97] transition-all"
        >
          ⏸
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); restart(); }}
          className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 font-semibold text-sm active:scale-[0.97] transition-all"
        >
          ↺
        </button>
      </div>

      {/* Controls legend (desktop) */}
      <div className="shrink-0 hidden sm:flex items-center gap-4 text-[11px] text-zinc-600">
        <span>{t('flappy.controls.flap')}</span>
        <span>{t('flappy.controls.pause')}</span>
        <span>{t('flappy.controls.restart')}</span>
      </div>

      {/* Personal best list */}
      <div className="shrink-0 w-full flex justify-center pb-4">
        <ScoreboardPanel
          gameId="flappy"
          scores={pb.scores}
          lastInsertId={pb.lastInsertId}
          isNewBest={pb.isNewBest}
          onClear={pb.clear}
        />
      </div>
    </div>
  );
}
