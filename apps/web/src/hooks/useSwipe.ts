'use client';

import { useRef, useCallback } from 'react';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

interface SwipeOptions {
  /** Minimum distance in pixels to register a swipe. Default: 30 */
  threshold?: number;
  onSwipe: (dir: SwipeDirection) => void;
}

/**
 * Returns touch handlers for swipe detection on a container element.
 * Attach the returned `onTouchStart` and `onTouchEnd` to the target element.
 */
export function useSwipe({ threshold = 30, onSwipe }: SwipeOptions) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!startRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    startRef.current = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < threshold && absDy < threshold) return;

    if (absDx > absDy) {
      onSwipe(dx > 0 ? 'right' : 'left');
    } else {
      onSwipe(dy > 0 ? 'down' : 'up');
    }
  }, [threshold, onSwipe]);

  return { onTouchStart, onTouchEnd };
}
