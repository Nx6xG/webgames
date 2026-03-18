'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { NcPlayerProfile, NcDeckSlot, NcQuest, NcQuestGoal, NcMatchRecord, NcBattlePassState, NcBpReward, NcRankedState, NcRankReward } from 'shared';
import {
  createDefaultNcProfile, NC_WIN_COINS, NC_LOSS_COINS,
  NC_DAILY_QUEST_COINS, NC_WEEKLY_QUEST_GEMS,
  getNcDailyReward, NC_MAX_MATCH_HISTORY,
  NC_BP_WIN_XP, NC_BP_LOSS_XP, NC_BP_QUEST_XP,
  NC_BP_SEASON_ID, NC_BP_PREMIUM_COST, NC_BP_TIERS,
  getNcBpTier, createDefaultBattlePass,
  NC_STANDARD_RATES, NC_CARDS_BY_RARITY,
  NC_RANK_WIN_POINTS, NC_RANK_LOSS_POINTS, NC_RANK_REWARDS,
  getNcRank, getNcCurrentSeason,
  NC_STARTER_CARDS,
} from 'shared';

import { getSupabase } from '@/lib/supabaseClient';

const PROFILE_KEY = 'webgames.nexusclash.profile';

function loadProfile(): NcPlayerProfile {
  if (typeof window === 'undefined') return createDefaultNcProfile();
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as NcPlayerProfile;
      // Migrate: add shards if missing
      if (p.currencies.shards === undefined) p.currencies.shards = 0;
      // Migrate: add lastLoginReward if missing
      if (!p.lastLoginReward) p.lastLoginReward = '';
      if (p.loginDay === undefined) p.loginDay = 0;
      if (!Array.isArray(p.matchHistory)) p.matchHistory = [];
      // Migrate: add battlePass if missing or outdated season
      if (!p.battlePass || p.battlePass.seasonId !== NC_BP_SEASON_ID) {
        p.battlePass = createDefaultBattlePass();
      }
      // Migrate: grant any new starter commons not yet in collection
      for (const id of NC_STARTER_CARDS) {
        if (!p.collection.cards[id]) {
          p.collection.cards[id] = 1;
        }
      }
      return p;
    }
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
  { goal: 'play_tag_cards', target: 5, param: 'spell', reward: { coins: NC_DAILY_QUEST_COINS } },
  { goal: 'play_tag_cards', target: 5, param: 'dragon', reward: { coins: NC_DAILY_QUEST_COINS } },
  { goal: 'play_tag_cards', target: 5, param: 'demon', reward: { coins: NC_DAILY_QUEST_COINS } },
  { goal: 'play_tag_cards', target: 5, param: 'relic', reward: { coins: NC_DAILY_QUEST_COINS } },
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
  // Daily login check runs HERE (not in a separate effect) to avoid
  // claiming rewards against the default empty profile before hydration.
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      let p = loadProfile();
      p = checkAndRefreshQuests(p);

      // Check daily login reward against the REAL loaded profile
      const today = new Date().toISOString().slice(0, 10);
      if (p.lastLoginReward !== today) {
        const nextDay = (p.loginDay ?? 0) + 1;
        const reward = getNcDailyReward(nextDay);
        p = {
          ...p,
          lastLoginReward: today,
          loginDay: nextDay,
          currencies: {
            ...p.currencies,
            coins: p.currencies.coins + reward.coins,
            shards: (p.currencies.shards ?? 0) + reward.shards,
            gems: p.currencies.gems + (reward.gems ?? 0),
          },
        };
        setDailyLoginReward({ day: nextDay, ...reward });
      }

      // Check ranked season reset
      const currentSeason = getNcCurrentSeason();
      if (p.ranked && p.ranked.seasonId !== currentSeason) {
        const prevPeak = p.ranked.peakPoints;
        const peakRank = getNcRank(prevPeak);
        const reward = NC_RANK_REWARDS[peakRank.tier];
        setRankSeasonReward({ peakTier: peakRank.tier, reward, prevPoints: prevPeak });
        // Grant season rewards + reset
        p = {
          ...p,
          currencies: {
            ...p.currencies,
            coins: p.currencies.coins + reward.coins,
            gems: p.currencies.gems + reward.gems,
          },
          ranked: {
            points: 0,
            peakPoints: 0,
            seasonId: currentSeason,
            seasonWins: 0,
            seasonLosses: 0,
          },
        };
      }

      setProfile(p);
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
        battlePass: prev.battlePass ? {
          ...prev.battlePass,
          xp: Math.min(prev.battlePass.xp + NC_BP_QUEST_XP, NC_BP_TIERS[NC_BP_TIERS.length - 1].xpRequired),
        } : prev.battlePass,
      };
    });
  }, []);

  const trackMatchEnd = useCallback((
    won: boolean,
    breakthroughs: number,
    cardsPlayed: number,
    tags: string[],
    destroyedCards: number,
    uniqueCards: number,
    matchInfo?: { isDraw?: boolean; opponent: string; oppBreakthroughs: number; rounds: number; deckName: string },
  ) => {
    setProfile(prev => {
      const result: 'win' | 'loss' | 'draw' = matchInfo?.isDraw ? 'draw' : won ? 'win' : 'loss';
      const record: NcMatchRecord = {
        date: new Date().toISOString(),
        result,
        opponent: matchInfo?.opponent ?? 'Unknown',
        myBreakthroughs: breakthroughs,
        oppBreakthroughs: matchInfo?.oppBreakthroughs ?? 0,
        rounds: matchInfo?.rounds ?? 0,
        cardsPlayed,
        deckName: matchInfo?.deckName ?? 'Unknown',
      };
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
        matchHistory: [record, ...prev.matchHistory.slice(0, NC_MAX_MATCH_HISTORY - 1)],
        battlePass: prev.battlePass ? {
          ...prev.battlePass,
          xp: Math.min(prev.battlePass.xp + (won ? NC_BP_WIN_XP : NC_BP_LOSS_XP), NC_BP_TIERS[NC_BP_TIERS.length - 1].xpRequired),
        } : prev.battlePass,
      };
      // Update ranked ladder
      const currentSeason = getNcCurrentSeason();
      const prevRanked: NcRankedState = newProfile.ranked?.seasonId === currentSeason
        ? newProfile.ranked
        : { points: 0, peakPoints: 0, seasonId: currentSeason, seasonWins: 0, seasonLosses: 0 };
      const delta = won ? NC_RANK_WIN_POINTS : -NC_RANK_LOSS_POINTS;
      const newPoints = Math.max(0, prevRanked.points + delta);
      newProfile.ranked = {
        ...prevRanked,
        points: newPoints,
        peakPoints: Math.max(prevRanked.peakPoints, newPoints),
        seasonWins: prevRanked.seasonWins + (won ? 1 : 0),
        seasonLosses: prevRanked.seasonLosses + (won ? 0 : 1),
      };
      return newProfile;
    });
  }, []);

  // Daily login reward state — set during hydration effect above, not in a separate effect
  const [dailyLoginReward, setDailyLoginReward] = useState<{ day: number; coins: number; shards: number; gems?: number } | null>(null);

  const dismissDailyLogin = useCallback(() => {
    setDailyLoginReward(null);
  }, []);

  // Rank season reset reward — shown once when a new season starts
  const [rankSeasonReward, setRankSeasonReward] = useState<{ peakTier: string; reward: NcRankReward; prevPoints: number } | null>(null);

  const dismissRankReward = useCallback(() => {
    setRankSeasonReward(null);
  }, []);

  // Admin grant reward popup
  const [adminGrantReward, setAdminGrantReward] = useState<{
    coins: number; gems: number; shards: number; cards: string[]; removedCards: string[]; note: string | null;
  } | null>(null);

  const dismissAdminGrant = useCallback(() => {
    setAdminGrantReward(null);
  }, []);

  // Claim admin grants from Supabase (if user is logged in)
  const claimAdminGrants = useCallback(async (userId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const { data: grants } = await sb
        .from('nc_admin_grants')
        .select('id, coins, gems, shards, cards, note')
        .eq('user_id', userId)
        .eq('claimed', false);
      if (!grants || grants.length === 0) return;

      // Mark as claimed FIRST to prevent double-claiming on reload
      const ids = grants.map(g => g.id);
      const { error: claimErr } = await sb.from('nc_admin_grants').update({ claimed: true }).in('id', ids);
      if (claimErr) return; // If claim fails, don't apply rewards

      // Aggregate all grants into one summary
      let totalCoins = 0, totalGems = 0, totalShards = 0;
      const allCards: string[] = [];
      let lastNote: string | null = null;
      for (const g of grants) {
        totalCoins += g.coins ?? 0;
        totalGems += g.gems ?? 0;
        totalShards += g.shards ?? 0;
        for (const cardId of (g.cards ?? [])) {
          if (!allCards.includes(cardId)) allCards.push(cardId);
        }
        if (g.note) lastNote = g.note;
      }

      // Separate added vs removed cards (prefix '-' = remove)
      const addedCards: string[] = [];
      const removedCards: string[] = [];
      for (const c of allCards) {
        if (c.startsWith('-')) removedCards.push(c.slice(1));
        else addedCards.push(c);
      }

      // Apply grants to profile only after successful claim
      setProfile(prev => {
        const p = { ...prev, currencies: { ...prev.currencies }, collection: { ...prev.collection, cards: { ...prev.collection.cards } } };
        p.currencies.coins = Math.max(0, p.currencies.coins + totalCoins);
        p.currencies.gems = Math.max(0, p.currencies.gems + totalGems);
        p.currencies.shards = Math.max(0, (p.currencies.shards ?? 0) + totalShards);
        for (const cardId of addedCards) {
          p.collection.cards[cardId] = 1;
        }
        for (const cardId of removedCards) {
          delete p.collection.cards[cardId];
        }
        return p;
      });

      // Show reward popup (for both grants and removals)
      const hasChanges = totalCoins !== 0 || totalGems !== 0 || totalShards !== 0 || addedCards.length > 0 || removedCards.length > 0;
      if (hasChanges) {
        setAdminGrantReward({ coins: totalCoins, gems: totalGems, shards: totalShards, cards: addedCards, removedCards, note: lastNote });
      }
    } catch { /* ignore — table might not exist yet */ }
  }, []);

  // ── Battle Pass ──────────────────────────────────────────────────────────

  const applyBpReward = useCallback((reward: NcBpReward, setter: typeof setProfile) => {
    setter(prev => {
      const p = { ...prev, currencies: { ...prev.currencies }, collection: { ...prev.collection, cards: { ...prev.collection.cards } } };
      if (reward.type === 'coins' && reward.amount) p.currencies.coins += reward.amount;
      if (reward.type === 'gems' && reward.amount) p.currencies.gems += reward.amount;
      if (reward.type === 'shards' && reward.amount) p.currencies.shards += reward.amount;
      if (reward.type === 'card' && reward.cardId) p.collection.cards[reward.cardId] = 1;
      if (reward.type === 'pack') {
        // Grant a free standard pack worth of cards
        for (let i = 0; i < 3; i++) {
          const roll = Math.random();
          let cumulative = 0;
          let rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common';
          for (const [r, rate] of Object.entries(NC_STANDARD_RATES) as Array<[typeof rarity, number]>) {
            cumulative += rate;
            if (roll < cumulative) { rarity = r; break; }
          }
          const pool = NC_CARDS_BY_RARITY[rarity];
          if (pool.length > 0) {
            const card = pool[Math.floor(Math.random() * pool.length)];
            if (!p.collection.cards[card.id]) {
              p.collection.cards[card.id] = 1;
            } else {
              p.currencies.coins += 10;
            }
          }
        }
      }
      return p;
    });
  }, []);

  const claimBpReward = useCallback((level: number, track: 'free' | 'paid') => {
    setProfile(prev => {
      const bp = prev.battlePass;
      if (!bp) return prev;
      const tier = NC_BP_TIERS.find(t => t.level === level);
      if (!tier) return prev;
      const currentTier = getNcBpTier(bp.xp);
      if (level > currentTier) return prev;
      if (track === 'paid' && !bp.isPremium) return prev;
      const claimed = track === 'free' ? bp.claimedFree : bp.claimedPaid;
      if (claimed.includes(level)) return prev;
      const reward = track === 'free' ? tier.freeReward : tier.paidReward;

      // Apply the reward
      const newBp = { ...bp, [track === 'free' ? 'claimedFree' : 'claimedPaid']: [...claimed, level] };
      const p = { ...prev, battlePass: newBp, currencies: { ...prev.currencies }, collection: { ...prev.collection, cards: { ...prev.collection.cards } } };
      if (reward.type === 'coins' && reward.amount) p.currencies.coins += reward.amount;
      if (reward.type === 'gems' && reward.amount) p.currencies.gems += reward.amount;
      if (reward.type === 'shards' && reward.amount) p.currencies.shards += reward.amount;
      if (reward.type === 'card' && reward.cardId) p.collection.cards[reward.cardId] = 1;
      if (reward.type === 'pack') {
        for (let i = 0; i < 3; i++) {
          const roll = Math.random();
          let cumulative = 0;
          let rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common';
          for (const [r, rate] of Object.entries(NC_STANDARD_RATES) as Array<[typeof rarity, number]>) {
            cumulative += rate;
            if (roll < cumulative) { rarity = r; break; }
          }
          const pool = NC_CARDS_BY_RARITY[rarity];
          if (pool.length > 0) {
            const card = pool[Math.floor(Math.random() * pool.length)];
            if (!p.collection.cards[card.id]) p.collection.cards[card.id] = 1;
            else p.currencies.coins += 10;
          }
        }
      }
      return p;
    });
  }, []);

  const toggleFavorite = useCallback((cardId: string) => {
    setProfile(prev => {
      const favs = prev.favorites ?? [];
      const idx = favs.indexOf(cardId);
      const next = idx >= 0 ? favs.filter(f => f !== cardId) : [...favs, cardId];
      return { ...prev, favorites: next };
    });
  }, []);

  const unlockBpPremium = useCallback(() => {
    setProfile(prev => {
      if (!prev.battlePass || prev.battlePass.isPremium) return prev;
      if (prev.currencies.gems < NC_BP_PREMIUM_COST) return prev;
      return {
        ...prev,
        currencies: { ...prev.currencies, gems: prev.currencies.gems - NC_BP_PREMIUM_COST },
        battlePass: { ...prev.battlePass, isPremium: true },
      };
    });
  }, []);

  return { profile, updateProfile, saveDecks, claimQuest, trackMatchEnd, dailyLoginReward, dismissDailyLogin, claimAdminGrants, adminGrantReward, dismissAdminGrant, claimBpReward, unlockBpPremium, toggleFavorite, rankSeasonReward, dismissRankReward };
}
