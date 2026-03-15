'use client';
import { useSyncExternalStore } from 'react';

const MQ = '(max-height: 800px)';

function subscribe(cb: () => void) {
  const mql = window.matchMedia(MQ);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

function getSnapshot() {
  return window.matchMedia(MQ).matches;
}

function getServerSnapshot() {
  return false;
}

export function useCompact(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
