import { useEffect } from 'react';

/**
 * Automatically triggers a pause callback when the browser tab becomes hidden.
 * @param isActive — whether the game is currently in a state that can be paused (e.g. 'running' / 'playing')
 * @param onPause — callback to trigger the pause
 */
export function useVisibilityPause(isActive: boolean, onPause: () => void) {
  useEffect(() => {
    if (!isActive) return;
    function handleVisibility() {
      if (document.hidden) onPause();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isActive, onPause]);
}
