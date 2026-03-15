'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { loadStats, saveStats, recordRun } from './stats';
import type { TypingTestStats } from './stats';
import * as sfx from './sound';

// ── Word pools ───────────────────────────────────────────────────────────────

const WORDS_EN = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
  'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
  'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
  'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come',
  'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how',
  'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
  'any', 'these', 'give', 'day', 'most', 'us', 'great', 'between', 'need',
  'large', 'must', 'home', 'big', 'high', 'long', 'story', 'since', 'many',
  'right', 'hand', 'find', 'here', 'thing', 'place', 'made', 'where',
  'after', 'small', 'found', 'ask', 'own', 'run', 'always', 'left', 'put',
  'does', 'set', 'each', 'keep', 'point', 'help', 'start', 'show', 'city',
  'move', 'live', 'feel', 'under', 'last', 'read', 'never', 'turn', 'old',
  'still', 'world', 'near', 'state', 'head', 'end', 'might', 'next',
  'below', 'light', 'much', 'open', 'line', 'part', 'name', 'every',
  'play', 'house', 'word', 'number', 'write', 'while', 'begin', 'life',
  'real', 'water', 'sure', 'fire', 'best', 'land', 'night', 'along',
  'hard', 'close', 'power', 'music', 'learn', 'plant', 'food', 'sun',
  'face', 'group', 'game', 'money', 'south', 'north', 'east', 'west',
];

const WORDS_DE = [
  'aber', 'alle', 'also', 'andere', 'arbeiten', 'auto', 'baum', 'bitte',
  'brauchen', 'buch', 'dann', 'denken', 'diese', 'doch', 'drei', 'durch',
  'eigentlich', 'einmal', 'erst', 'fahren', 'finden', 'fragen', 'frau',
  'freund', 'ganz', 'geben', 'gehen', 'geld', 'genau', 'gerade', 'gern',
  'gruppe', 'halten', 'haus', 'heute', 'hier', 'immer', 'jetzt', 'junge',
  'kalt', 'kaufen', 'kinder', 'kommen', 'laufen', 'leben', 'leute', 'licht',
  'machen', 'mann', 'mehr', 'mensch', 'morgen', 'musik', 'nacht', 'nehmen',
  'nichts', 'noch', 'oben', 'platz', 'punkt', 'recht', 'reden', 'reise',
  'sagen', 'schnell', 'schon', 'schule', 'sehen', 'spielen', 'sprechen',
  'stadt', 'stark', 'stehen', 'stelle', 'suchen', 'tragen', 'treffen',
  'unten', 'viel', 'wasser', 'welt', 'wenig', 'wieder', 'wissen', 'wollen',
  'zeit', 'zeigen', 'beide', 'land', 'hand', 'name', 'seite', 'teil',
  'wort', 'bild', 'ding', 'ende', 'fall', 'feld', 'form', 'kind', 'kopf',
  'lesen', 'rufen', 'sicher', 'klein', 'lang', 'kurz', 'neu', 'alt',
  'jung', 'schreiben', 'lernen', 'helfen', 'bringen', 'bleiben', 'kennen',
  'legen', 'setzen', 'stellen', 'ziehen', 'werfen', 'essen', 'trinken',
  'lassen', 'geben', 'halten', 'fallen', 'tragen', 'liegen', 'sitzen',
  'stehen', 'warten', 'holen', 'bauen', 'nutzen', 'drehen', 'folgen',
  'meinen', 'stimmen', 'glauben', 'schaffen', 'vergessen', 'beginnen',
  'antworten', 'bedeuten', 'erhalten', 'entstehen', 'erreichen', 'zwischen',
  'gegen', 'unter', 'neben', 'hinten', 'vorne', 'rechts', 'links', 'offen',
  'leise', 'laut', 'ruhig', 'dunkel', 'hell', 'warm', 'tief', 'hoch',
  'weit', 'nah', 'fest', 'leicht', 'schwer', 'rund', 'eben', 'glatt',
  'weich', 'hart', 'sauber', 'fertig', 'bereit', 'einfach', 'wichtig',
  'richtig', 'falsch', 'lustig', 'ernst', 'traurig', 'stolz', 'mutig',
];

function generateText(words: string[], count: number): string {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(words[Math.floor(Math.random() * words.length)]);
  }
  return result.join(' ');
}

// ── Duration config ──────────────────────────────────────────────────────────

type Duration = 15 | 30 | 60;
const DURATIONS: Duration[] = [15, 30, 60];

/** How many words to generate per duration. */
function wordCount(d: Duration): number {
  // ~3.5 words/sec for fast typists, generous buffer
  return d === 15 ? 80 : d === 30 ? 150 : 280;
}

// ── WPM snapshot for graph ───────────────────────────────────────────────────

interface WpmSnapshot {
  time: number; // seconds elapsed
  wpm: number;
}

// ── Phase ────────────────────────────────────────────────────────────────────

type Phase = 'menu' | 'ready' | 'typing' | 'ended';

// ── Component ────────────────────────────────────────────────────────────────

export function TypingTestGame() {
  const { lang, t } = useI18n();
  const ach = useAchievements('typingtest');

  // ── State ────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('menu');
  const [duration, setDuration] = useState<Duration>(30);
  const [stats, setStats] = useState<TypingTestStats | null>(null);
  const [text, setText] = useState('');

  // Refs for fast typing state (no re-renders per keystroke)
  const cursorRef = useRef(0);        // index of next char to type
  const correctRef = useRef(0);
  const incorrectRef = useRef(0);
  const startTimeRef = useRef(0);
  const timerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotsRef = useRef<WpmSnapshot[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<HTMLSpanElement[]>([]);
  const savedRef = useRef(false);

  // Display state (updated via requestAnimationFrame or interval)
  const [liveWpm, setLiveWpm] = useState(0);
  const [liveAccuracy, setLiveAccuracy] = useState(100);
  const [timeLeft, setTimeLeft] = useState(0);

  // Results
  const [finalWpm, setFinalWpm] = useState(0);
  const [finalAccuracy, setFinalAccuracy] = useState(100);
  const [finalCorrect, setFinalCorrect] = useState(0);
  const [finalIncorrect, setFinalIncorrect] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);
  const [finalSnapshots, setFinalSnapshots] = useState<WpmSnapshot[]>([]);

  // ── Load stats on mount ──────────────────────────────────────────────────
  useEffect(() => {
    setStats(loadStats());
  }, []);

  // ── Finish handler ─────────────────────────────────────────────────────
  const finishTest = useCallback(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    if (timerIdRef.current) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }

    const elapsed = (Date.now() - startTimeRef.current) / 60000; // minutes
    const wpm = elapsed > 0 ? Math.round((correctRef.current / 5) / elapsed) : 0;
    const total = correctRef.current + incorrectRef.current;
    const acc = total > 0 ? Math.round((correctRef.current / total) * 100) : 100;

    setFinalWpm(wpm);
    setFinalAccuracy(acc);
    setFinalCorrect(correctRef.current);
    setFinalIncorrect(incorrectRef.current);
    setFinalTotal(total);
    setFinalSnapshots([...snapshotsRef.current]);
    setPhase('ended');

    // Sound
    if (wpm >= 60) {
      sfx.winSound();
    } else {
      sfx.completeSound();
    }

    // Track achievements
    ach.trackPlay();
    ach.trackWin({ wpm, accuracy: acc });

    // Save stats
    setStats((prev) => {
      const base = prev ?? loadStats();
      const next = recordRun(base, wpm, acc);
      saveStats(next);
      return next;
    });
  }, [ach]);

  // ── Start a test ─────────────────────────────────────────────────────────
  const startTest = useCallback((d: Duration) => {
    setDuration(d);
    const words = lang === 'de' ? WORDS_DE : WORDS_EN;
    const newText = generateText(words, wordCount(d));
    setText(newText);
    cursorRef.current = 0;
    correctRef.current = 0;
    incorrectRef.current = 0;
    startTimeRef.current = 0;
    snapshotsRef.current = [];
    savedRef.current = false;
    charsRef.current = [];
    setLiveWpm(0);
    setLiveAccuracy(100);
    setTimeLeft(d);
    setPhase('ready');
  }, [lang]);

  // ── Timer tick ─────────────────────────────────────────────────────────
  const startTimer = useCallback((d: Duration, finishFn: () => void) => {
    const start = Date.now();
    startTimeRef.current = start;

    timerIdRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, d * 1000 - elapsed);
      setTimeLeft(Math.ceil(remaining / 1000));

      // WPM snapshot every second
      const elapsedMin = elapsed / 60000;
      const wpm = elapsedMin > 0 ? Math.round((correctRef.current / 5) / elapsedMin) : 0;
      const total = correctRef.current + incorrectRef.current;
      const acc = total > 0 ? Math.round((correctRef.current / total) * 100) : 100;

      setLiveWpm(wpm);
      setLiveAccuracy(acc);

      snapshotsRef.current.push({ time: Math.round(elapsed / 1000), wpm });

      if (remaining <= 0) {
        finishFn();
      }
    }, 200);
  }, []);

  // ── Keydown handler ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready' && phase !== 'typing') return;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore modifier combos (Ctrl+C etc)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Prevent space scrolling
      if (e.key === ' ') e.preventDefault();

      // Only accept printable single characters
      if (e.key.length !== 1) return;

      // Start timer on first keypress
      if (phase === 'ready' && startTimeRef.current === 0) {
        setPhase('typing');
        startTimer(duration, finishTest);
      }

      const idx = cursorRef.current;
      if (idx >= text.length) return;

      const expected = text[idx];
      const span = charsRef.current[idx];

      if (e.key === expected) {
        // Correct
        correctRef.current++;
        if (span) {
          span.className = 'text-emerald-400';
        }
        sfx.keySound();
      } else {
        // Incorrect
        incorrectRef.current++;
        if (span) {
          span.className = 'bg-red-500/30 text-red-400';
        }
        sfx.errorSound();
      }

      cursorRef.current = idx + 1;

      // Remove highlight from current, add to next
      if (span) {
        // already styled above
      }
      const nextSpan = charsRef.current[idx + 1];
      if (nextSpan) {
        nextSpan.className = 'bg-indigo-500/30 text-zinc-100 border-b-2 border-indigo-400';
      }

      // Auto-scroll: keep the active character visible
      if (nextSpan && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const spanRect = nextSpan.getBoundingClientRect();
        if (spanRect.bottom > containerRect.bottom - 20 || spanRect.top < containerRect.top + 20) {
          nextSpan.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }

      // Check if all text typed
      if (cursorRef.current >= text.length) {
        finishTest();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, text, duration, startTimer, finishTest]);

  // ── Cleanup timer on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerIdRef.current) clearInterval(timerIdRef.current);
    };
  }, []);

  // ── Register char span refs ──────────────────────────────────────────────
  const setCharRef = useCallback((el: HTMLSpanElement | null, idx: number) => {
    if (el) charsRef.current[idx] = el;
  }, []);

  // ── Menu ──────────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <h2 className="text-3xl font-black tracking-tight">{t('lobby.games.typingtest.title')}</h2>
        <p className="text-zinc-400 text-sm max-w-md text-center">{t('lobby.games.typingtest.desc')}</p>

        {/* Duration selector */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
            {t('typingtest.duration')}
          </span>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => startTest(d)}
                className={`px-6 py-3 rounded-lg font-bold text-lg transition-all
                  ${d === duration
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'}`}
              >
                {t(`typingtest.${d}s`)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {stats && stats.games > 0 && (
          <div className="grid grid-cols-3 gap-4 text-center mt-4">
            <div className="bg-zinc-800/60 rounded-lg px-4 py-3 border border-zinc-700/60">
              <div className="text-2xl font-black tabular-nums text-indigo-400">
                {stats.bestWpm ?? 0}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">
                {t('typingtest.bestWpm')}
              </div>
            </div>
            <div className="bg-zinc-800/60 rounded-lg px-4 py-3 border border-zinc-700/60">
              <div className="text-2xl font-black tabular-nums text-emerald-400">
                {stats.bestAccuracy ?? 0}%
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">
                {t('typingtest.bestAccuracy')}
              </div>
            </div>
            <div className="bg-zinc-800/60 rounded-lg px-4 py-3 border border-zinc-700/60">
              <div className="text-2xl font-black tabular-nums text-zinc-300">
                {stats.games}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">
                {t('typingtest.tests')}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Ready / Typing ────────────────────────────────────────────────────────
  if (phase === 'ready' || phase === 'typing') {
    const progressPct = duration > 0 ? (timeLeft / duration) * 100 : 100;

    return (
      <div className="flex-1 flex flex-col items-center gap-4 pt-4">
        {/* Live stats bar */}
        <div className="w-full max-w-3xl flex items-center justify-between px-2">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-black tabular-nums text-indigo-400">{liveWpm}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('typingtest.wpm')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black tabular-nums text-emerald-400">{liveAccuracy}%</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('typingtest.accuracy')}</div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black tabular-nums text-zinc-300">{timeLeft}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">s</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-3xl h-1 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-200 ease-linear rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Text display */}
        <div
          ref={containerRef}
          className="w-full max-w-3xl flex-1 min-h-0 overflow-y-auto bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 focus:outline-none scrollbar-none"
          tabIndex={-1}
        >
          <p className="font-mono text-xl leading-relaxed tracking-wide break-words select-none whitespace-pre-wrap">
            {text.split('').map((ch, i) => (
              <span
                key={i}
                ref={(el) => setCharRef(el, i)}
                className={i === 0 && cursorRef.current === 0
                  ? 'bg-indigo-500/30 text-zinc-100 border-b-2 border-indigo-400'
                  : 'text-zinc-600'}
              >
                {ch}
              </span>
            ))}
          </p>
        </div>

        {/* Hint */}
        {phase === 'ready' && (
          <p className="text-sm text-zinc-500 animate-pulse">{t('typingtest.startTyping')}</p>
        )}
      </div>
    );
  }

  // ── Ended ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      {/* Big WPM */}
      <div className="text-center">
        <div className="text-7xl font-black tabular-nums text-indigo-400">{finalWpm}</div>
        <div className="text-sm text-zinc-500 uppercase tracking-widest mt-1">{t('typingtest.wpm')}</div>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 text-center">
        <div>
          <div className="text-2xl font-bold tabular-nums text-emerald-400">{finalAccuracy}%</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('typingtest.accuracy')}</div>
        </div>
        <div className="w-px bg-zinc-700" />
        <div>
          <div className="text-2xl font-bold tabular-nums text-emerald-400">{finalCorrect}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('typingtest.correct')}</div>
        </div>
        <div className="w-px bg-zinc-700" />
        <div>
          <div className="text-2xl font-bold tabular-nums text-red-400">{finalIncorrect}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('typingtest.incorrect')}</div>
        </div>
        <div className="w-px bg-zinc-700" />
        <div>
          <div className="text-2xl font-bold tabular-nums text-zinc-300">{finalTotal}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('typingtest.chars')}</div>
        </div>
      </div>

      {/* WPM over time graph */}
      {finalSnapshots.length > 1 && (
        <div className="w-full max-w-md">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider text-center mb-2">
            {t('typingtest.wpmOverTime')}
          </div>
          <WpmGraph snapshots={finalSnapshots} />
        </div>
      )}

      {/* Play again */}
      <button
        onClick={() => setPhase('menu')}
        className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors"
      >
        {t('game.playAgain')}
      </button>
    </div>
  );
}

// ── WPM Graph (canvas) ──────────────────────────────────────────────────────

function WpmGraph({ snapshots }: { snapshots: WpmSnapshot[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || snapshots.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 10, right: 10, bottom: 24, left: 36 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const maxTime = snapshots[snapshots.length - 1].time || 1;
    const maxWpm = Math.max(...snapshots.map((s) => s.wpm), 10);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#52525b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      const val = Math.round(maxWpm * (1 - i / 4));
      ctx.fillText(String(val), pad.left - 6, y + 3);
    }
    ctx.textAlign = 'center';
    ctx.fillText('0s', pad.left, h - 4);
    ctx.fillText(`${maxTime}s`, pad.left + plotW, h - 4);

    // Line
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    for (let i = 0; i < snapshots.length; i++) {
      const s = snapshots[i];
      const x = pad.left + (s.time / maxTime) * plotW;
      const y = pad.top + plotH - (s.wpm / maxWpm) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Gradient fill under line
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    grad.addColorStop(0, 'rgba(129,140,248,0.2)');
    grad.addColorStop(1, 'rgba(129,140,248,0)');
    ctx.lineTo(pad.left + plotW, pad.top + plotH);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }, [snapshots]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-32 rounded-lg bg-zinc-900/60 border border-zinc-800"
    />
  );
}
