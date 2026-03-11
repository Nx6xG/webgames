'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PersonalScoreEntry } from '@/lib/personal-scores/types';
import { getScoreConfig } from '@/lib/personal-scores/config';
import { loadScores, insertScore, clearScores } from '@/lib/personal-scores/storage';
import { submitPublicScore } from '@/lib/personal-scores/cloud';
import { getSupabase } from '@/lib/supabaseClient';

interface CloudCtx {
  userId: string;
  nickname: string;
}

export function usePersonalScores(gameId: string, cloudCtx?: CloudCtx) {
  const [scores, setScores] = useState<PersonalScoreEntry[]>([]);
  const [lastInsertId, setLastInsertId] = useState<string | null>(null);
  const configRef = useRef(getScoreConfig(gameId));
  const cloudCtxRef = useRef(cloudCtx);
  cloudCtxRef.current = cloudCtx;

  useEffect(() => {
    configRef.current = getScoreConfig(gameId);
    setScores(loadScores(gameId));
    setLastInsertId(null);
  }, [gameId]);

  /** Submit a score. Returns the rank index (0-based) if accepted, or null. */
  const submit = useCallback(
    (score: number, meta?: Record<string, number | string | boolean>): number | null => {
      const config = configRef.current;
      if (!config) return null;
      if (!config.shouldStore(score, meta)) return null;

      const entry: PersonalScoreEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        score,
        createdAt: Date.now(),
        meta,
      };

      const { entries, index } = insertScore(gameId, entry, config);
      if (index < 0) return null;

      setScores(entries);
      setLastInsertId(entry.id);

      // Also submit to cloud if user is logged in
      const ctx = cloudCtxRef.current;
      const sb = getSupabase();
      if (ctx && sb) {
        submitPublicScore(sb, ctx.userId, ctx.nickname, gameId, score, meta).catch(() => {});
      }

      return index;
    },
    [gameId],
  );

  const clear = useCallback(() => {
    clearScores(gameId);
    setScores([]);
    setLastInsertId(null);
  }, [gameId]);

  const best = scores[0] ?? null;
  const isNewBest = lastInsertId !== null && best?.id === lastInsertId;

  return { scores, best, isNewBest, lastInsertId, submit, clear };
}
