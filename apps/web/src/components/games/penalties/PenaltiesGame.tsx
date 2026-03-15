'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { loadStats, saveStats, updateStats } from './stats';
import type { PenaltyStats } from './stats';
import * as sfx from './sound';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';

// ── Constants ────────────────────────────────────────────────────────────────

const W = 800;
const H = 520;

// Goal in perspective (trapezoid)
const GOAL_BOTTOM_W = 460;
const GOAL_TOP_W = 380;
const GOAL_H = 170;
const GOAL_CX = W / 2;
const GOAL_Y = 70;                           // top of crossbar
const GOAL_BOTTOM = GOAL_Y + GOAL_H;        // bottom (goal line)
const GOAL_BL = GOAL_CX - GOAL_BOTTOM_W / 2; // bottom-left post
const GOAL_BR = GOAL_CX + GOAL_BOTTOM_W / 2; // bottom-right post
const GOAL_TL = GOAL_CX - GOAL_TOP_W / 2;   // top-left corner
const GOAL_TR = GOAL_CX + GOAL_TOP_W / 2;   // top-right corner
const POST_W = 10;
const BALL_R = 12;
const NET_DEPTH = 40;

const ROUNDS = 5;
const PENALTY_SPOT_Y = H - 70;

type Difficulty = 'easy' | 'medium' | 'hard';
type Phase = 'menu' | 'aiming' | 'ball_flying' | 'saving' | 'gk_diving' | 'result_pause' | 'ended';
type Role = 'shooter' | 'goalkeeper';
type ShotResult = 'goal' | 'saved' | 'missed' | 'post';
type DiveDir = 'left' | 'center' | 'right';

interface RoundResult {
  round: number;
  role: Role;
  result: ShotResult;
}

interface BotConfig {
  gkReaction: number;
  shotAccuracy: number;
}

const BOT_CONFIG: Record<Difficulty, BotConfig> = {
  easy:   { gkReaction: 0.2,  shotAccuracy: 0.3 },
  medium: { gkReaction: 0.45, shotAccuracy: 0.6 },
  hard:   { gkReaction: 0.72, shotAccuracy: 0.85 },
};

// Interpolate x along goal posts at a given y
function goalLeftX(y: number): number {
  const t = (y - GOAL_Y) / GOAL_H;
  return GOAL_TL + (GOAL_BL - GOAL_TL) * t;
}
function goalRightX(y: number): number {
  const t = (y - GOAL_Y) / GOAL_H;
  return GOAL_TR + (GOAL_BR - GOAL_TR) * t;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PenaltiesGame() {
  const { t } = useI18n();
  const ach = useAchievements('penalties');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<Phase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [stats, setStats] = useState<PenaltyStats | null>(null);
  const [muted, setMuted] = useState(false);

  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentRole, setCurrentRole] = useState<Role>('shooter');
  const [results, setResults] = useState<RoundResult[]>([]);
  const [gameResult, setGameResult] = useState<'win' | 'loss' | 'draw' | null>(null);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const roleRef = useRef(currentRole);
  roleRef.current = currentRole;
  const drawRef = useRef<() => void>(() => {});
  const diffRef = useRef(difficulty);
  diffRef.current = difficulty;
  const rafRef = useRef(0);

  const aimRef = useRef({ x: W / 2, y: GOAL_Y + GOAL_H * 0.45 });

  const ballRef = useRef({
    startX: W / 2, startY: PENALTY_SPOT_Y,
    targetX: W / 2, targetY: GOAL_Y + GOAL_H * 0.45,
    progress: 0,
    currentX: W / 2, currentY: PENALTY_SPOT_Y,
    scale: 1,
    visible: true,
  });

  const gkRef = useRef({
    x: W / 2, y: GOAL_BOTTOM - 10,
    targetX: W / 2,
    diveDir: 'center' as DiveDir,
    diving: false,
    diveProgress: 0,
    holdingBall: false,
  });

  const kickerRef = useRef({
    x: W / 2, y: PENALTY_SPOT_Y + 40,
    kickProgress: 0,    // 0 = idle, 0→1 = kicking anim
    kicking: false,
  });

  const savingRef = useRef({
    chosenDir: null as DiveDir | null,
    botShotTarget: { x: W / 2, y: GOAL_Y + GOAL_H * 0.45 },
    showArrows: true,
  });

  const reflexRef = useRef({
    flashStart: 0,
    flashDuration: 400,
    delayMs: 600,
    targetX: 0,
    targetY: 0,
    active: false,
    clicked: false,
    phase: 'waiting' as 'waiting' | 'flashing' | 'done',
    savedByReflex: null as boolean | null,  // null = not decided, true = save, false = miss
    clickX: 0,
    clickY: 0,
  });

  const REFLEX_CONFIG: Record<Difficulty, { flashDuration: number; delay: [number, number] }> = {
    easy:   { flashDuration: 900, delay: [300, 500] },
    medium: { flashDuration: 650, delay: [300, 600] },
    hard:   { flashDuration: 400, delay: [400, 700] },
  };

  const resultRef = useRef<ShotResult | null>(null);
  const shotHeightRef = useRef<'low' | 'high'>('low');
  // Net ripple for goals
  const netRippleRef = useRef(0);

  // ── Load stats ──────────────────────────────────────────────────────────

  useEffect(() => {
    setStats(loadStats());
    setMuted(sfx.isMuted());
  }, []);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    sfx.setMuted(next);
  }

  useVisibilityPause(
    phase === 'aiming' || phase === 'saving',
    useCallback(() => {}, [])
  );

  // ── Start game ──────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    setPlayerScore(0);
    setBotScore(0);
    setCurrentRound(1);
    setCurrentRole('shooter');
    setResults([]);
    setGameResult(null);
    setIsSuddenDeath(false);
    resultRef.current = null;
    netRippleRef.current = 0;
    resetForShot();
    ach.trackPlay();
    sfx.whistleSound();
    setPhase('aiming');
  }, [ach]);

  // ── Check early end ────────────────────────────────────────────────────

  const checkEarlyEnd = useCallback((
    pScore: number, bScore: number, _round: number,
    role: Role, allResults: RoundResult[], suddenDeath: boolean
  ): boolean => {
    if (suddenDeath) {
      if (role === 'goalkeeper') {
        if (pScore !== bScore) return true;
      }
      return false;
    }
    const totalP = allResults.filter(r => r.role === 'shooter').length;
    const totalB = allResults.filter(r => r.role === 'goalkeeper').length;
    if (totalP >= ROUNDS && totalB >= ROUNDS) {
      if (pScore !== bScore) return true;
      return false;
    }
    const pLeft = ROUNDS - totalP;
    const bLeft = ROUNDS - totalB;
    if (pScore > bScore + bLeft) return true;
    if (bScore > pScore + pLeft) return true;
    return false;
  }, []);

  // ── Advance turn ──────────────────────────────────────────────────────

  const advanceTurn = useCallback((shotResult: ShotResult, role: Role) => {
    const isGoal = shotResult === 'goal';

    setResults(prev => [...prev, { round: currentRound, role, result: shotResult }]);

    let newPScore = playerScore;
    let newBScore = botScore;

    if (role === 'shooter' && isGoal) {
      newPScore = playerScore + 1;
      setPlayerScore(newPScore);
    } else if (role === 'goalkeeper' && isGoal) {
      newBScore = botScore + 1;
      setBotScore(newBScore);
    }

    setTimeout(() => {
      const allResults = [...results, { round: currentRound, role, result: shotResult }];

      if (checkEarlyEnd(newPScore, newBScore, currentRound, role, allResults, isSuddenDeath)) {
        const res = newPScore > newBScore ? 'win' : newPScore < newBScore ? 'loss' : 'draw';
        endGame(res, newPScore, newBScore, allResults);
        return;
      }

      if (role === 'shooter') {
        setCurrentRole('goalkeeper');
        setPhase('saving');
        setupBotShot();
      } else {
        const totalP = allResults.filter(r => r.role === 'shooter').length;
        const totalB = allResults.filter(r => r.role === 'goalkeeper').length;

        if (!isSuddenDeath && totalP >= ROUNDS && totalB >= ROUNDS) {
          if (newPScore === newBScore) {
            setIsSuddenDeath(true);
            setCurrentRound(ROUNDS + 1);
            setCurrentRole('shooter');
            resetForShot();
            setPhase('aiming');
            return;
          }
        }

        setCurrentRound(prev => prev + 1);
        setCurrentRole('shooter');
        resetForShot();
        setPhase('aiming');
      }
    }, 1800);
  }, [playerScore, botScore, currentRound, results, isSuddenDeath, checkEarlyEnd]);

  // ── End game ──────────────────────────────────────────────────────────

  const endGame = useCallback((result: 'win' | 'loss' | 'draw', pScore: number, bScore: number, allResults: RoundResult[]) => {
    setGameResult(result);
    setPhase('ended');

    if (result === 'win') {
      sfx.winSound();
      sfx.crowdCheer();
      ach.trackWin();
      ach.trackEvent({ type: 'flag', key: `penalties_win_${diffRef.current}` });
    } else {
      sfx.loseSound();
    }

    const scored = allResults.filter(r => r.role === 'shooter' && r.result === 'goal').length;
    const saved = allResults.filter(r => r.role === 'goalkeeper' && r.result === 'saved').length;

    const s = loadStats();
    const updated = updateStats(s, result, scored, saved);
    saveStats(updated);
    setStats(updated);
  }, [ach]);

  // ── Setup bot shot ────────────────────────────────────────────────────

  const setupBotShot = useCallback(() => {
    const cfg = BOT_CONFIG[diffRef.current];
    const zones = [
      { x: GOAL_CX - GOAL_BOTTOM_W * 0.35, y: GOAL_Y + GOAL_H * 0.6 },
      { x: GOAL_CX - GOAL_BOTTOM_W * 0.3,  y: GOAL_Y + GOAL_H * 0.25 },
      { x: GOAL_CX,                          y: GOAL_Y + GOAL_H * 0.4 },
      { x: GOAL_CX + GOAL_BOTTOM_W * 0.35, y: GOAL_Y + GOAL_H * 0.6 },
      { x: GOAL_CX + GOAL_BOTTOM_W * 0.3,  y: GOAL_Y + GOAL_H * 0.25 },
    ];
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const spread = (1 - cfg.shotAccuracy) * 70;
    const tx = zone.x + (Math.random() - 0.5) * spread;
    const ty = zone.y + (Math.random() - 0.5) * spread * 0.4;

    savingRef.current = { chosenDir: null, botShotTarget: { x: tx, y: ty }, showArrows: false };
    shotHeightRef.current = ty < GOAL_Y + GOAL_H * 0.4 ? 'high' : 'low';

    // Configure reflex timing based on difficulty
    const reflexCfg = REFLEX_CONFIG[diffRef.current];
    const delayMs = reflexCfg.delay[0] + Math.random() * (reflexCfg.delay[1] - reflexCfg.delay[0]);
    reflexRef.current = {
      flashStart: 0,
      flashDuration: reflexCfg.flashDuration,
      delayMs,
      targetX: tx,
      targetY: ty,
      active: false,
      clicked: false,
      phase: 'waiting',
      savedByReflex: null,
      clickX: 0,
      clickY: 0,
    };

    gkRef.current = {
      x: W / 2, y: GOAL_BOTTOM - 10,
      targetX: W / 2, diveDir: 'center', diving: false, diveProgress: 0, holdingBall: false,
    };
    ballRef.current = {
      startX: W / 2, startY: PENALTY_SPOT_Y,
      targetX: tx, targetY: ty,
      progress: 0, currentX: W / 2, currentY: PENALTY_SPOT_Y, scale: 1, visible: true,
    };
    kickerRef.current = { x: W / 2, y: PENALTY_SPOT_Y + 40, kickProgress: 0, kicking: false };
  }, []);

  // ── Reflex save timer ────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'saving') return;
    const reflex = reflexRef.current;
    reflex.phase = 'waiting';
    reflex.clicked = false;
    reflex.savedByReflex = null;

    let flashTimer: ReturnType<typeof setTimeout> | null = null;

    // After delay, start flashing
    const delayTimer = setTimeout(() => {
      if (phaseRef.current !== 'saving') return;
      reflex.phase = 'flashing';
      reflex.flashStart = Date.now();
      reflex.active = true;

      // After flash duration, end the flash window
      flashTimer = setTimeout(() => {
        if (phaseRef.current !== 'saving') return;
        reflex.phase = 'done';
        reflex.active = false;

        // If player didn't click in time, trigger the ball flight (likely goal)
        if (!reflex.clicked) {
          triggerReflexResult(false);
        }
      }, reflex.flashDuration);
    }, reflex.delayMs);

    return () => {
      clearTimeout(delayTimer);
      if (flashTimer) clearTimeout(flashTimer);
    };
  }, [phase]);

  // ── Trigger reflex result ──────────────────────────────────────────

  const triggerReflexResult = useCallback((saved: boolean) => {
    if (phaseRef.current !== 'saving') return;
    const reflex = reflexRef.current;
    const saving = savingRef.current;

    // Determine dive direction based on where the target is
    const targetX = saving.botShotTarget.x;
    let diveDir: DiveDir = 'center';
    if (saved && reflex.clicked) {
      // Dive toward the click position
      const clickX = reflex.clickX;
      if (clickX < W / 2 - 50) diveDir = 'left';
      else if (clickX > W / 2 + 50) diveDir = 'right';
      else diveDir = 'center';
    } else {
      // Missed reflex — dive toward target (too late)
      if (targetX < W / 2 - 50) diveDir = 'left';
      else if (targetX > W / 2 + 50) diveDir = 'right';
      else diveDir = 'center';
    }

    saving.chosenDir = diveDir;
    reflex.savedByReflex = saved;

    const diveTarget = diveDir === 'left' ? GOAL_BL + 50
      : diveDir === 'right' ? GOAL_BR - 50
      : W / 2;

    gkRef.current.diveDir = diveDir;
    gkRef.current.targetX = diveTarget;
    gkRef.current.diving = true;
    gkRef.current.diveProgress = 0;

    kickerRef.current.kicking = true;
    kickerRef.current.kickProgress = 0;

    sfx.kickSound();
    setPhase('gk_diving');
  }, []);

  // ── Handle reflex click ──────────────────────────────────────────────

  const handleReflexClick = useCallback((clickX: number, clickY: number) => {
    if (phaseRef.current !== 'saving') return;
    const reflex = reflexRef.current;
    if (reflex.clicked) return; // already clicked

    reflex.clicked = true;
    reflex.clickX = clickX;
    reflex.clickY = clickY;

    if (reflex.phase === 'flashing' && reflex.active) {
      // Calculate distance to crosshair target
      const dx = clickX - reflex.targetX;
      const dy = clickY - reflex.targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 80) {
        // Close enough — guaranteed save
        triggerReflexResult(true);
      } else if (dist <= 130) {
        // Near — 50% chance
        triggerReflexResult(Math.random() < 0.5);
      } else {
        // Too far — miss
        triggerReflexResult(false);
      }
    } else {
      // Clicked before flash or after flash — miss
      triggerReflexResult(false);
    }
  }, [triggerReflexResult]);

  // ── Reset ─────────────────────────────────────────────────────────────

  const resetForShot = useCallback(() => {
    gkRef.current = {
      x: W / 2, y: GOAL_BOTTOM - 10,
      targetX: W / 2, diveDir: 'center', diving: false, diveProgress: 0, holdingBall: false,
    };
    ballRef.current = {
      startX: W / 2, startY: PENALTY_SPOT_Y,
      targetX: W / 2, targetY: GOAL_Y + GOAL_H * 0.45,
      progress: 0, currentX: W / 2, currentY: PENALTY_SPOT_Y, scale: 1, visible: true,
    };
    kickerRef.current = { x: W / 2, y: PENALTY_SPOT_Y + 40, kickProgress: 0, kicking: false };
    aimRef.current = { x: W / 2, y: GOAL_Y + GOAL_H * 0.45 };
    resultRef.current = null;
    netRippleRef.current = 0;
  }, []);

  // ── Handle shoot ──────────────────────────────────────────────────────

  const handleShoot = useCallback(() => {
    if (phaseRef.current !== 'aiming') return;

    const aim = aimRef.current;
    const margin = 30;
    const tx = Math.max(GOAL_BL - margin, Math.min(GOAL_BR + margin, aim.x));
    const ty = Math.max(GOAL_Y - margin / 2, Math.min(GOAL_BOTTOM + margin / 2, aim.y));

    ballRef.current = {
      startX: W / 2, startY: PENALTY_SPOT_Y,
      targetX: tx, targetY: ty,
      progress: 0, currentX: W / 2, currentY: PENALTY_SPOT_Y, scale: 1, visible: true,
    };
    shotHeightRef.current = ty < GOAL_Y + GOAL_H * 0.4 ? 'high' : 'low';

    kickerRef.current.kicking = true;
    kickerRef.current.kickProgress = 0;

    const cfg = BOT_CONFIG[diffRef.current];
    const mid = W / 2;
    let diveDir: DiveDir = 'center';

    if (Math.random() < cfg.gkReaction) {
      if (tx < mid - 50) diveDir = 'left';
      else if (tx > mid + 50) diveDir = 'right';
      else diveDir = 'center';
    } else {
      const r = Math.random();
      if (r < 0.4) diveDir = 'left';
      else if (r < 0.8) diveDir = 'right';
      else diveDir = 'center';
    }

    const diveTarget = diveDir === 'left' ? GOAL_BL + 50
      : diveDir === 'right' ? GOAL_BR - 50
      : W / 2;

    gkRef.current.diveDir = diveDir;
    gkRef.current.targetX = diveTarget;
    gkRef.current.diving = true;
    gkRef.current.diveProgress = 0;

    sfx.kickSound();
    setPhase('ball_flying');
  }, []);

  // ── Input handlers ────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function getPos(e: MouseEvent | Touch) {
      const rect = canvas!.getBoundingClientRect();
      return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
    }

    function onMouseMove(e: MouseEvent) {
      const pos = getPos(e);
      if (phaseRef.current === 'aiming') {
        aimRef.current = {
          x: Math.max(GOAL_BL - 20, Math.min(GOAL_BR + 20, pos.x)),
          y: Math.max(GOAL_Y - 10, Math.min(GOAL_BOTTOM + 10, pos.y)),
        };
      }
    }

    function onClick(e: MouseEvent) {
      const pos = getPos(e);
      if (phaseRef.current === 'aiming') {
        aimRef.current = {
          x: Math.max(GOAL_BL - 20, Math.min(GOAL_BR + 20, pos.x)),
          y: Math.max(GOAL_Y - 10, Math.min(GOAL_BOTTOM + 10, pos.y)),
        };
        handleShoot();
      } else if (phaseRef.current === 'saving') {
        handleReflexClick(pos.x, pos.y);
      }
    }

    function onTouch(e: TouchEvent) {
      e.preventDefault();
      const pos = getPos(e.touches[0]);
      if (phaseRef.current === 'aiming') {
        aimRef.current = {
          x: Math.max(GOAL_BL - 20, Math.min(GOAL_BR + 20, pos.x)),
          y: Math.max(GOAL_Y - 10, Math.min(GOAL_BOTTOM + 10, pos.y)),
        };
        handleShoot();
      } else if (phaseRef.current === 'saving') {
        handleReflexClick(pos.x, pos.y);
      }
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onTouch);
    };
  }, [phase, handleShoot, handleReflexClick]);

  // Keyboard: Space bar triggers reflex click at goal center during saving
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phaseRef.current === 'saving' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        // Click at the reflex target position (best possible click)
        const reflex = reflexRef.current;
        handleReflexClick(reflex.targetX, reflex.targetY);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleReflexClick]);

  // ── Ball flight (shooting) ────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'ball_flying') return;

    const ball = ballRef.current;
    const gk = gkRef.current;
    const kicker = kickerRef.current;

    const interval = setInterval(() => {
      // Kicker animation first part
      if (kicker.kicking) {
        kicker.kickProgress = Math.min(kicker.kickProgress + 0.08, 1);
      }

      // Ball starts moving after kick wind-up
      if (kicker.kickProgress > 0.3) {
        const ballSpeed = 0.05;
        ball.progress = Math.min(ball.progress + ballSpeed, 1);
      }

      const p = ball.progress;
      const eased = 1 - Math.pow(1 - p, 2.5);
      const arcHeight = shotHeightRef.current === 'high' ? -150 : -60;
      const arc = arcHeight * Math.sin(p * Math.PI);
      ball.currentX = ball.startX + (ball.targetX - ball.startX) * eased;
      ball.currentY = ball.startY + (ball.targetY - ball.startY) * eased + arc;
      ball.scale = 1 - eased * 0.35;

      if (gk.diving) {
        gk.diveProgress = Math.min(gk.diveProgress + 0.05, 1);
        const dp = easeOutCubic(gk.diveProgress);
        gk.x = W / 2 + (gk.targetX - W / 2) * dp;
      }

      drawRef.current();

      if (p >= 1) {
        clearInterval(interval);
        const result = determineShotResult(ball.targetX, ball.targetY, gk.x, gk.diveDir);
        resultRef.current = result;

        if (result === 'saved') {
          gk.holdingBall = true;
          ball.visible = false;
          sfx.saveSound();
        } else if (result === 'goal') {
          netRippleRef.current = 1;
          sfx.goalSound();
          sfx.crowdCheer();
        } else {
          sfx.missSound();
        }

        drawRef.current();
        setPhase('result_pause');
        setTimeout(() => advanceTurn(result, 'shooter'), 100);
      }
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [phase, advanceTurn]);

  // ── GK diving (saving) ───────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'gk_diving') return;

    const ball = ballRef.current;
    const gk = gkRef.current;
    const saving = savingRef.current;
    const kicker = kickerRef.current;

    ball.startX = W / 2;
    ball.startY = PENALTY_SPOT_Y;
    ball.targetX = saving.botShotTarget.x;
    ball.targetY = saving.botShotTarget.y;
    ball.progress = 0;
    ball.visible = true;

    const interval = setInterval(() => {
      if (kicker.kicking) {
        kicker.kickProgress = Math.min(kicker.kickProgress + 0.08, 1);
      }

      if (kicker.kickProgress > 0.3) {
        ball.progress = Math.min(ball.progress + 0.05, 1);
      }

      const p = ball.progress;
      const eased = 1 - Math.pow(1 - p, 2.5);
      const arcHeight = shotHeightRef.current === 'high' ? -150 : -60;
      const arc = arcHeight * Math.sin(p * Math.PI);
      ball.currentX = ball.startX + (ball.targetX - ball.startX) * eased;
      ball.currentY = ball.startY + (ball.targetY - ball.startY) * eased + arc;
      ball.scale = 1 - eased * 0.35;

      if (gk.diving) {
        gk.diveProgress = Math.min(gk.diveProgress + 0.05, 1);
        const dp = easeOutCubic(gk.diveProgress);
        gk.x = W / 2 + (gk.targetX - W / 2) * dp;
      }

      drawRef.current();

      if (p >= 1) {
        clearInterval(interval);
        const reflex = reflexRef.current;
        let result: ShotResult;
        if (reflex.savedByReflex === true) {
          // Reflex save — guaranteed save
          result = 'saved';
        } else if (reflex.savedByReflex === false) {
          // Failed reflex — ball scores unless it's off-frame (post/missed)
          const lx = goalLeftX(ball.targetY);
          const rx = goalRightX(ball.targetY);
          const tx = ball.targetX;
          const ty = ball.targetY;
          if (tx < lx + POST_W / 2 || tx > rx - POST_W / 2 || ty < GOAL_Y || ty > GOAL_BOTTOM) {
            if (Math.abs(tx - lx) < POST_W + 8 || Math.abs(tx - rx) < POST_W + 8 || Math.abs(ty - GOAL_Y) < POST_W + 8) result = 'post';
            else result = 'missed';
          } else {
            result = 'goal';
          }
        } else {
          // Fallback — use standard determination
          const dir = saving.chosenDir!;
          result = determineGkSave(ball.targetX, ball.targetY, gk.x, dir);
        }
        resultRef.current = result;

        if (result === 'saved') {
          gk.holdingBall = true;
          ball.visible = false;
          sfx.saveSound();
          sfx.crowdCheer();
        } else if (result === 'goal') {
          netRippleRef.current = 1;
          sfx.goalSound();
        } else {
          sfx.missSound();
        }

        drawRef.current();
        setPhase('result_pause');
        setTimeout(() => advanceTurn(result, 'goalkeeper'), 100);
      }
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [phase, advanceTurn]);

  // ── Net ripple decay ──────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'result_pause' || netRippleRef.current <= 0) return;
    const interval = setInterval(() => {
      netRippleRef.current = Math.max(0, netRippleRef.current - 0.02);
    }, 1000 / 60);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Shot result logic ─────────────────────────────────────────────────

  function determineShotResult(tx: number, ty: number, gkX: number, _gkDir: DiveDir): ShotResult {
    const lx = goalLeftX(ty);
    const rx = goalRightX(ty);
    if (tx < lx + POST_W / 2 || tx > rx - POST_W / 2 || ty < GOAL_Y || ty > GOAL_BOTTOM) {
      if (Math.abs(tx - lx) < POST_W + 8 || Math.abs(tx - rx) < POST_W + 8 || Math.abs(ty - GOAL_Y) < POST_W + 8) return 'post';
      return 'missed';
    }
    const reach = 55;
    const dist = Math.abs(tx - gkX);
    if (dist < reach && ty > GOAL_Y + 20) return 'saved';
    if (dist < reach * 1.4 && ty > GOAL_Y + 20 && Math.random() < 0.25) return 'saved';
    return 'goal';
  }

  function determineGkSave(tx: number, ty: number, gkX: number, _dir: DiveDir): ShotResult {
    const lx = goalLeftX(ty);
    const rx = goalRightX(ty);
    if (tx < lx + POST_W / 2 || tx > rx - POST_W / 2 || ty < GOAL_Y || ty > GOAL_BOTTOM) {
      if (Math.abs(tx - lx) < POST_W + 8 || Math.abs(tx - rx) < POST_W + 8 || Math.abs(ty - GOAL_Y) < POST_W + 8) return 'post';
      return 'missed';
    }
    const reach = 55;
    const dist = Math.abs(tx - gkX);
    if (dist < reach && ty > GOAL_Y + 20) return 'saved';
    if (dist < reach * 1.5 && ty > GOAL_Y + 20 && Math.random() < 0.3) return 'saved';
    return 'goal';
  }

  function easeOutCubic(x: number) { return 1 - Math.pow(1 - x, 3); }

  // ── Draw ──────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;

    const ph = phaseRef.current;
    const time = Date.now() / 1000;

    // ─── Sky
    const sky = c.createLinearGradient(0, 0, 0, H * 0.42);
    sky.addColorStop(0, '#050d1a');
    sky.addColorStop(0.5, '#0c1929');
    sky.addColorStop(1, '#162a45');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H * 0.42);

    // Stars (twinkling)
    for (let i = 0; i < 60; i++) {
      const sx = ((37 * (i + 1) * 7 + 13) % W);
      const sy = ((37 * (i + 1) * 11 + 7) % (H * 0.35));
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * 1.5 + i * 0.8));
      c.fillStyle = `rgba(255,255,255,${0.15 + twinkle * 0.5})`;
      const sr = 0.5 + ((i * 3) % 3) * 0.5;
      c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
    }

    // ─── Crowd / stands (background)
    const standGrad = c.createLinearGradient(0, H * 0.18, 0, H * 0.42);
    standGrad.addColorStop(0, '#1a1a2e');
    standGrad.addColorStop(1, '#0d1b0e');
    c.fillStyle = standGrad;
    c.fillRect(0, H * 0.18, W, H * 0.24);

    // Crowd dots
    for (let i = 0; i < 200; i++) {
      const cx = (i * 4.1 + Math.sin(i) * 20) % W;
      const cy = H * 0.2 + (i * 1.7 + Math.cos(i * 0.5) * 8) % (H * 0.2);
      const hue = (i * 47) % 360;
      const wave = Math.sin(time * 2 + i * 0.3) * 2;
      c.fillStyle = `hsla(${hue}, 50%, 50%, 0.3)`;
      c.beginPath(); c.arc(cx, cy + wave, 2.5, 0, Math.PI * 2); c.fill();
    }

    // ─── Grass
    const grassY = H * 0.40;
    const grass = c.createLinearGradient(0, grassY, 0, H);
    grass.addColorStop(0, '#1d7a35');
    grass.addColorStop(1, '#14522a');
    c.fillStyle = grass;
    c.fillRect(0, grassY, W, H - grassY);

    // Perspective stripes
    for (let i = 0; i < 16; i++) {
      const sy = grassY + (H - grassY) * (i / 16);
      const sh = (H - grassY) / 16;
      c.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)';
      c.fillRect(0, sy, W, sh);
    }

    // Center circle arc (perspective)
    c.strokeStyle = 'rgba(255,255,255,0.08)';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(W / 2, PENALTY_SPOT_Y - 10, 100, 35, 0, Math.PI, Math.PI * 2);
    c.stroke();

    // Penalty box lines
    c.strokeStyle = 'rgba(255,255,255,0.1)';
    c.lineWidth = 2;
    const boxW = 340;
    const boxTop = grassY + 10;
    c.beginPath();
    c.moveTo(W / 2 - boxW / 2, H);
    c.lineTo(W / 2 - boxW / 2 * 0.75, boxTop);
    c.lineTo(W / 2 + boxW / 2 * 0.75, boxTop);
    c.lineTo(W / 2 + boxW / 2, H);
    c.stroke();

    // ─── Floodlights
    for (const lx of [60, W - 60]) {
      // Pole
      c.strokeStyle = '#2a3040';
      c.lineWidth = 5;
      c.beginPath(); c.moveTo(lx, grassY); c.lineTo(lx, 10); c.stroke();

      // Light bank
      c.fillStyle = '#fef9c3';
      for (let i = 0; i < 3; i++) {
        c.fillRect(lx - 10 + i * 8, 6, 6, 8);
      }

      // Cone of light
      const lg = c.createRadialGradient(lx, 10, 5, lx, 10, 280);
      lg.addColorStop(0, 'rgba(255,250,210,0.12)');
      lg.addColorStop(0.5, 'rgba(255,250,210,0.04)');
      lg.addColorStop(1, 'rgba(255,250,210,0)');
      c.fillStyle = lg;
      c.beginPath(); c.arc(lx, 10, 280, 0, Math.PI * 2); c.fill();
    }

    // ─── Goal (perspective trapezoid)

    // Net depth sides
    c.fillStyle = 'rgba(255,255,255,0.03)';
    c.beginPath();
    c.moveTo(GOAL_TL, GOAL_Y);
    c.lineTo(GOAL_TL - NET_DEPTH, GOAL_Y - 5);
    c.lineTo(GOAL_BL - NET_DEPTH * 0.8, GOAL_BOTTOM + 5);
    c.lineTo(GOAL_BL, GOAL_BOTTOM);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(GOAL_TR, GOAL_Y);
    c.lineTo(GOAL_TR + NET_DEPTH, GOAL_Y - 5);
    c.lineTo(GOAL_BR + NET_DEPTH * 0.8, GOAL_BOTTOM + 5);
    c.lineTo(GOAL_BR, GOAL_BOTTOM);
    c.closePath(); c.fill();

    // Net back
    c.fillStyle = 'rgba(200,200,220,0.05)';
    c.beginPath();
    c.moveTo(GOAL_TL - NET_DEPTH, GOAL_Y - 5);
    c.lineTo(GOAL_TR + NET_DEPTH, GOAL_Y - 5);
    c.lineTo(GOAL_BR + NET_DEPTH * 0.8, GOAL_BOTTOM + 5);
    c.lineTo(GOAL_BL - NET_DEPTH * 0.8, GOAL_BOTTOM + 5);
    c.closePath(); c.fill();

    // Net grid (with ripple for goals)
    const ripple = netRippleRef.current;
    c.strokeStyle = `rgba(255,255,255,${0.08 + ripple * 0.12})`;
    c.lineWidth = 0.6;
    const netStep = 14;
    for (let nx = GOAL_TL; nx <= GOAL_TR; nx += netStep) {
      const frac = (nx - GOAL_TL) / (GOAL_TR - GOAL_TL);
      const bx = GOAL_BL + frac * (GOAL_BR - GOAL_BL);
      const wobble = ripple * Math.sin(time * 15 + nx * 0.1) * 4;
      c.beginPath(); c.moveTo(nx + wobble, GOAL_Y); c.lineTo(bx + wobble * 0.5, GOAL_BOTTOM); c.stroke();
    }
    for (let ny = GOAL_Y; ny <= GOAL_BOTTOM; ny += netStep) {
      const frac = (ny - GOAL_Y) / GOAL_H;
      const lx = GOAL_TL + frac * (GOAL_BL - GOAL_TL);
      const rx = GOAL_TR + frac * (GOAL_BR - GOAL_TR);
      const wobble = ripple * Math.sin(time * 12 + ny * 0.15) * 3;
      c.beginPath(); c.moveTo(lx, ny + wobble); c.lineTo(rx, ny + wobble); c.stroke();
    }

    // Net interior fill
    c.fillStyle = 'rgba(180,200,220,0.04)';
    c.beginPath();
    c.moveTo(GOAL_TL, GOAL_Y);
    c.lineTo(GOAL_TR, GOAL_Y);
    c.lineTo(GOAL_BR, GOAL_BOTTOM);
    c.lineTo(GOAL_BL, GOAL_BOTTOM);
    c.closePath(); c.fill();

    // Goal frame (posts + crossbar)
    c.strokeStyle = '#d4d4d8';
    c.lineWidth = POST_W;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(GOAL_BL, GOAL_BOTTOM);
    c.lineTo(GOAL_TL, GOAL_Y);
    c.lineTo(GOAL_TR, GOAL_Y);
    c.lineTo(GOAL_BR, GOAL_BOTTOM);
    c.stroke();

    // Post shine
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(GOAL_BL + 2, GOAL_BOTTOM); c.lineTo(GOAL_TL + 2, GOAL_Y); c.stroke();
    c.beginPath(); c.moveTo(GOAL_BR - 2, GOAL_BOTTOM); c.lineTo(GOAL_TR - 2, GOAL_Y); c.stroke();
    c.beginPath(); c.moveTo(GOAL_TL, GOAL_Y - 2); c.lineTo(GOAL_TR, GOAL_Y - 2); c.stroke();

    // ─── Penalty spot
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(W / 2, PENALTY_SPOT_Y, 3, 0, Math.PI * 2); c.fill();

    // ─── Goalkeeper
    const gk = gkRef.current;
    drawPerson(c, gk.x, gk.y, {
      shirtColor: '#fbbf24', shortsColor: '#1e293b', skinColor: '#d4a574',
      gloveColor: '#4ade80',
      diving: gk.diving, diveDir: gk.diveDir, diveProgress: gk.diveProgress,
      holdingBall: gk.holdingBall, facingFront: true,
      scale: 0.85,
      shotHeight: shotHeightRef.current,
    });

    // ─── Ball (held by GK when saved)
    const ball = ballRef.current;
    if (gk.holdingBall) {
      // Ball in GK's hands
      const heldX = gk.x + (gk.diveDir === 'left' ? -30 : gk.diveDir === 'right' ? 30 : 0);
      const heldY = gk.y - 20;
      drawBall(c, heldX, heldY, 0.65);
    } else if (ball.visible) {
      if (ph === 'aiming' || ph === 'saving') {
        drawBall(c, W / 2, PENALTY_SPOT_Y, 1);
      } else if (ph === 'ball_flying' || ph === 'gk_diving' || ph === 'result_pause') {
        drawBall(c, ball.currentX, ball.currentY, ball.scale);
      }
    }

    // ─── Kicker
    const kicker = kickerRef.current;
    if (ph !== 'ended') {
      drawKicker(c, kicker.x, kicker.y, kicker.kicking, kicker.kickProgress);
    }

    // ─── Crosshair (aiming)
    if (ph === 'aiming') {
      const aim = aimRef.current;
      const pulse = 0.8 + 0.2 * Math.sin(time * 6);

      // Outer ring
      c.strokeStyle = `rgba(255,70,70,${pulse * 0.7})`;
      c.lineWidth = 2;
      c.beginPath(); c.arc(aim.x, aim.y, 18, 0, Math.PI * 2); c.stroke();

      // Cross lines with gaps
      const s = 22;
      const g = 6;
      c.strokeStyle = `rgba(255,70,70,${pulse * 0.9})`;
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(aim.x - s, aim.y); c.lineTo(aim.x - g, aim.y); c.stroke();
      c.beginPath(); c.moveTo(aim.x + g, aim.y); c.lineTo(aim.x + s, aim.y); c.stroke();
      c.beginPath(); c.moveTo(aim.x, aim.y - s); c.lineTo(aim.x, aim.y - g); c.stroke();
      c.beginPath(); c.moveTo(aim.x, aim.y + g); c.lineTo(aim.x, aim.y + s); c.stroke();

      // Center dot
      c.fillStyle = `rgba(255,70,70,${pulse})`;
      c.beginPath(); c.arc(aim.x, aim.y, 2, 0, Math.PI * 2); c.fill();

      // Trajectory line
      c.strokeStyle = 'rgba(255,70,70,0.12)';
      c.lineWidth = 1;
      c.setLineDash([8, 6]);
      c.beginPath(); c.moveTo(W / 2, PENALTY_SPOT_Y); c.lineTo(aim.x, aim.y); c.stroke();
      c.setLineDash([]);
    }

    // ─── Reflex save indicators
    if (ph === 'saving') {
      const reflex = reflexRef.current;

      if (reflex.phase === 'waiting') {
        // Pulsing "GET READY" text
        const pulse = 0.6 + 0.4 * Math.sin(time * 5);
        c.save();
        c.font = 'bold 28px system-ui';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.strokeStyle = 'rgba(0,0,0,0.5)';
        c.lineWidth = 4;
        c.strokeText(t('penalties.reflex.ready'), W / 2, GOAL_Y + GOAL_H * 0.45);
        c.fillStyle = `rgba(255,200,50,${pulse})`;
        c.fillText(t('penalties.reflex.ready'), W / 2, GOAL_Y + GOAL_H * 0.45);
        c.restore();
      } else if (reflex.phase === 'flashing' && reflex.active) {
        // Draw the crosshair at the target position
        const tx = reflex.targetX;
        const ty = reflex.targetY;
        const elapsed = Date.now() - reflex.flashStart;
        const flashProg = elapsed / reflex.flashDuration;
        const pulse = 0.7 + 0.3 * Math.sin(time * 12);
        const fadeIn = Math.min(flashProg * 4, 1); // quick fade in
        const alpha = fadeIn * pulse;

        // Outer glow
        const glow = c.createRadialGradient(tx, ty, 0, tx, ty, 50);
        glow.addColorStop(0, `rgba(255,255,80,${0.25 * alpha})`);
        glow.addColorStop(0.5, `rgba(255,200,0,${0.1 * alpha})`);
        glow.addColorStop(1, 'rgba(255,200,0,0)');
        c.fillStyle = glow;
        c.beginPath(); c.arc(tx, ty, 50, 0, Math.PI * 2); c.fill();

        // Outer ring (pulsing)
        const ringSize = 24 + 4 * Math.sin(time * 10);
        c.strokeStyle = `rgba(255,255,100,${0.9 * alpha})`;
        c.lineWidth = 3;
        c.beginPath(); c.arc(tx, ty, ringSize, 0, Math.PI * 2); c.stroke();

        // Inner ring
        c.strokeStyle = `rgba(255,255,255,${0.8 * alpha})`;
        c.lineWidth = 2;
        c.beginPath(); c.arc(tx, ty, 10, 0, Math.PI * 2); c.stroke();

        // Cross lines
        const s = 30;
        const g = 12;
        c.strokeStyle = `rgba(255,255,100,${0.85 * alpha})`;
        c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(tx - s, ty); c.lineTo(tx - g, ty); c.stroke();
        c.beginPath(); c.moveTo(tx + g, ty); c.lineTo(tx + s, ty); c.stroke();
        c.beginPath(); c.moveTo(tx, ty - s); c.lineTo(tx, ty - g); c.stroke();
        c.beginPath(); c.moveTo(tx, ty + g); c.lineTo(tx, ty + s); c.stroke();

        // Center dot
        c.fillStyle = `rgba(255,255,255,${alpha})`;
        c.beginPath(); c.arc(tx, ty, 3, 0, Math.PI * 2); c.fill();

        // "NOW!" text
        c.save();
        c.font = 'bold 18px system-ui';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.strokeStyle = 'rgba(0,0,0,0.6)';
        c.lineWidth = 3;
        c.strokeText(t('penalties.reflex.now'), W / 2, GOAL_BOTTOM + 30);
        c.fillStyle = `rgba(255,80,80,${alpha})`;
        c.fillText(t('penalties.reflex.now'), W / 2, GOAL_BOTTOM + 30);
        c.restore();
      }
    }

    // ─── Result text
    if (ph === 'result_pause' && resultRef.current) {
      const res = resultRef.current;
      const role = roleRef.current;
      const label = res === 'goal' ? t('penalties.result.goal')
        : res === 'saved' ? t('penalties.result.saved')
        : res === 'post' ? t('penalties.result.post') : t('penalties.result.missed');

      const color = res === 'goal'
        ? (role === 'shooter' ? '#4ade80' : '#f87171')
        : res === 'saved'
        ? (role === 'shooter' ? '#f87171' : '#4ade80')
        : '#fbbf24';

      c.save();
      c.font = 'bold 42px system-ui';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      // Outline
      c.strokeStyle = 'rgba(0,0,0,0.6)';
      c.lineWidth = 6;
      c.strokeText(label, W / 2, H * 0.58);
      c.fillStyle = color;
      c.fillText(label, W / 2, H * 0.58);
      c.restore();
    }

    // ─── Scoreboard HUD
    drawScoreboardHUD(c, ph);

    // ─── Role text
    if (ph === 'aiming' || ph === 'saving') {
      c.save();
      const roleText = ph === 'aiming' ? t('penalties.youShoot') : t('penalties.youSave');
      // Note: youSave text updated via i18n to reflect reflex mechanic

      // Background pill
      c.font = 'bold 15px system-ui';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const tw = c.measureText(roleText).width + 24;
      const ry = H - 28;
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.beginPath(); c.roundRect(W / 2 - tw / 2, ry - 13, tw, 26, 13); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillText(roleText, W / 2, ry);
      c.restore();
    }

    if (ph === 'aiming') {
      c.font = '12px system-ui';
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.textAlign = 'center';
      c.fillText(t('penalties.clickToShoot'), W / 2, H - 6);
    }
  }, [t, playerScore, botScore, currentRound, isSuddenDeath, phase, results, currentRole]);
  drawRef.current = draw;

  // ── Draw person (goalkeeper) ──────────────────────────────────────────

  function drawPerson(c: CanvasRenderingContext2D, x: number, y: number, opts: {
    shirtColor: string; shortsColor: string; skinColor: string;
    gloveColor: string;
    diving: boolean; diveDir: DiveDir; diveProgress: number;
    holdingBall: boolean; facingFront: boolean;
    scale: number;
    shotHeight?: 'low' | 'high';
  }) {
    c.save();
    c.translate(x, y);
    const s = opts.scale;
    c.scale(s, s);

    const dp = Math.min(opts.diveProgress, 1);
    const edp = easeOutCubic(dp);
    const isHigh = opts.shotHeight === 'high';

    if (opts.diving && opts.diveDir !== 'center') {
      const angle = opts.diveDir === 'left' ? -0.7 * edp : 0.7 * edp;
      c.rotate(angle);
      // High shots: stretch up; low shots: drop/crouch down
      const verticalShift = isHigh ? -25 * edp : 5 * edp;
      c.translate(0, verticalShift);
    } else if (opts.diving && opts.diveDir === 'center') {
      // Center dive: high = jump up, low = crouch down
      const verticalShift = isHigh ? -12 * edp : 10 * edp;
      c.translate(0, verticalShift);
    }

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.beginPath(); c.ellipse(0, 32, 18, 5, 0, 0, Math.PI * 2); c.fill();

    // Legs
    const legSpread = opts.diving ? 12 * edp : 4;
    c.fillStyle = opts.skinColor;
    c.fillRect(-legSpread - 5, 12, 7, 20);
    c.fillRect(legSpread - 2, 12, 7, 20);

    // Boots
    c.fillStyle = '#1e1e1e';
    c.fillRect(-legSpread - 6, 30, 9, 5);
    c.fillRect(legSpread - 3, 30, 9, 5);

    // Shorts
    c.fillStyle = opts.shortsColor;
    c.fillRect(-12, 4, 24, 12);

    // Torso
    c.fillStyle = opts.shirtColor;
    c.beginPath();
    c.roundRect(-14, -22, 28, 28, 4);
    c.fill();

    // Number on shirt
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.font = 'bold 14px system-ui';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('1', 0, -8);

    // Head
    c.fillStyle = opts.skinColor;
    c.beginPath(); c.arc(0, -30, 11, 0, Math.PI * 2); c.fill();

    // Hair
    c.fillStyle = '#2d1810';
    c.beginPath();
    c.arc(0, -33, 11, Math.PI, Math.PI * 2);
    c.fill();

    // Eyes
    if (opts.facingFront) {
      c.fillStyle = '#1a1a1a';
      c.beginPath(); c.arc(-4, -30, 1.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(4, -30, 1.5, 0, Math.PI * 2); c.fill();
    }

    // Arms + gloves
    const armLen = opts.diving ? 30 + 15 * edp : 20;
    const highArmOffset = opts.diving && isHigh ? -0.35 * edp : 0;
    const armAngle = opts.diving
      ? (opts.diveDir === 'center' ? -Math.PI / 2 + highArmOffset : -Math.PI / 2 - 0.2 + highArmOffset)
      : -Math.PI / 4;

    // Left arm
    c.save();
    c.translate(-14, -14);
    const leftAngle = opts.diving && opts.diveDir !== 'right' ? armAngle - 0.3 * edp : -Math.PI / 4;
    c.rotate(leftAngle);
    c.fillStyle = opts.shirtColor;
    c.fillRect(0, -3, armLen * 0.6, 6);
    c.fillStyle = opts.gloveColor;
    c.fillRect(armLen * 0.6 - 2, -4, armLen * 0.4 + 2, 8);
    // Glove fingers
    c.beginPath(); c.arc(armLen, 0, 5, 0, Math.PI * 2); c.fill();
    c.restore();

    // Right arm
    c.save();
    c.translate(14, -14);
    const rightAngle = opts.diving && opts.diveDir !== 'left'
      ? -(Math.PI - armAngle) + 0.3 * edp
      : -(Math.PI - (-Math.PI / 4));
    c.rotate(rightAngle);
    c.fillStyle = opts.shirtColor;
    c.fillRect(0, -3, armLen * 0.6, 6);
    c.fillStyle = opts.gloveColor;
    c.fillRect(armLen * 0.6 - 2, -4, armLen * 0.4 + 2, 8);
    c.beginPath(); c.arc(armLen, 0, 5, 0, Math.PI * 2); c.fill();
    c.restore();

    c.restore();
  }

  // ── Draw kicker ───────────────────────────────────────────────────────

  function drawKicker(c: CanvasRenderingContext2D, x: number, y: number, kicking: boolean, progress: number) {
    c.save();
    c.translate(x, y);
    const s = 1.0;
    c.scale(s, s);

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.15)';
    c.beginPath(); c.ellipse(0, 25, 14, 4, 0, 0, Math.PI * 2); c.fill();

    const kickAngle = kicking ? Math.sin(Math.min(progress, 0.5) * Math.PI) * 1.2 : 0;
    const runUp = kicking ? Math.max(0, 1 - progress * 3) : 0;

    // Move whole body forward during run-up
    c.translate(0, -runUp * 15);

    // Left leg (plant leg)
    c.fillStyle = '#d4a574';
    c.fillRect(-8, 10, 6, 18);
    c.fillStyle = '#1e1e1e';
    c.fillRect(-9, 26, 8, 5);

    // Right leg (kicking leg, animated)
    c.save();
    c.translate(6, 10);
    c.rotate(-kickAngle);
    c.fillStyle = '#d4a574';
    c.fillRect(-3, 0, 6, 18);
    c.fillStyle = '#1e1e1e';
    c.fillRect(-4, 16, 8, 5);
    c.restore();

    // Shorts
    c.fillStyle = '#1e40af';
    c.fillRect(-10, 4, 20, 10);

    // Torso
    c.fillStyle = '#3b82f6';
    c.beginPath(); c.roundRect(-12, -20, 24, 26, 4); c.fill();

    // Lean back during kick
    const lean = kicking ? -0.1 * Math.sin(Math.min(progress, 0.5) * Math.PI) : 0;
    c.save();
    c.rotate(lean);

    // Number
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.font = 'bold 12px system-ui';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('10', 0, -7);

    // Head
    c.fillStyle = '#d4a574';
    c.beginPath(); c.arc(0, -28, 9, 0, Math.PI * 2); c.fill();

    // Hair
    c.fillStyle = '#1a1206';
    c.beginPath(); c.arc(0, -30, 9, Math.PI, Math.PI * 2); c.fill();

    c.restore();

    // Arms swing
    const armSwing = kicking ? Math.sin(Math.min(progress, 0.5) * Math.PI) * 0.5 : 0;

    // Left arm
    c.save();
    c.translate(-12, -12);
    c.rotate(-Math.PI / 4 + armSwing);
    c.fillStyle = '#3b82f6';
    c.fillRect(0, -2.5, 16, 5);
    c.fillStyle = '#d4a574';
    c.fillRect(14, -2.5, 8, 5);
    c.restore();

    // Right arm
    c.save();
    c.translate(12, -12);
    c.rotate(Math.PI / 4 + armSwing);
    c.fillStyle = '#3b82f6';
    c.fillRect(-16, -2.5, 16, 5);
    c.fillStyle = '#d4a574';
    c.fillRect(-22, -2.5, 8, 5);
    c.restore();

    c.restore();
  }

  // ── Draw ball ─────────────────────────────────────────────────────────

  function drawBall(c: CanvasRenderingContext2D, x: number, y: number, scale: number) {
    const r = BALL_R * scale;

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.ellipse(x + 1, y + r + 2, r * 0.8, r * 0.3, 0, 0, Math.PI * 2); c.fill();

    // Main ball
    const grad = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.6, '#f0f0f0');
    grad.addColorStop(1, '#b0b0b0');
    c.fillStyle = grad;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();

    // Pentagon patches
    c.fillStyle = 'rgba(30,30,30,0.18)';
    const pents = 5;
    for (let i = 0; i < pents; i++) {
      const a = (Math.PI * 2 * i) / pents - Math.PI / 2;
      const px = x + Math.cos(a) * r * 0.42;
      const py = y + Math.sin(a) * r * 0.42;
      c.beginPath();
      for (let j = 0; j < 5; j++) {
        const pa = a + (Math.PI * 2 * j) / 5;
        const ppx = px + Math.cos(pa) * r * 0.22;
        const ppy = py + Math.sin(pa) * r * 0.22;
        if (j === 0) c.moveTo(ppx, ppy); else c.lineTo(ppx, ppy);
      }
      c.closePath(); c.fill();
    }

    // Highlight
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.beginPath(); c.arc(x - r * 0.25, y - r * 0.25, r * 0.25, 0, Math.PI * 2); c.fill();
  }

  // ── Scoreboard HUD ───────────────────────────────────────────────────

  function drawScoreboardHUD(c: CanvasRenderingContext2D, ph: Phase) {
    if (ph === 'menu') return;

    const sbW = 280;
    const sbH = 52;
    const sbX = W / 2 - sbW / 2;
    const sbY = 6;

    // Background
    c.fillStyle = 'rgba(0,0,0,0.75)';
    c.beginPath(); c.roundRect(sbX, sbY, sbW, sbH, 10); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.08)';
    c.lineWidth = 1;
    c.beginPath(); c.roundRect(sbX, sbY, sbW, sbH, 10); c.stroke();

    // Player side
    c.font = 'bold 12px system-ui';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#93c5fd';
    c.fillText(t('penalties.you'), sbX + 55, sbY + 14);
    c.font = 'bold 26px system-ui';
    c.fillStyle = '#fff';
    c.fillText(`${playerScore}`, sbX + 55, sbY + 36);

    // Separator
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.font = 'bold 22px system-ui';
    c.fillText('–', W / 2, sbY + 34);

    // Bot side
    c.font = 'bold 12px system-ui';
    c.fillStyle = '#fca5a5';
    c.fillText('BOT', sbX + sbW - 55, sbY + 14);
    c.font = 'bold 26px system-ui';
    c.fillStyle = '#fff';
    c.fillText(`${botScore}`, sbX + sbW - 55, sbY + 36);

    // Round
    const roundText = isSuddenDeath ? t('penalties.suddenDeath') : `${t('penalties.round')} ${currentRound}/${ROUNDS}`;
    c.font = '10px system-ui';
    c.fillStyle = isSuddenDeath ? '#fbbf24' : 'rgba(255,255,255,0.45)';
    c.fillText(roundText, W / 2, sbY + 14);

    // Shot history dots
    const dotY = sbY + sbH + 10;
    const dotR = 4;
    const dotGap = 14;

    const playerShots = results.filter(r => r.role === 'shooter');
    const botShots = results.filter(r => r.role === 'goalkeeper');

    const maxDotsP = Math.max(ROUNDS, playerShots.length);
    const maxDotsB = Math.max(ROUNDS, botShots.length);

    for (let i = 0; i < maxDotsP; i++) {
      const dx = W / 2 - 15 - i * dotGap;
      c.fillStyle = i < playerShots.length
        ? (playerShots[i].result === 'goal' ? '#4ade80' : '#ef4444')
        : 'rgba(255,255,255,0.12)';
      c.beginPath(); c.arc(dx, dotY, dotR, 0, Math.PI * 2); c.fill();
    }

    for (let i = 0; i < maxDotsB; i++) {
      const dx = W / 2 + 15 + i * dotGap;
      c.fillStyle = i < botShots.length
        ? (botShots[i].result === 'goal' ? '#ef4444' : '#4ade80')
        : 'rgba(255,255,255,0.12)';
      c.beginPath(); c.arc(dx, dotY, dotR, 0, Math.PI * 2); c.fill();
    }
  }

  // ── Render loop ───────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'aiming' && phase !== 'saving' && phase !== 'result_pause') return;
    const loop = () => { draw(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, draw]);

  useEffect(() => {
    if (phase === 'ended') draw();
  }, [phase, draw, gameResult]);

  // ── Render ────────────────────────────────────────────────────────────

  if (phase === 'menu') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 px-4">
        <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--fg)' }}>
          {t('penalties.title')}
        </h2>

        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>{t('penalties.difficulty')}</span>
          <div className="flex gap-2">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: difficulty === d ? 'var(--accent)' : 'var(--card)',
                  color: difficulty === d ? '#fff' : 'var(--fg)',
                  border: difficulty === d ? '2px solid var(--accent)' : '2px solid var(--border)',
                }}
              >
                {t(`penalties.${d}`)}
              </button>
            ))}
          </div>
        </div>

        <div
          className="max-w-md text-center text-sm leading-relaxed p-4 rounded-xl"
          style={{ background: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <p>{t('penalties.rules')}</p>
        </div>

        <button
          onClick={startGame}
          className="px-8 py-3 rounded-xl text-lg font-bold transition-all hover:scale-105 active:scale-95"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {t('penalties.start')}
        </button>

        {stats && stats.games > 0 && (
          <div
            className="grid grid-cols-3 gap-4 text-center p-4 rounded-xl max-w-sm w-full"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{stats.wins}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{t('penalties.wins')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{stats.draws}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{t('penalties.draws')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{stats.losses}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{t('penalties.losses')}</div>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: '#4ade80' }}>{stats.goalsScored}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{t('penalties.scored')}</div>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: 'var(--fg)' }}>{stats.games}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{t('penalties.played')}</div>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: '#60a5fa' }}>{stats.goalsSaved}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{t('penalties.saved')}</div>
            </div>
          </div>
        )}

        <button
          onClick={toggleMute}
          className="text-sm px-3 py-1 rounded-lg"
          style={{ background: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full rounded-xl border"
          style={{
            borderColor: 'var(--border)',
            cursor: phase === 'aiming' ? 'crosshair' : phase === 'saving' ? 'crosshair' : 'default',
          }}
        />

        {phase === 'ended' && gameResult && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl"
            style={{ background: 'rgba(0,0,0,0.78)' }}>
            <div className="text-4xl font-black mb-2"
              style={{ color: gameResult === 'win' ? '#4ade80' : gameResult === 'loss' ? '#f87171' : '#fbbf24' }}>
              {gameResult === 'win' ? t('penalties.youWin') : gameResult === 'loss' ? t('penalties.youLose') : t('penalties.draw')}
            </div>
            <div className="text-xl font-bold mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {playerScore} – {botScore}
            </div>
            <button
              onClick={startGame}
              className="px-6 py-2.5 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {t('game.playAgain')}
            </button>
            <button
              onClick={() => setPhase('menu')}
              className="mt-2 px-4 py-1.5 rounded-lg text-sm transition-all"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              {t('penalties.backToMenu')}
            </button>
          </div>
        )}
      </div>

      <button
        onClick={toggleMute}
        className="text-sm px-3 py-1 rounded-lg"
        style={{ background: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--border)' }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
