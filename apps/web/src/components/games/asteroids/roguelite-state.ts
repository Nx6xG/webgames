import type {
  PermanentUpgradeId,
  AnyUpgradeId,
  RogueliteSave,
  ActiveBuff,
  TempBuffDef,
  ShipId,
  MilestoneId,
  RunStats,
  DailyRunResult,
} from './roguelite-types';
import { PERMANENT_UPGRADES, POWERUP_UPGRADES, ALL_BUYABLE_UPGRADES, TEMP_BUFFS, MILESTONES, isPrestigeUnlocked } from './roguelite-data';

// ---------------------------------------------------------------------------
// LocalStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'webgames.asteroids.roguelite';

function defaultSave(): RogueliteSave {
  return {
    scrap: 0,
    upgrades: {},
    totalRuns: 0,
    bestWave: 0,
    bestScore: 0,
    ascensionLevel: 0,
    selectedShip: 'vanguard',
    unlockedMilestones: [],
    bestiary: {},
    totalBossesKilled: 0,
    totalAsteroidsKilled: 0,
    bestRunScrap: 0,
  };
}

export function loadRogueliteSave(): RogueliteSave {
  if (typeof window === 'undefined') return defaultSave();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as RogueliteSave;
    // Minimal validation
    if (
      typeof parsed.scrap !== 'number' ||
      typeof parsed.upgrades !== 'object' ||
      typeof parsed.totalRuns !== 'number' ||
      typeof parsed.bestWave !== 'number' ||
      typeof parsed.bestScore !== 'number'
    ) {
      return defaultSave();
    }
    parsed.ascensionLevel = parsed.ascensionLevel ?? 0;
    parsed.selectedShip = parsed.selectedShip ?? 'vanguard';
    parsed.unlockedMilestones = parsed.unlockedMilestones ?? [];
    parsed.bestiary = parsed.bestiary ?? {};
    parsed.totalBossesKilled = parsed.totalBossesKilled ?? 0;
    parsed.totalAsteroidsKilled = parsed.totalAsteroidsKilled ?? 0;
    parsed.bestRunScrap = parsed.bestRunScrap ?? 0;
    return parsed;
  } catch {
    return defaultSave();
  }
}

export function saveRogueliteSave(save: RogueliteSave): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Upgrade helpers
// ---------------------------------------------------------------------------

export function getUpgradeLevel(
  save: RogueliteSave,
  id: AnyUpgradeId,
): number {
  return save.upgrades[id] ?? 0;
}

/**
 * Attempt to buy the next tier of any upgrade (permanent or power-up).
 * Returns the updated save, or null if the player can't afford it or it's maxed.
 */
export function buyUpgrade(
  save: RogueliteSave,
  id: AnyUpgradeId,
): RogueliteSave | null {
  const def = ALL_BUYABLE_UPGRADES.find((u) => u.id === id);
  if (!def) return null;

  const currentTier = save.upgrades[id] ?? 0;
  if (currentTier >= def.maxTier) return null;

  const cost = def.costs[currentTier];
  if (save.scrap < cost) return null;

  return {
    ...save,
    scrap: save.scrap - cost,
    upgrades: {
      ...save.upgrades,
      [id]: currentTier + 1,
    },
  };
}

// ---------------------------------------------------------------------------
// Scrap helpers
// ---------------------------------------------------------------------------

export function addScrap(
  save: RogueliteSave,
  amount: number,
): RogueliteSave {
  return {
    ...save,
    scrap: save.scrap + amount,
  };
}

// ---------------------------------------------------------------------------
// Random buff selection
// ---------------------------------------------------------------------------

/**
 * Pick `count` random temp buffs that aren't already permanently active
 * (duration 0 buffs that are in activeBuffs). Ensures no duplicates in result.
 */
export function pickRandomBuffs(
  count: number,
  activeBuffs: ActiveBuff[],
  ascensionLevel: number = 0,
): TempBuffDef[] {
  // Exclude buffs that are already active with wavesRemaining === 0 (rest-of-run)
  const permanentActiveIds = new Set(
    activeBuffs
      .filter((b) => b.wavesRemaining === 0)
      .map((b) => b.id),
  );

  const eligible = TEMP_BUFFS.filter(
    (b) => !permanentActiveIds.has(b.id) && isPrestigeUnlocked(b.id, ascensionLevel),
  );

  // Fisher-Yates shuffle on a copy
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

// ---------------------------------------------------------------------------
// Ascension
// ---------------------------------------------------------------------------

export function canAscend(save: RogueliteSave): boolean {
  return PERMANENT_UPGRADES.every((u) => (save.upgrades[u.id] ?? 0) >= u.maxTier);
}

export function performAscension(save: RogueliteSave): RogueliteSave {
  return {
    ...save,
    scrap: 0,
    upgrades: {},
    ascensionLevel: (save.ascensionLevel ?? 0) + 1,
  };
}

// ---------------------------------------------------------------------------
// Ship selection
// ---------------------------------------------------------------------------

export function selectShip(save: RogueliteSave, shipId: ShipId): RogueliteSave {
  return { ...save, selectedShip: shipId };
}

export function isShipUnlocked(save: RogueliteSave, shipId: ShipId): boolean {
  if (shipId === 'vanguard') return true;
  // Prestige ship check
  if (isPrestigeUnlocked(shipId, -1) === false) {
    // It's prestige-gated — check ascension level
    return isPrestigeUnlocked(shipId, save.ascensionLevel ?? 0);
  }
  return MILESTONES.some(
    (m) =>
      m.unlock.type === 'ship' &&
      m.unlock.shipId === shipId &&
      save.unlockedMilestones.includes(m.id),
  );
}

// ---------------------------------------------------------------------------
// Milestone checking
// ---------------------------------------------------------------------------

export function checkMilestones(
  save: RogueliteSave,
  runStats: RunStats,
  wave: number,
  defeatedMegaBoss: boolean,
  noDamageBoss: boolean,
  allBuffsRun: boolean,
): MilestoneId[] {
  const newMs: MilestoneId[] = [];
  const has = (id: MilestoneId) => save.unlockedMilestones.includes(id);

  if (!has('reach_wave_10') && wave >= 10) newMs.push('reach_wave_10');
  if (!has('reach_wave_20') && wave >= 20) newMs.push('reach_wave_20');
  if (!has('reach_wave_30') && wave >= 30) newMs.push('reach_wave_30');
  if (!has('reach_wave_50') && wave >= 50) newMs.push('reach_wave_50');
  if (!has('kill_500_asteroids') && (save.totalAsteroidsKilled + runStats.asteroidsDestroyed) >= 500) newMs.push('kill_500_asteroids');
  if (!has('kill_50_bosses') && (save.totalBossesKilled + runStats.bossesKilled) >= 50) newMs.push('kill_50_bosses');
  if (!has('collect_20000_run_scrap') && runStats.scrapEarned >= 20000) newMs.push('collect_20000_run_scrap');
  if (!has('ascend_once') && save.ascensionLevel >= 1) newMs.push('ascend_once');
  if (!has('defeat_megaboss') && defeatedMegaBoss) newMs.push('defeat_megaboss');
  if (!has('no_damage_boss') && noDamageBoss) newMs.push('no_damage_boss');
  if (!has('all_buffs_run') && allBuffsRun) newMs.push('all_buffs_run');
  if (!has('max_all_upgrades') && PERMANENT_UPGRADES.every((u) => (save.upgrades[u.id] ?? 0) >= u.maxTier)) newMs.push('max_all_upgrades');
  // Prestige milestones — unlock at specific ascension levels
  if (!has('prestige_stellar') && save.ascensionLevel >= 1) newMs.push('prestige_stellar');
  if (!has('prestige_crystal') && save.ascensionLevel >= 2) newMs.push('prestige_crystal');
  if (!has('prestige_plasma') && save.ascensionLevel >= 2) newMs.push('prestige_plasma');
  if (!has('prestige_frenzy') && save.ascensionLevel >= 3) newMs.push('prestige_frenzy');

  return newMs;
}

export function applyMilestones(save: RogueliteSave, milestones: MilestoneId[]): RogueliteSave {
  return { ...save, unlockedMilestones: [...save.unlockedMilestones, ...milestones] };
}

// ---------------------------------------------------------------------------
// Bestiary
// ---------------------------------------------------------------------------

export function recordBestiaryEncounter(
  save: RogueliteSave,
  entityKey: string,
  wave: number,
): RogueliteSave {
  const entry = save.bestiary[entityKey] ?? { seen: false, count: 0 };
  return {
    ...save,
    bestiary: {
      ...save.bestiary,
      [entityKey]: {
        seen: true,
        count: entry.count + 1,
        firstWave: entry.firstWave ?? wave,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Daily run
// ---------------------------------------------------------------------------

const DAILY_KEY = 'webgames.asteroids.daily';

export function loadDailyRun(): DailyRunResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyRunResult;
  } catch {
    return null;
  }
}

export function saveDailyRun(result: DailyRunResult): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(result));
  } catch {}
}

export function hasDailyRunToday(): boolean {
  const saved = loadDailyRun();
  if (!saved) return false;
  return saved.date === getDailyRunDate();
}

export function getDailyRunDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
