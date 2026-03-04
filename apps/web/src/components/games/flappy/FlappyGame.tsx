'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';

// ── Constants ────────────────────────────────────────────────────────────────

const GAME_W = 480;
const GAME_H = 640;

const BIRD_SIZE = 28;
const BIRD_X = 80;

const GRAVITY = 0.32;
const FLAP_VELOCITY = -6.5;    // set (not additive)
const MAX_FALL_SPEED = 7;      // terminal velocity

const PIPE_WIDTH = 52;
const PIPE_GAP = 160;
const PIPE_SPEED_BASE = 2.0;
const PIPE_SPEED_INC = 0.025;  // per score point
const PIPE_SPEED_CAP = 3.6;

const COUNTDOWN_STEPS = 3;
const COUNTDOWN_STEP_MS = 700;
const PIPE_SPAWN_INTERVAL = 90; // frames (~1.5 s at 60 fps)
const PIPE_MIN_TOP = 60;
const PIPE_MAX_BOTTOM = 60;

const GROUND_H = 40;

const BEST_KEY = 'webgames.flappy.bestScore';
const HS_KEY = 'webgames.flappy.highscores';

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

interface HighscoreEntry {
  id: string;
  score: number;
  date: number;
}

function loadHighscores(): HighscoreEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HighscoreEntry[];
  } catch { return []; }
}

function addHighscore(score: number): HighscoreEntry[] {
  const list = loadHighscores();
  list.push({ id: Date.now().toString(), score, date: Date.now() });
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 10);
  localStorage.setItem(HS_KEY, JSON.stringify(trimmed));
  return trimmed;
}

// ── Component ────────────────────────────────────────────────────────────────

export function FlappyGame() {
  const { t } = useI18n();

  // ── State ────────────────────────────────────────────────────────────────
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

  // Load persisted data
  useEffect(() => {
    const b = loadBest();
    setBest(b);
    bestRef.current = b;
  }, []);

  // ── Game loop ──────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    if (phaseRef.current !== 'playing') return;

    const currentScore = scoreRef.current;
    const speed = Math.min(PIPE_SPEED_BASE + currentScore * PIPE_SPEED_INC, PIPE_SPEED_CAP);

    // Bird physics
    let vel = birdVelRef.current + GRAVITY;
    if (vel > MAX_FALL_SPEED) vel = MAX_FALL_SPEED;
    let y = birdYRef.current + vel;
    birdVelRef.current = vel;
    birdYRef.current = y;

    // Angle based on velocity
    const angle = Math.min(Math.max(vel * 3, -30), 70);

    // Pipe spawning
    frameRef.current += 1;
    let currentPipes = pipesRef.current;
    if (frameRef.current % PIPE_SPAWN_INTERVAL === 0) {
      const minGapCenter = PIPE_MIN_TOP + PIPE_GAP / 2;
      const maxGapCenter = GAME_H - GROUND_H - PIPE_MAX_BOTTOM - PIPE_GAP / 2;
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
          const gapTop = pipe.gapY - PIPE_GAP / 2;
          const gapBottom = pipe.gapY + PIPE_GAP / 2;
          if (birdTop < gapTop || birdBottom > gapBottom) {
            dead = true;
            break;
          }
        }
      }
    }

    // Update score state
    if (newScore !== currentScore) {
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
        addHighscore(newScore);
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

    let step = COUNTDOWN_STEPS;
    const advance = () => {
      step -= 1;
      if (step > 0) {
        setCountdownNum(step);
        countdownTimerRef.current = setTimeout(advance, COUNTDOWN_STEP_MS);
      } else {
        // Go!
        setCountdownNum(0);
        countdownTimerRef.current = null;
        if (thenFlap) {
          birdVelRef.current = FLAP_VELOCITY;
          setBirdVel(FLAP_VELOCITY);
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
      birdVelRef.current = FLAP_VELOCITY;
      setBirdVel(FLAP_VELOCITY);
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
    <div className="flex flex-col items-center gap-2 sm:gap-3 w-full mx-auto select-none h-[calc(100dvh-7.5rem)]">
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
            Best: <span className="font-bold text-zinc-200 tabular-nums">{best}</span>
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
              const gapTop = pipe.gapY - PIPE_GAP / 2;
              const gapBottom = pipe.gapY + PIPE_GAP / 2;
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
                <div className="text-3xl font-black text-amber-400 mb-2 drop-shadow-lg">Flappy Bird</div>
                <p className="text-sm text-zinc-300 mb-6">{t('lobby.games.flappy.desc')}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); flap(); }}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-indigo-900/40"
                >
                  Space / Click
                </button>
                <p className="text-[11px] text-zinc-500 mt-4">P = Pause &middot; R = Restart</p>
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
                <div className="text-2xl font-black text-zinc-100 mb-4">{t('game.paused') || 'Pausiert'}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); togglePause(); }}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all active:scale-95"
                >
                  {t('game.resume') || 'Weiter'}
                </button>
              </div>
            )}

            {/* Game Over */}
            {phase === 'over' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
                <div className="text-2xl font-black text-rose-400 mb-1">Game Over</div>
                <div className="text-4xl font-black text-zinc-100 mb-1 tabular-nums">{score}</div>
                {score >= best && score > 0 && (
                  <span className="text-xs font-bold text-amber-400 mb-3">New Best!</span>
                )}
                <div className="text-xs text-zinc-400 mb-5">
                  Best: <span className="text-zinc-200 font-bold tabular-nums">{best}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); restart(); }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all active:scale-95"
                  >
                    {t('game.restart') || 'Nochmal'}
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
          Flap
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
        <span>Space/↑/Click = Flap</span>
        <span>P = Pause</span>
        <span>R = Restart</span>
      </div>
    </div>
  );
}
