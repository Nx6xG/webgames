'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PlayerProgression, LevelProgress } from '@/lib/progression';
import { loadProgression, saveProgression, getLevelProgress } from '@/lib/progression';
import { fetchCloudProgression, saveCloudProgression } from '@/lib/cloudSync';
import { useAuth } from '@/components/providers/AuthProvider';
import { getSupabase } from '@/lib/supabaseClient';

const STORAGE_KEY = 'webgames_progression_v1';
const DEBOUNCE_MS = 1000;

interface ProgressionContextValue {
  progression: PlayerProgression;
  levelProgress: LevelProgress;
  setProgression: (p: PlayerProgression) => void;
  refreshFromLocal: () => void;
  isCloudLoaded: boolean;
  /** True after first client-side mount (localStorage has been read). Use to guard SSR-sensitive UI. */
  isHydrated: boolean;
}

function defaultProgression(): PlayerProgression {
  return {
    xp: 0,
    level: 1,
    tokens: 0,
    dailyXpEarned: 0,
    dailyXpDate: '',
    gotdBonusDate: '',
    winStreak: 0,
    _lastWasWin: false,
    _pendingMultiplayerResult: false,
  };
}

const DEFAULTS = defaultProgression();

const ProgressionContext = createContext<ProgressionContextValue>({
  progression: DEFAULTS,
  levelProgress: getLevelProgress(DEFAULTS),
  setProgression: () => {},
  refreshFromLocal: () => {},
  isCloudLoaded: false,
  isHydrated: false,
});

export function ProgressionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Always start with defaults — matches SSR output. localStorage read happens in useEffect.
  const [progression, setProgressionState] = useState<PlayerProgression>(DEFAULTS);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const userIdRef = useRef<string | null>(null);

  // Derived level progress
  const levelProgress = useMemo(() => getLevelProgress(progression), [progression]);

  // Refresh from localStorage
  const refreshFromLocal = useCallback(() => {
    setProgressionState(loadProgression());
  }, []);

  // Hydrate from localStorage on first client mount
  useEffect(() => {
    setProgressionState(loadProgression());
    setIsHydrated(true);
  }, []);

  // Set progression: update state + localStorage + debounced cloud save
  const setProgression = useCallback(
    (p: PlayerProgression) => {
      setProgressionState(p);
      saveProgression(p);

      // Debounced cloud sync
      if (userIdRef.current) {
        clearTimeout(debounceRef.current);
        const userId = userIdRef.current;
        debounceRef.current = setTimeout(() => {
          const sb = getSupabase();
          if (sb && userId) {
            saveCloudProgression(sb, userId, p).catch((err) =>
              console.error('[ProgressionProvider] cloud save error:', err),
            );
          }
        }, DEBOUNCE_MS);
      }
    },
    [],
  );

  // Track user ID for cloud sync
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  // On auth: load from Supabase, merge with local
  useEffect(() => {
    if (!user) {
      setIsCloudLoaded(false);
      return;
    }

    const sb = getSupabase();
    if (!sb) return;

    let cancelled = false;

    (async () => {
      try {
        const cloud = await fetchCloudProgression(sb, user.id);
        if (cancelled) return;

        if (cloud) {
          const local = loadProgression();
          const localAhead =
            local.level > cloud.level ||
            (local.level === cloud.level && local.xp >= cloud.xp);
          const merged = localAhead
            ? { ...local, tokens: Math.max(local.tokens, cloud.tokens) }
            : { ...local, ...cloud, tokens: Math.max(local.tokens, cloud.tokens) };

          setProgressionState(merged);
          saveProgression(merged);
        }
      } catch (err) {
        console.error('[ProgressionProvider] cloud load error:', err);
      } finally {
        if (!cancelled) setIsCloudLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Listen for cloud-sync-done event from AuthProvider
  useEffect(() => {
    function onSyncDone() {
      refreshFromLocal();
    }
    window.addEventListener('webgames:cloud-sync-done', onSyncDone);
    return () => window.removeEventListener('webgames:cloud-sync-done', onSyncDone);
  }, [refreshFromLocal]);

  // Cross-tab sync via storage event
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        refreshFromLocal();
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshFromLocal]);

  const value = useMemo<ProgressionContextValue>(
    () => ({ progression, levelProgress, setProgression, refreshFromLocal, isCloudLoaded, isHydrated }),
    [progression, levelProgress, setProgression, refreshFromLocal, isCloudLoaded, isHydrated],
  );

  return (
    <ProgressionContext.Provider value={value}>
      {children}
    </ProgressionContext.Provider>
  );
}

export function useProgression(): ProgressionContextValue {
  return useContext(ProgressionContext);
}
