'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PublicScoreEntry } from '@/lib/personal-scores/types';
import { getScoreConfig } from '@/lib/personal-scores/config';
import { fetchPublicLeaderboard } from '@/lib/personal-scores/cloud';
import { getSupabase } from '@/lib/supabaseClient';

export function usePublicScores(gameId: string) {
  const [scores, setScores] = useState<PublicScoreEntry[]>([]);
  const [loading, setLoading] = useState(false);
  // Check Supabase availability eagerly so the tab switcher renders immediately
  const [available] = useState(() => !!getSupabase() && !!getScoreConfig(gameId));
  const fetchedRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const config = getScoreConfig(gameId);
    if (!config) return;

    setLoading(true);
    try {
      const entries = await fetchPublicLeaderboard(sb, gameId, config.publicMaxEntries);
      setScores(entries);
      fetchedRef.current = gameId;
    } catch {
      setScores([]);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Load on mount / gameId change
  useEffect(() => {
    if (fetchedRef.current !== gameId) {
      load();
    }
  }, [gameId, load]);

  return { scores, loading, available, refresh: load };
}
