'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';

interface ReplayControlsProps<TState> {
  /** Full ordered list of state snapshots (from useMultiplayer.stateHistory). */
  history: TState[];
  /** Called when the user navigates to a different step. Receives the state at that step. */
  onStep: (state: TState, stepIndex: number) => void;
  /** Called when replay mode is toggled on/off. */
  onToggle: (active: boolean) => void;
  /** Whether the game has ended (only show replay button when ended). */
  gameEnded: boolean;
}

export function useReplay<TState>() {
  const [replayActive, setReplayActive] = useState(false);
  const [replayStep, setReplayStep] = useState(0);

  const enterReplay = useCallback((historyLength: number) => {
    setReplayActive(true);
    setReplayStep(historyLength - 1);
  }, []);

  const exitReplay = useCallback(() => {
    setReplayActive(false);
    setReplayStep(0);
  }, []);

  return { replayActive, replayStep, setReplayStep, enterReplay, exitReplay };
}

export function ReplayControls<TState>({
  history,
  onStep,
  onToggle,
  gameEnded,
}: ReplayControlsProps<TState>) {
  const { t } = useI18n();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const total = history.length;

  const toggle = useCallback(() => {
    if (active) {
      setActive(false);
      onToggle(false);
      // Restore to final state
      if (total > 0) onStep(history[total - 1], total - 1);
    } else {
      setActive(true);
      setStep(total - 1);
      onToggle(true);
    }
  }, [active, onToggle, onStep, history, total]);

  const goTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(total - 1, idx));
    setStep(clamped);
    onStep(history[clamped], clamped);
  }, [total, onStep, history]);

  if (!gameEnded || total < 2) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {!active ? (
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 text-xs font-semibold transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          {t('replay.button')}
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2 p-3 rounded-xl border border-zinc-700 bg-zinc-800/60 w-full max-w-xs">
          <div className="flex items-center gap-1 text-xs text-zinc-400 font-medium">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            {t('replay.title')}
          </div>

          {/* Step indicator */}
          <span className="text-xs text-zinc-500 tabular-nums">
            {step + 1} / {total}
          </span>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <NavButton label="⏮" onClick={() => goTo(0)} disabled={step === 0} />
            <NavButton label="◀" onClick={() => goTo(step - 1)} disabled={step === 0} />
            <NavButton label="▶" onClick={() => goTo(step + 1)} disabled={step === total - 1} />
            <NavButton label="⏭" onClick={() => goTo(total - 1)} disabled={step === total - 1} />
          </div>

          {/* Scrubber */}
          <input
            type="range"
            min={0}
            max={total - 1}
            value={step}
            onChange={(e) => goTo(Number(e.target.value))}
            className="w-full h-1 accent-indigo-500 bg-zinc-700 rounded-full cursor-pointer"
          />

          {/* Exit */}
          <button
            onClick={toggle}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {t('replay.exit')}
          </button>
        </div>
      )}
    </div>
  );
}

function NavButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-md bg-zinc-700/60 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed text-sm text-zinc-200 transition-colors"
    >
      {label}
    </button>
  );
}
