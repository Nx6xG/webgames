'use client';

import { useState, useCallback, useMemo } from 'react';

export interface UseReplayReturn<T> {
  /** Whether replay mode is currently active. */
  isReplaying: boolean;
  /** Current step index (0-based). -1 when not replaying. */
  currentStep: number;
  /** Total number of steps in the history. */
  totalSteps: number;
  /** The state/item at the current step, or null when not replaying. */
  currentState: T | null;
  /** The display state: replay state when replaying, otherwise null (caller should fall back to live state). */
  displayState: T | null;

  /** Enter replay mode, starting at the last step. */
  start: () => void;
  /** Exit replay mode. */
  stop: () => void;
  /** Go to the next step. No-op if at end or not replaying. */
  next: () => void;
  /** Go to the previous step. No-op if at start or not replaying. */
  prev: () => void;
  /** Jump to the first step. */
  goToStart: () => void;
  /** Jump to the last step. */
  goToEnd: () => void;
  /** Jump to a specific step index (clamped to valid range). */
  goToStep: (step: number) => void;
}

/**
 * Generic hook for stepping through a history array (e.g. state snapshots or moves).
 *
 * @param history - The ordered array of items to replay through.
 */
export function useReplay<T>(history: T[]): UseReplayReturn<T> {
  const [isReplaying, setIsReplaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const totalSteps = history.length;

  const clamp = useCallback((step: number) => {
    return Math.max(0, Math.min(totalSteps - 1, step));
  }, [totalSteps]);

  const start = useCallback(() => {
    if (totalSteps < 2) return;
    setIsReplaying(true);
    setCurrentStep(totalSteps - 1);
  }, [totalSteps]);

  const stop = useCallback(() => {
    setIsReplaying(false);
    setCurrentStep(0);
  }, []);

  const next = useCallback(() => {
    if (!isReplaying) return;
    setCurrentStep(s => {
      const n = s + 1;
      if (n >= totalSteps) {
        // Reached the end — exit replay
        setIsReplaying(false);
        return 0;
      }
      return n;
    });
  }, [isReplaying, totalSteps]);

  const prev = useCallback(() => {
    if (!isReplaying) return;
    setCurrentStep(s => Math.max(0, s - 1));
  }, [isReplaying]);

  const goToStart = useCallback(() => {
    if (!isReplaying && totalSteps >= 2) {
      setIsReplaying(true);
    }
    setCurrentStep(0);
  }, [isReplaying, totalSteps]);

  const goToEnd = useCallback(() => {
    // Going to end exits replay (shows live state)
    setIsReplaying(false);
    setCurrentStep(0);
  }, []);

  const goToStep = useCallback((step: number) => {
    if (totalSteps === 0) return;
    const clamped = clamp(step);
    if (clamped >= totalSteps - 1 && totalSteps > 0) {
      // At the last step — could exit replay or stay
      setCurrentStep(clamped);
    } else {
      if (!isReplaying) setIsReplaying(true);
      setCurrentStep(clamped);
    }
  }, [totalSteps, clamp, isReplaying]);

  const currentState = useMemo(() => {
    if (!isReplaying || totalSteps === 0) return null;
    return history[currentStep] ?? null;
  }, [isReplaying, currentStep, history, totalSteps]);

  // Alias — same as currentState, null when not replaying
  const displayState = currentState;

  return {
    isReplaying,
    currentStep,
    totalSteps,
    currentState,
    displayState,
    start,
    stop,
    next,
    prev,
    goToStart,
    goToEnd,
    goToStep,
  };
}
