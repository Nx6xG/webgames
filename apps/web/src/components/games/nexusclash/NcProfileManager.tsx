'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { NcPlayerProfile, NcDeckSlot, NcQuest, NcQuestGoal } from 'shared';
import {
  createDefaultNcProfile, NC_WIN_COINS, NC_LOSS_COINS,
  NC_DAILY_QUEST_COINS, NC_WEEKLY_QUEST_GEMS,
} from 'shared';

const PROFILE_KEY = 'webgames.nexusclash.profile';

function loadProfile(): NcPlayerProfile {
  if (typeof window === 'undefined') return createDefaultNcProfile();
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw) as NcPlayerProfile;
  } catch { /* fallback */ }
  return createDefaultNcProfile();
}

function saveProfile(profile: NcPlayerProfile) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch { /* ignore quota */ }
}

// ── Quest generation ──────────────────────────────────────────────────────

const DAILY_GOALS: Array<{ goal: NcQuestGoal; target: number; param?: string; reward: { coins?: number } }> = [
  { goal: 'play_matches', target: 2, reward: { coins: NC_DAILY_QUEST_COINS } },
  { goal: 'win_matches', target: 1, reward: { coins: NC_DAILY_QUEST_COINS } },
  { goal: 'place_cards', target: 10, reward: { coins: NC_DAILY_QUEST_COINS } },
  { goal: 'achieve_breakthrough', target: 2, reward: { coins: NC_DAILY_QUEST_COINS } },
  { goal: 'play_tag_cards', target: 5, param: 'divine', reward: { coins: NC_DAILY_QUEST_COINS } },
  { goal: 'play_tag_cards', target: 5, param: 'beast', reward: { coins: NC_DAILY_QUEST_COINS } },
  { goal: 'play_tag_cards', target: 5, param: 'arcane', reward: { coins: NC_DAILY_QUEST_COINS } },
];

const WEEKLY_GOALS: Array<{ goal: NcQuestGoal; target: number; reward: { gems?: number } }> = [
  { goal: 'win_matches', target: 5, reward: { gems: NC_WEEKLY_QUEST_GEMS } },
  { goal: 'play_matches', target: 10, reward: { gems: NC_WEEKLY_QUEST_GEMS } },
  { goal: 'achieve_breakthrough', target: 10, reward: { gems: NC_WEEKLY_QUEST_GEMS } },
  { goal: 'play_unique_cards', target: 15, reward: { gems: NC_WEEKLY_QUEST_GEMS } },
  { goal: 'destroy_enemy_cards', target: 5, reward: { gems: NC_WEEKLY_QUEST_GEMS } },
];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateQuests(type: 'daily' | 'weekly', now: string): NcQuest[] {
  const goals = type === 'daily' ? pickRandom(DAILY_GOALS, 3) : pickRandom(WEEKLY_GOALS, 3);
  return goals.map((g, i) => ({
    id: `${type}_${now}_${i}`,
    type,
    goalType: g.goal,
    goalParam: 'param' in g ? g.param : undefined,
    targetCount: g.target,
    currentCount: 0,
    reward: g.reward,
    generatedAt: now,
    completed: false,
  }));
}

function checkAndRefreshQuests(profile: NcPlayerProfile): NcPlayerProfile {
  const today = new Date().toISOString().slice(0, 10);
  const weekStr = getWeekString();
  let updated = { ...profile, quests: [...profile.quests] };

  if (updated.lastDailyReset !== today) {
    updated.quests = updated.quests.filter(q => q.type !== 'daily');
    updated.quests.push(...generateQuests('daily', today));
    updated.lastDailyReset = today;
  }

  if (updated.lastWeeklyReset !== weekStr) {
    updated.quests = updated.quests.filter(q => q.type !== 'weekly');
    updated.quests.push(...generateQuests('weekly', weekStr));
    updated.lastWeeklyReset = weekStr;
  }

  return updated;
}

function getWeekString(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useNcProfile() {
  const [profile, setProfile] = useState<NcPlayerProfile>(() => createDefaultNcProfile());
  const hydratedRef = useRef(false);
  const saveRef = useRef(false);

  // Load from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      const p = loadProfile();
      setProfile(checkAndRefreshQuests(p));
    }
  }, []);

  // Save whenever profile changes (skip the initial hydration load)
  useEffect(() => {
    if (saveRef.current) {
      saveProfile(profile);
    }
    saveRef.current = true;
  }, [profile]);

  const updateProfile = useCallback((newProfile: NcPlayerProfile) => {
    setProfile(newProfile);
  }, []);

  const saveDecks = useCallback((decks: NcDeckSlot[], selectedDeckId: string) => {
    setProfile(prev => ({ ...prev, decks, selectedDeckId }));
  }, []);

  const claimQuest = useCallback((questId: string) => {
    setProfile(prev => {
      const quest = prev.quests.find(q => q.id === questId);
      if (!quest || quest.completed || quest.currentCount < quest.targetCount) return prev;

      const newCurrencies = { ...prev.currencies };
      if (quest.reward.coins) newCurrencies.coins += quest.reward.coins;
      if (quest.reward.gems) newCurrencies.gems += quest.reward.gems;

      return {
        ...prev,
        currencies: newCurrencies,
        quests: prev.quests.map(q => q.id === questId ? { ...q, completed: true } : q),
      };
    });
  }, []);

  const trackMatchEnd = useCallback((won: boolean, breakthroughs: number, cardsPlayed: number, tags: string[], destroyedCards: number, uniqueCards: number) => {
    setProfile(prev => {
      const newProfile = {
        ...prev,
        matchesPlayed: prev.matchesPlayed + 1,
        wins: won ? prev.wins + 1 : prev.wins,
        currencies: {
          ...prev.currencies,
          coins: prev.currencies.coins + (won ? NC_WIN_COINS : NC_LOSS_COINS),
        },
        quests: prev.quests.map(q => {
          if (q.completed) return q;
          let inc = 0;
          switch (q.goalType) {
            case 'play_matches': inc = 1; break;
            case 'win_matches': inc = won ? 1 : 0; break;
            case 'place_cards': inc = cardsPlayed; break;
            case 'achieve_breakthrough': inc = breakthroughs; break;
            case 'play_tag_cards':
              inc = tags.filter(tg => tg === q.goalParam).length;
              break;
            case 'destroy_enemy_cards': inc = destroyedCards; break;
            case 'play_unique_cards': inc = uniqueCards; break;
            default: break;
          }
          if (inc === 0) return q;
          return { ...q, currentCount: Math.min(q.currentCount + inc, q.targetCount) };
        }),
      };
      return newProfile;
    });
  }, []);

  return { profile, updateProfile, saveDecks, claimQuest, trackMatchEnd };
}
