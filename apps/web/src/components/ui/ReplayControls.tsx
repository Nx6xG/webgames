'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import type { UseReplayReturn } from '@/hooks/useReplay';

// Re-export hook for convenience
export { useReplay } from '@/hooks/useReplay';
export type { UseReplayReturn } from '@/hooks/useReplay';

interface ReplayControlsProps<T> {
  /** Return value from useReplay(history). */
  replay: UseReplayReturn<T>;
  /** Whether the game has ended (only show replay button when ended). */
  gameEnded: boolean;
}

export function ReplayControls<T>({
  replay,
  gameEnded,
}: ReplayControlsProps<T>) {
  const { t } = useI18n();
  const { isReplaying, currentStep, totalSteps, start, stop, next, prev, goToStart, goToEnd, goToStep } = replay;

  if (!gameEnded || totalSteps < 2) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {!isReplaying ? (
        <button
          onClick={start}
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
            {currentStep + 1} / {totalSteps}
          </span>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <NavButton label="⏮" onClick={goToStart} disabled={currentStep === 0} />
            <NavButton label="◀" onClick={prev} disabled={currentStep === 0} />
            <NavButton label="▶" onClick={next} disabled={currentStep === totalSteps - 1} />
            <NavButton label="⏭" onClick={goToEnd} disabled={currentStep === totalSteps - 1} />
          </div>

          {/* Scrubber */}
          <input
            type="range"
            min={0}
            max={totalSteps - 1}
            value={currentStep}
            onChange={(e) => goToStep(Number(e.target.value))}
            className="w-full h-1 accent-indigo-500 bg-zinc-700 rounded-full cursor-pointer"
          />

          {/* Exit */}
          <button
            onClick={stop}
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
