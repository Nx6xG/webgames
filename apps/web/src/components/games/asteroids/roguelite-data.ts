import type {
  PermanentUpgrade,
  PermanentUpgradeId,
  PowerUpUpgradeId,
  PowerUpType,
  TempBuffDef,
  TempBuffId,
  AsteroidVariant,
  BossVariant,
  ArtifactId,
  ArtifactDef,
  EliteModifier,
  WaveEventType,
  MidWaveEventType,
  RunStats,
  ShipId,
  ShipDef,
  MilestoneId,
  MilestoneDef,
  CurseId,
  CurseDef,
  DailyModifierId,
  DailyModifierDef,
  AnyUpgradeId,
} from './roguelite-types';

// ---------------------------------------------------------------------------
// Permanent upgrades (10)
// ---------------------------------------------------------------------------

export const PERMANENT_UPGRADES: PermanentUpgrade[] = [
  {
    id: 'hull',
    nameKey: 'asteroids.rl.upg.hull',
    descKey: 'asteroids.rl.upg.hull.desc',
    icon: '\u{1F6E1}',
    maxTier: 3,
    costs: [200, 800, 2500],
  },
  {
    id: 'gyroscope',
    nameKey: 'asteroids.rl.upg.gyroscope',
    descKey: 'asteroids.rl.upg.gyroscope.desc',
    icon: '\u{1F504}',
    maxTier: 5,
    costs: [150, 450, 1200, 2800, 5500],
  },
  {
    id: 'caliber',
    nameKey: 'asteroids.rl.upg.caliber',
    descKey: 'asteroids.rl.upg.caliber.desc',
    icon: '\u{1F4A5}',
    maxTier: 5,
    costs: [250, 700, 1800, 4000, 8000],
  },
  {
    id: 'fireRate',
    nameKey: 'asteroids.rl.upg.fireRate',
    descKey: 'asteroids.rl.upg.fireRate.desc',
    icon: '\u26A1',
    maxTier: 5,
    costs: [200, 600, 1500, 3500, 7000],
  },
  {
    id: 'bulletSpeed',
    nameKey: 'asteroids.rl.upg.bulletSpeed',
    descKey: 'asteroids.rl.upg.bulletSpeed.desc',
    icon: '\u{1F3AF}',
    maxTier: 3,
    costs: [150, 500, 1200],
  },
  {
    id: 'magnet',
    nameKey: 'asteroids.rl.upg.magnet',
    descKey: 'asteroids.rl.upg.magnet.desc',
    icon: '\u{1F9F2}',
    maxTier: 3,
    costs: [300, 1000, 2500],
  },
  {
    id: 'scrapBonus',
    nameKey: 'asteroids.rl.upg.scrapBonus',
    descKey: 'asteroids.rl.upg.scrapBonus.desc',
    icon: '\u{1F4B0}',
    maxTier: 3,
    costs: [300, 1000, 2500],
  },
  {
    id: 'shieldGen',
    nameKey: 'asteroids.rl.upg.shieldGen',
    descKey: 'asteroids.rl.upg.shieldGen.desc',
    icon: '\u{1F50B}',
    maxTier: 3,
    costs: [500, 1500, 4000],
  },
  {
    id: 'critStrike',
    nameKey: 'asteroids.rl.upg.critStrike',
    descKey: 'asteroids.rl.upg.critStrike.desc',
    icon: '\u2694\uFE0F',
    maxTier: 3,
    costs: [400, 1200, 3500],
  },
  {
    id: 'retroThruster',
    nameKey: 'asteroids.rl.upg.retroThruster',
    descKey: 'asteroids.rl.upg.retroThruster.desc',
    icon: '\u{1F6D1}',
    maxTier: 1,
    costs: [250],
  },
  {
    id: 'range',
    nameKey: 'asteroids.rl.upg.range',
    descKey: 'asteroids.rl.upg.range.desc',
    icon: '\u{1F4CF}',
    maxTier: 3,
    costs: [150, 500, 1200],
  },
];

// ---------------------------------------------------------------------------
// Power-up upgrades (8) — upgrade each power-up from weak → full strength
// Separate from PERMANENT_UPGRADES: NOT required for ascension, but reset on ascend
// ---------------------------------------------------------------------------

export interface PowerUpUpgradeDef {
  id: PowerUpUpgradeId;
  puType: PowerUpType;
  nameKey: string;
  descKey: string;
  icon: string;
  maxTier: 3;
  costs: [number, number, number];
}

export const POWERUP_UPGRADES: PowerUpUpgradeDef[] = [
  { id: 'pu_double', puType: 'double', nameKey: 'asteroids.rl.pu.double', descKey: 'asteroids.rl.pu.double.desc', icon: '2x', maxTier: 3, costs: [150, 500, 1200] },
  { id: 'pu_triple', puType: 'triple', nameKey: 'asteroids.rl.pu.triple', descKey: 'asteroids.rl.pu.triple.desc', icon: '3x', maxTier: 3, costs: [150, 500, 1200] },
  { id: 'pu_rapid', puType: 'rapid', nameKey: 'asteroids.rl.pu.rapid', descKey: 'asteroids.rl.pu.rapid.desc', icon: 'RF', maxTier: 3, costs: [200, 600, 1500] },
  { id: 'pu_shield', puType: 'shield', nameKey: 'asteroids.rl.pu.shield', descKey: 'asteroids.rl.pu.shield.desc', icon: 'SH', maxTier: 3, costs: [150, 500, 1200] },
  { id: 'pu_bigbullet', puType: 'bigbullet', nameKey: 'asteroids.rl.pu.bigbullet', descKey: 'asteroids.rl.pu.bigbullet.desc', icon: 'BG', maxTier: 3, costs: [150, 500, 1200] },
  { id: 'pu_homing', puType: 'homing', nameKey: 'asteroids.rl.pu.homing', descKey: 'asteroids.rl.pu.homing.desc', icon: 'HM', maxTier: 3, costs: [200, 600, 1500] },
  { id: 'pu_multishot', puType: 'multishot', nameKey: 'asteroids.rl.pu.multishot', descKey: 'asteroids.rl.pu.multishot.desc', icon: 'MS', maxTier: 3, costs: [250, 700, 1800] },
  { id: 'pu_timeslow', puType: 'timeslow', nameKey: 'asteroids.rl.pu.timeslow', descKey: 'asteroids.rl.pu.timeslow.desc', icon: 'TS', maxTier: 3, costs: [200, 600, 1500] },
];

export const POWERUP_UPGRADE_MAP: Record<PowerUpUpgradeId, PowerUpUpgradeDef> = Object.fromEntries(
  POWERUP_UPGRADES.map((u) => [u.id, u]),
) as Record<PowerUpUpgradeId, PowerUpUpgradeDef>;

/** Combined list for buy/reset purposes (not for ascension check) */
export const ALL_BUYABLE_UPGRADES: Array<{ id: string; maxTier: number; costs: number[] }> = [
  ...PERMANENT_UPGRADES,
  ...POWERUP_UPGRADES,
];

// ---------------------------------------------------------------------------
// Power-up parameter scaling per upgrade tier (tier 0 = no upgrade, tier 3 = current defaults)
// ---------------------------------------------------------------------------

export interface PowerUpParams {
  duration: number;    // ms
  spread?: number;     // double/triple: bullet spread angle
  cooldownMult?: number; // rapid: fire cooldown multiplier
  maxBullets?: number; // rapid: max simultaneous bullets
  hitRadius?: number;  // bigbullet: collision radius
  homingTurnRate?: number; // homing: radians per frame
  bulletAngles?: number[]; // multishot: spread angles
  timeSlowMult?: number;  // timeslow: speed factor
}

const PU_DURATIONS = [6000, 7500, 9000, 10000]; // per tier

export function getPowerUpParams(puType: PowerUpType, tier: number): PowerUpParams {
  const t = Math.min(tier, 3);
  const dur = PU_DURATIONS[t];
  switch (puType) {
    case 'double': return { duration: dur, spread: [0.16, 0.13, 0.10, 0.08][t] };
    case 'triple': return { duration: dur, spread: [0.25, 0.21, 0.18, 0.15][t] };
    case 'rapid': return { duration: dur, cooldownMult: [0.70, 0.63, 0.56, 0.50][t], maxBullets: [7, 8, 9, 10][t] };
    case 'shield': return { duration: dur };
    case 'bigbullet': return { duration: dur, hitRadius: [3.5, 4.3, 5.2, 6][t] };
    case 'homing': return { duration: dur, homingTurnRate: [0.025, 0.037, 0.048, 0.06][t] };
    case 'multishot': {
      const angles = [
        [-0.40, 0, 0.40],
        [-0.45, 0, 0.45],
        [-0.50, -0.17, 0.17, 0.50],
        [-0.524, -0.262, 0, 0.262, 0.524],
      ];
      return { duration: dur, bulletAngles: angles[t] };
    }
    case 'timeslow': return { duration: dur, timeSlowMult: [0.55, 0.47, 0.38, 0.30][t] };
    default: return { duration: dur };
  }
}

/** Look up the upgrade tier for a power-up type from the save */
export function getPuUpgradeTier(puType: PowerUpType, upgrades: Partial<Record<AnyUpgradeId, number>>): number {
  const id = `pu_${puType}` as PowerUpUpgradeId;
  return upgrades[id] ?? 0;
}

// ---------------------------------------------------------------------------
// Temporary buffs (12)
// ---------------------------------------------------------------------------

export const TEMP_BUFFS: TempBuffDef[] = [
  {
    id: 'piercing',
    nameKey: 'asteroids.rl.buff.piercing',
    descKey: 'asteroids.rl.buff.piercing.desc',
    icon: '\u27A1\uFE0F',
    duration: 3,
    color: '#60a5fa',
  },
  {
    id: 'drone',
    nameKey: 'asteroids.rl.buff.drone',
    descKey: 'asteroids.rl.buff.drone.desc',
    icon: '\u{1F6F8}',
    duration: 5,
    color: '#34d399',
  },
  {
    id: 'overdrive',
    nameKey: 'asteroids.rl.buff.overdrive',
    descKey: 'asteroids.rl.buff.overdrive.desc',
    icon: '\u26A1',
    duration: 2,
    color: '#fbbf24',
  },
  {
    id: 'emp',
    nameKey: 'asteroids.rl.buff.emp',
    descKey: 'asteroids.rl.buff.emp.desc',
    icon: '\u{1F4A3}',
    duration: -1,
    color: '#f87171',
  },
  {
    id: 'extraLife',
    nameKey: 'asteroids.rl.buff.extraLife',
    descKey: 'asteroids.rl.buff.extraLife.desc',
    icon: '\u2764\uFE0F',
    duration: -1,
    color: '#fb7185',
  },
  {
    id: 'scrapMagnet',
    nameKey: 'asteroids.rl.buff.scrapMagnet',
    descKey: 'asteroids.rl.buff.scrapMagnet.desc',
    icon: '\u{1F9F2}',
    duration: 0,
    color: '#a78bfa',
  },
  {
    id: 'timeSlow',
    nameKey: 'asteroids.rl.buff.timeSlow',
    descKey: 'asteroids.rl.buff.timeSlow.desc',
    icon: '\u23F3',
    duration: 2,
    color: '#e2e8f0',
  },
  {
    id: 'homingBullets',
    nameKey: 'asteroids.rl.buff.homingBullets',
    descKey: 'asteroids.rl.buff.homingBullets.desc',
    icon: '\u{1F3AF}',
    duration: 3,
    color: '#c084fc',
  },
  {
    id: 'explosiveBullets',
    nameKey: 'asteroids.rl.buff.explosiveBullets',
    descKey: 'asteroids.rl.buff.explosiveBullets.desc',
    icon: '\u{1F4A5}',
    duration: 3,
    color: '#f97316',
  },
  {
    id: 'doubleScrap',
    nameKey: 'asteroids.rl.buff.doubleScrap',
    descKey: 'asteroids.rl.buff.doubleScrap.desc',
    icon: '\u{1F48E}',
    duration: 3,
    color: '#fbbf24',
  },
  {
    id: 'rearGun',
    nameKey: 'asteroids.rl.buff.rearGun',
    descKey: 'asteroids.rl.buff.rearGun.desc',
    icon: '\u{1F52B}',
    duration: 3,
    color: '#22d3ee',
  },
  {
    id: 'regeneration',
    nameKey: 'asteroids.rl.buff.regeneration',
    descKey: 'asteroids.rl.buff.regeneration.desc',
    icon: '\u{1F49A}',
    duration: 0,
    color: '#4ade80',
  },
  { id: 'orbitalStrike' as TempBuffId, nameKey: 'asteroids.rl.buff.orbitalStrike', descKey: 'asteroids.rl.buff.orbitalStrike.desc', icon: '\u{1F4A2}', duration: 2, color: '#f97316' },
  { id: 'chainLightning' as TempBuffId, nameKey: 'asteroids.rl.buff.chainLightning', descKey: 'asteroids.rl.buff.chainLightning.desc', icon: '\u26A1', duration: 3, color: '#60a5fa' },
  { id: 'voidShield' as TempBuffId, nameKey: 'asteroids.rl.buff.voidShield', descKey: 'asteroids.rl.buff.voidShield.desc', icon: '\u{1F300}', duration: 0, color: '#7c3aed' },
  // Prestige buffs (ascension 2+/3+)
  { id: 'plasmaField' as TempBuffId, nameKey: 'asteroids.rl.buff.plasmaField', descKey: 'asteroids.rl.buff.plasmaField.desc', icon: '\u{1F7E1}', duration: 3, color: '#facc15' },
  { id: 'scrapFrenzy' as TempBuffId, nameKey: 'asteroids.rl.buff.scrapFrenzy', descKey: 'asteroids.rl.buff.scrapFrenzy.desc', icon: '\u{1F4B0}', duration: 3, color: '#fbbf24' },
];

export const TEMP_BUFF_MAP: Record<TempBuffId, TempBuffDef> = Object.fromEntries(
  TEMP_BUFFS.map((b) => [b.id, b]),
) as Record<TempBuffId, TempBuffDef>;

// ---------------------------------------------------------------------------
// Asteroid variant configs
// ---------------------------------------------------------------------------

export interface AsteroidVariantConfig {
  hpMultiplier: number;
  scrapMultiplier: number;
  color: string;
  glowColor: string | null;
}

export const ASTEROID_VARIANT_CONFIG: Record<AsteroidVariant, AsteroidVariantConfig> = {
  normal:    { hpMultiplier: 1, scrapMultiplier: 1,   color: '#a1a1aa', glowColor: null },
  armored:   { hpMultiplier: 2, scrapMultiplier: 3,   color: '#fbbf24', glowColor: '#f59e0b' },
  explosive: { hpMultiplier: 1, scrapMultiplier: 1.5, color: '#ef4444', glowColor: '#dc2626' },
  homing:    { hpMultiplier: 1, scrapMultiplier: 2,   color: '#c084fc', glowColor: '#a855f7' },
  splitting: { hpMultiplier: 1, scrapMultiplier: 1.5, color: '#4ade80', glowColor: '#22c55e' },
};

// ---------------------------------------------------------------------------
// Boss variant configs
// ---------------------------------------------------------------------------

export interface BossVariantConfig {
  hp: number;
  fireInterval: number; // ticks between shots
  speed: number;
  shieldHp?: number;
  shieldRegenRate?: number; // per tick
  spawnInterval?: number;   // ticks between minion spawns (carrier)
  /** Number of bullets per burst */
  burstCount?: number;
  /** Spread angle (radians) for multi-shot */
  spreadAngle?: number;
  /** Unique color for this boss variant */
  color: string;
}

export const BOSS_VARIANT_CONFIG: Record<BossVariant, BossVariantConfig> = {
  standard:  { hp: 15, fireInterval: 90,  speed: 0.35, burstCount: 1, color: '#ef4444' },
  twin:      { hp: 12, fireInterval: 100, speed: 0.45, burstCount: 2, spreadAngle: 0.35, color: '#f97316' },
  shield:    { hp: 18, fireInterval: 80,  speed: 0.28, shieldHp: 8, shieldRegenRate: 0.02, burstCount: 1, color: '#06b6d4' },
  carrier:   { hp: 22, fireInterval: 120, speed: 0.22, spawnInterval: 140, burstCount: 1, color: '#a78bfa' },
  bomber:    { hp: 14, fireInterval: 60,  speed: 0.3,  burstCount: 1, color: '#fbbf24' },
  sniper:    { hp: 10, fireInterval: 200, speed: 0.15, burstCount: 1, color: '#22d3ee' },
  berserker: { hp: 25, fireInterval: 100, speed: 0.35, burstCount: 1, color: '#dc2626' },
  splitter:  { hp: 12, fireInterval: 110, speed: 0.35, burstCount: 2, spreadAngle: 0.5, color: '#4ade80' },
};

// ---------------------------------------------------------------------------
// Boss variant selection per wave
// ---------------------------------------------------------------------------

export function getBossVariantForWave(wave: number): BossVariant {
  // Early waves: introduce variants gradually
  if (wave <= 5) return 'standard';
  if (wave <= 10) return 'twin';
  if (wave <= 15) return Math.random() < 0.5 ? 'shield' : 'bomber';
  if (wave <= 20) return Math.random() < 0.5 ? 'carrier' : 'sniper';
  // Wave 25+: weighted random from full pool
  const pool: Array<{ variant: BossVariant; weight: number }> = [
    { variant: 'standard',  weight: 8 },
    { variant: 'twin',      weight: 10 },
    { variant: 'shield',    weight: 10 },
    { variant: 'carrier',   weight: 8 },
    { variant: 'bomber',    weight: 12 },
    { variant: 'sniper',    weight: 10 },
    { variant: 'berserker', weight: wave >= 30 ? 12 : 0 },
    { variant: 'splitter',  weight: wave >= 35 ? 10 : 0 },
  ];
  const eligible = pool.filter(p => p.weight > 0);
  const total = eligible.reduce((s, p) => s + p.weight, 0);
  let roll = Math.random() * total;
  for (const p of eligible) {
    roll -= p.weight;
    if (roll <= 0) return p.variant;
  }
  return 'standard';
}

/** Wave-based HP scaling for bosses — they get stronger in late game */
export function getBossWaveHpScale(wave: number): number {
  if (wave <= 5) return 1;
  // +30% HP per 5 waves after wave 5, accelerating in late game
  const base = 1 + Math.floor((wave - 5) / 5) * 0.30;
  // Extra scaling after wave 20
  const late = wave > 20 ? (wave - 20) * 0.04 : 0;
  return base + late;
}

/** Wave-based scaling for event rounds */
export function getEventWaveScale(wave: number): number {
  // 1.0 at wave 5, scales up to 3.0+ in late game
  return 1 + Math.max(0, (wave - 5)) * 0.08;
}

// ---------------------------------------------------------------------------
// Special asteroid spawning helpers
// ---------------------------------------------------------------------------

/** Chance (0-1) that a spawned asteroid is a special variant. */
export function getSpecialAsteroidChance(wave: number): number {
  if (wave < 5) return 0;
  // Linear from 0 at wave 5 to 0.4 at wave 20, capped at 0.4
  return Math.min(0.4, ((wave - 5) / 15) * 0.4);
}

/** Weighted random pick among non-normal variants. */
export function pickSpecialVariant(): AsteroidVariant {
  const roll = Math.random();
  if (roll < 0.30) return 'armored';
  if (roll < 0.55) return 'explosive';
  if (roll < 0.80) return 'homing';
  return 'splitting';
}

// ---------------------------------------------------------------------------
// Base scrap values
// ---------------------------------------------------------------------------

export const BASE_SCRAP_VALUES = {
  large: 5,
  medium: 3,
  small: 2,
  boss: 80,
} as const;

// ---------------------------------------------------------------------------
// Computed stats from permanent upgrades
// ---------------------------------------------------------------------------

export interface AppliedStats {
  maxLives: number;
  accel: number;
  turnSpeed: number;
  bulletDamage: number;
  fireCooldown: number;
  bulletSpeed: number;
  magnetRange: number;
  scrapMultiplier: number;
  shieldRechargeMs: number;
  critChance: number;
  hasBrake: boolean;
  bulletLifeMult: number;
}

export function getAppliedStats(
  upgrades: Partial<Record<AnyUpgradeId, number>>,
  shipId?: ShipId,
): AppliedStats {
  const tier = (id: PermanentUpgradeId): number => upgrades[id] ?? 0;
  const ship = shipId ? SHIP_MAP[shipId] : null;

  const base: AppliedStats = {
    maxLives: 3 + tier('hull') + (ship?.hpMod ?? 0),
    accel: 0.12 * (1 + tier('engine') * 0.12) * (ship?.accelMod ?? 1),
    turnSpeed: 0.065 * (1 + tier('gyroscope') * 0.10) * (ship?.turnSpeedMod ?? 1),
    bulletDamage: (1 + tier('caliber') * 0.6) * (ship?.bulletDamageMod ?? 1),
    fireCooldown: 150 * (1 - tier('fireRate') * 0.08) * (ship?.fireRateMod ?? 1),
    bulletSpeed: 7 * (1 + tier('bulletSpeed') * 0.10),
    magnetRange: [0, 60, 120, 200][tier('magnet')] * (ship?.scrapRadiusMod ?? 1),
    scrapMultiplier: (1 + tier('scrapBonus') * 0.15) * (ship?.scrapMultMod ?? 1),
    shieldRechargeMs: [Infinity, 50000, 35000, 25000][tier('shieldGen')] * (ship?.shieldRechargeMod ?? 1),
    critChance: [0, 0.06, 0.12, 0.18][tier('critStrike')],
    hasBrake: tier('retroThruster') >= 1,
    bulletLifeMult: 1 + tier('range') * 0.12,
  };

  return base;
}

// ---------------------------------------------------------------------------
// Artifacts (8) — boss drops, permanent for run
// ---------------------------------------------------------------------------

export const ARTIFACTS: ArtifactDef[] = [
  { id: 'bouncingBullets', nameKey: 'asteroids.rl.artifact.bouncingBullets', descKey: 'asteroids.rl.artifact.bouncingBullets.desc', icon: '\u{1F4A2}', color: '#60a5fa' },
  { id: 'explosionHeal', nameKey: 'asteroids.rl.artifact.explosionHeal', descKey: 'asteroids.rl.artifact.explosionHeal.desc', icon: '\u{1F496}', color: '#f87171' },
  { id: 'killSpawnPowerup', nameKey: 'asteroids.rl.artifact.killSpawnPowerup', descKey: 'asteroids.rl.artifact.killSpawnPowerup.desc', icon: '\u2728', color: '#fbbf24' },
  { id: 'shrapnelBurst', nameKey: 'asteroids.rl.artifact.shrapnelBurst', descKey: 'asteroids.rl.artifact.shrapnelBurst.desc', icon: '\u{1F4A5}', color: '#f97316' },
  { id: 'scrapVampire', nameKey: 'asteroids.rl.artifact.scrapVampire', descKey: 'asteroids.rl.artifact.scrapVampire.desc', icon: '\u{1F9DB}', color: '#a78bfa' },
  { id: 'asteroidFear', nameKey: 'asteroids.rl.artifact.asteroidFear', descKey: 'asteroids.rl.artifact.asteroidFear.desc', icon: '\u{1F630}', color: '#4ade80' },
  { id: 'ghostShip', nameKey: 'asteroids.rl.artifact.ghostShip', descKey: 'asteroids.rl.artifact.ghostShip.desc', icon: '\u{1F47B}', color: '#e2e8f0' },
  { id: 'overcharge', nameKey: 'asteroids.rl.artifact.overcharge', descKey: 'asteroids.rl.artifact.overcharge.desc', icon: '\u26A1', color: '#facc15' },
  { id: 'voidArmor' as ArtifactId, nameKey: 'asteroids.rl.artifact.voidArmor', descKey: 'asteroids.rl.artifact.voidArmor.desc', icon: '\u{1F300}', color: '#7c3aed' },
  { id: 'bossSlayer' as ArtifactId, nameKey: 'asteroids.rl.artifact.bossSlayer', descKey: 'asteroids.rl.artifact.bossSlayer.desc', icon: '\u{1F5E1}\uFE0F', color: '#ef4444' },
  // Prestige artifacts (ascension 1+/2+)
  { id: 'stellarForge' as ArtifactId, nameKey: 'asteroids.rl.artifact.stellarForge', descKey: 'asteroids.rl.artifact.stellarForge.desc', icon: '\u2B50', color: '#facc15' },
  { id: 'timeCrystal' as ArtifactId, nameKey: 'asteroids.rl.artifact.timeCrystal', descKey: 'asteroids.rl.artifact.timeCrystal.desc', icon: '\u{1F48E}', color: '#c084fc' },
];

export const ARTIFACT_MAP: Record<ArtifactId, ArtifactDef> = Object.fromEntries(
  ARTIFACTS.map((a) => [a.id, a]),
) as Record<ArtifactId, ArtifactDef>;

export function pickRandomArtifacts(count: number, collected: ArtifactId[], ascensionLevel: number = 0): ArtifactDef[] {
  const collectedSet = new Set(collected);
  const eligible = ARTIFACTS.filter((a) => !collectedSet.has(a.id) && isPrestigeUnlocked(a.id, ascensionLevel));
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// ---------------------------------------------------------------------------
// Elite asteroid modifiers (wave 10+)
// ---------------------------------------------------------------------------

export interface EliteModifierConfig {
  color: string;
  glowColor: string;
  scrapMultiplier: number;
}

export const ELITE_MODIFIER_CONFIG: Record<EliteModifier, EliteModifierConfig> = {
  fast:       { color: '#ef4444', glowColor: '#dc2626', scrapMultiplier: 2.0 },
  tiny:       { color: '#a78bfa', glowColor: '#8b5cf6', scrapMultiplier: 2.5 },
  teleporter: { color: '#38bdf8', glowColor: '#0ea5e9', scrapMultiplier: 2.0 },
  reflective: { color: '#fbbf24', glowColor: '#f59e0b', scrapMultiplier: 2.0 },
  shielded:   { color: '#4ade80', glowColor: '#22c55e', scrapMultiplier: 1.5 },
  magnetic:   { color: '#f472b6', glowColor: '#ec4899', scrapMultiplier: 1.5 },
};

export function getEliteChance(wave: number): number {
  if (wave < 10) return 0;
  return Math.min(0.20, ((wave - 10) / 20) * 0.20);
}

export function pickEliteModifier(): EliteModifier {
  const roll = Math.random();
  if (roll < 0.20) return 'fast';
  if (roll < 0.38) return 'tiny';
  if (roll < 0.54) return 'teleporter';
  if (roll < 0.70) return 'reflective';
  if (roll < 0.86) return 'shielded';
  return 'magnetic';
}

// ---------------------------------------------------------------------------
// Between-wave events
// ---------------------------------------------------------------------------

export interface WaveEventConfig {
  duration: number; // ms
  nameKey: string;
  descKey: string;
}

export const WAVE_EVENT_CONFIG: Record<WaveEventType, WaveEventConfig> = {
  scrapBonus:     { duration: 15000, nameKey: 'asteroids.rl.event.scrapBonus',     descKey: 'asteroids.rl.event.scrapBonus.desc' },
  asteroidSprint: { duration: 20000, nameKey: 'asteroids.rl.event.asteroidSprint', descKey: 'asteroids.rl.event.asteroidSprint.desc' },
  miniBossRush:   { duration: 30000, nameKey: 'asteroids.rl.event.miniBossRush',   descKey: 'asteroids.rl.event.miniBossRush.desc' },
  meteorShower:   { duration: 12000, nameKey: 'asteroids.rl.event.meteorShower',   descKey: 'asteroids.rl.event.meteorShower.desc' },
  repairStation:  { duration: 0,     nameKey: 'asteroids.rl.event.repairStation',  descKey: 'asteroids.rl.event.repairStation.desc' },
  blackout:       { duration: 18000, nameKey: 'asteroids.rl.event.blackout',       descKey: 'asteroids.rl.event.blackout.desc' },
  scrapStorm:     { duration: 10000, nameKey: 'asteroids.rl.event.scrapStorm',     descKey: 'asteroids.rl.event.scrapStorm.desc' },
  eliteArena:     { duration: 25000, nameKey: 'asteroids.rl.event.eliteArena',     descKey: 'asteroids.rl.event.eliteArena.desc' },
  warpZone:       { duration: 15000, nameKey: 'asteroids.rl.event.warpZone',       descKey: 'asteroids.rl.event.warpZone.desc' },
};

export function rollWaveEvent(wave: number): WaveEventType | null {
  if (wave < 5) return null;
  if (Math.random() > 0.30) return null; // 30% chance
  const pool: Array<{ type: WaveEventType; weight: number; minWave: number }> = [
    { type: 'scrapBonus',     weight: 15, minWave: 5 },
    { type: 'asteroidSprint', weight: 12, minWave: 5 },
    { type: 'miniBossRush',   weight: 10, minWave: 8 },
    { type: 'meteorShower',   weight: 14, minWave: 5 },
    { type: 'repairStation',  weight: 8,  minWave: 5 },
    { type: 'scrapStorm',     weight: 10, minWave: 5 },
    { type: 'blackout',       weight: 10, minWave: 10 },
    { type: 'eliteArena',     weight: 8,  minWave: 12 },
    { type: 'warpZone',       weight: 8,  minWave: 15 },
  ];
  const eligible = pool.filter(e => wave >= e.minWave);
  const totalWeight = eligible.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const e of eligible) {
    roll -= e.weight;
    if (roll <= 0) return e.type;
  }
  return eligible[eligible.length - 1].type;
}

// ---------------------------------------------------------------------------
// Mid-wave events (occur during active waves)
// ---------------------------------------------------------------------------

export interface MidWaveEventConfig {
  duration: number; // ms
  nameKey: string;
  descKey: string;
  color: string;
}

export const MID_WAVE_EVENT_CONFIG: Record<MidWaveEventType, MidWaveEventConfig> = {
  solarFlare:     { duration: 6000,  nameKey: 'asteroids.rl.mid.solarFlare',     descKey: 'asteroids.rl.mid.solarFlare.desc',     color: '#fbbf24' },
  gravityWell:    { duration: 8000,  nameKey: 'asteroids.rl.mid.gravityWell',    descKey: 'asteroids.rl.mid.gravityWell.desc',    color: '#a78bfa' },
  powerSurge:     { duration: 5000,  nameKey: 'asteroids.rl.mid.powerSurge',     descKey: 'asteroids.rl.mid.powerSurge.desc',     color: '#4ade80' },
  asteroidSwarm:  { duration: 1,     nameKey: 'asteroids.rl.mid.asteroidSwarm',  descKey: 'asteroids.rl.mid.asteroidSwarm.desc',  color: '#ef4444' },
  raid:           { duration: 20000, nameKey: 'asteroids.rl.mid.raid',           descKey: 'asteroids.rl.mid.raid.desc',           color: '#f97316' },
  empBurst:       { duration: 4000,  nameKey: 'asteroids.rl.mid.empBurst',       descKey: 'asteroids.rl.mid.empBurst.desc',       color: '#60a5fa' },
  magneticStorm:  { duration: 7000,  nameKey: 'asteroids.rl.mid.magneticStorm',  descKey: 'asteroids.rl.mid.magneticStorm.desc',  color: '#e879f9' },
  cloakField:     { duration: 5000,  nameKey: 'asteroids.rl.mid.cloakField',     descKey: 'asteroids.rl.mid.cloakField.desc',     color: '#22d3ee' },
  overdrivePulse: { duration: 4000,  nameKey: 'asteroids.rl.mid.overdrivePulse', descKey: 'asteroids.rl.mid.overdrivePulse.desc', color: '#facc15' },
};

export function rollMidWaveEvent(wave: number): MidWaveEventType | null {
  if (wave < 8) return null;
  if (Math.random() > 0.18) return null; // 18% chance
  const pool: Array<{ type: MidWaveEventType; weight: number; minWave: number }> = [
    { type: 'solarFlare',     weight: 12, minWave: 8 },
    { type: 'gravityWell',    weight: 10, minWave: 8 },
    { type: 'powerSurge',     weight: 12, minWave: 8 },
    { type: 'asteroidSwarm',  weight: 10, minWave: 8 },
    { type: 'empBurst',       weight: 10, minWave: 8 },
    { type: 'overdrivePulse', weight: 10, minWave: 8 },
    { type: 'magneticStorm',  weight: 8,  minWave: 10 },
    { type: 'cloakField',     weight: 8,  minWave: 10 },
    { type: 'raid',           weight: 8,  minWave: 12 },
  ];
  const eligible = pool.filter(e => wave >= e.minWave);
  const totalWeight = eligible.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const e of eligible) {
    roll -= e.weight;
    if (roll <= 0) return e.type;
  }
  return eligible[eligible.length - 1].type;
}

// ---------------------------------------------------------------------------
// Ascension
// ---------------------------------------------------------------------------

export function getAscensionScrapBonus(ascensionLevel: number): number {
  return 1 + ascensionLevel * 0.05;
}

// ---------------------------------------------------------------------------
// Prestige unlock requirements (ascension level needed)
// ---------------------------------------------------------------------------

/** Items gated behind prestige — must reach this ascension level to appear in buff/artifact pools */
export const PRESTIGE_REQUIREMENTS: Record<string, number> = {
  // Ship
  ascendant: 1,
  // Buffs
  plasmaField: 2,
  scrapFrenzy: 3,
  // Artifacts
  stellarForge: 1,
  timeCrystal: 2,
};

/** Check if a prestige-gated item is unlocked */
export function isPrestigeUnlocked(id: string, ascensionLevel: number): boolean {
  const req = PRESTIGE_REQUIREMENTS[id];
  if (req == null) return true; // not prestige-gated
  return ascensionLevel >= req;
}

/** Power-up drop rate multiplier — decreases in late game to prevent oversaturation */
export function getPowerupDropScale(wave: number): number {
  if (wave <= 5) return 1;
  // Drops to 0.3 by wave 35
  return Math.max(0.3, 1 - (wave - 5) * 0.023);
}

// ---------------------------------------------------------------------------
// Default run stats
// ---------------------------------------------------------------------------

export function defaultRunStats(): RunStats {
  return {
    wavesCleared: 0,
    asteroidsDestroyed: 0,
    eliteAsteroidsDestroyed: 0,
    bossesKilled: 0,
    buffsChosen: 0,
    artifactsCollected: 0,
    damageTaken: 0,
    scrapEarned: 0,
    timePlayed: 0,
  };
}

// ---------------------------------------------------------------------------
// Ships (5)
// ---------------------------------------------------------------------------

export const SHIPS: ShipDef[] = [
  {
    id: 'vanguard', nameKey: 'asteroids.rl.ship.vanguard', descKey: 'asteroids.rl.ship.vanguard.desc',
    passiveKey: 'asteroids.rl.ship.vanguard.passive', icon: '\u{1F680}', color: '#e4e4e7',
    hpMod: 0, accelMod: 1, turnSpeedMod: 1, fireRateMod: 1, bulletDamageMod: 1,
    scrapRadiusMod: 1, scrapMultMod: 1, shieldRechargeMod: 1, phaseChance: 0,
  },
  {
    id: 'phantom', nameKey: 'asteroids.rl.ship.phantom', descKey: 'asteroids.rl.ship.phantom.desc',
    passiveKey: 'asteroids.rl.ship.phantom.passive', icon: '\u{1F47B}', color: '#a78bfa',
    hpMod: -1, accelMod: 1.05, turnSpeedMod: 1.05, fireRateMod: 1, bulletDamageMod: 1,
    scrapRadiusMod: 1, scrapMultMod: 1, shieldRechargeMod: 1, phaseChance: 0.15,
  },
  {
    id: 'harvester', nameKey: 'asteroids.rl.ship.harvester', descKey: 'asteroids.rl.ship.harvester.desc',
    passiveKey: 'asteroids.rl.ship.harvester.passive', icon: '\u{1F9F2}', color: '#fbbf24',
    hpMod: 0, accelMod: 0.85, turnSpeedMod: 0.9, fireRateMod: 1, bulletDamageMod: 1,
    scrapRadiusMod: 1.3, scrapMultMod: 1.2, shieldRechargeMod: 1, phaseChance: 0,
  },
  {
    id: 'striker', nameKey: 'asteroids.rl.ship.striker', descKey: 'asteroids.rl.ship.striker.desc',
    passiveKey: 'asteroids.rl.ship.striker.passive', icon: '\u2694\uFE0F', color: '#f87171',
    hpMod: -1, accelMod: 1, turnSpeedMod: 1, fireRateMod: 0.75, bulletDamageMod: 1.15,
    scrapRadiusMod: 1, scrapMultMod: 1, shieldRechargeMod: 1, phaseChance: 0,
  },
  {
    id: 'sentinel', nameKey: 'asteroids.rl.ship.sentinel', descKey: 'asteroids.rl.ship.sentinel.desc',
    passiveKey: 'asteroids.rl.ship.sentinel.passive', icon: '\u{1F6E1}', color: '#38bdf8',
    hpMod: 1, accelMod: 0.95, turnSpeedMod: 0.85, fireRateMod: 1, bulletDamageMod: 1,
    scrapRadiusMod: 1, scrapMultMod: 1, shieldRechargeMod: 0.5, phaseChance: 0,
  },
  {
    id: 'ascendant', nameKey: 'asteroids.rl.ship.ascendant', descKey: 'asteroids.rl.ship.ascendant.desc',
    passiveKey: 'asteroids.rl.ship.ascendant.passive', icon: '\u{1F31F}', color: '#facc15',
    hpMod: 0, accelMod: 1.1, turnSpeedMod: 1.1, fireRateMod: 0.85, bulletDamageMod: 1.1,
    scrapRadiusMod: 1.15, scrapMultMod: 1.1, shieldRechargeMod: 0.8, phaseChance: 0.05,
  },
];

export const SHIP_MAP: Record<ShipId, ShipDef> = Object.fromEntries(
  SHIPS.map((s) => [s.id, s]),
) as Record<ShipId, ShipDef>;

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export const MILESTONES: MilestoneDef[] = [
  { id: 'reach_wave_10', nameKey: 'asteroids.rl.ms.reachWave10', descKey: 'asteroids.rl.ms.reachWave10.desc', icon: '\u{1F31F}', unlock: { type: 'ship', shipId: 'striker' } },
  { id: 'reach_wave_20', nameKey: 'asteroids.rl.ms.reachWave20', descKey: 'asteroids.rl.ms.reachWave20.desc', icon: '\u{1F31F}', unlock: { type: 'ship', shipId: 'phantom' } },
  { id: 'reach_wave_30', nameKey: 'asteroids.rl.ms.reachWave30', descKey: 'asteroids.rl.ms.reachWave30.desc', icon: '\u{1F3C6}', unlock: { type: 'artifact', artifactId: 'voidArmor' as ArtifactId } },
  { id: 'kill_500_asteroids', nameKey: 'asteroids.rl.ms.kill500', descKey: 'asteroids.rl.ms.kill500.desc', icon: '\u2604\uFE0F', unlock: { type: 'buff', buffId: 'orbitalStrike' as TempBuffId } },
  { id: 'kill_50_bosses', nameKey: 'asteroids.rl.ms.kill50Bosses', descKey: 'asteroids.rl.ms.kill50Bosses.desc', icon: '\u{1F47E}', unlock: { type: 'ship', shipId: 'sentinel' } },
  { id: 'collect_20000_run_scrap', nameKey: 'asteroids.rl.ms.collect20000run', descKey: 'asteroids.rl.ms.collect20000run.desc', icon: '\u{1F4B0}', unlock: { type: 'ship', shipId: 'harvester' } },
  { id: 'ascend_once', nameKey: 'asteroids.rl.ms.ascend', descKey: 'asteroids.rl.ms.ascend.desc', icon: '\u2B50', unlock: { type: 'buff', buffId: 'chainLightning' as TempBuffId } },
  { id: 'defeat_megaboss', nameKey: 'asteroids.rl.ms.megaboss', descKey: 'asteroids.rl.ms.megaboss.desc', icon: '\u{1F451}', unlock: { type: 'artifact', artifactId: 'bossSlayer' as ArtifactId } },
  { id: 'reach_wave_50', nameKey: 'asteroids.rl.ms.reachWave50', descKey: 'asteroids.rl.ms.reachWave50.desc', icon: '\u{1F525}', unlock: { type: 'buff', buffId: 'voidShield' as TempBuffId } },
  // Prestige milestones
  { id: 'prestige_stellar', nameKey: 'asteroids.rl.ms.prestigeStellar', descKey: 'asteroids.rl.ms.prestigeStellar.desc', icon: '\u2B50', unlock: { type: 'artifact', artifactId: 'stellarForge' as ArtifactId } },
  { id: 'prestige_crystal', nameKey: 'asteroids.rl.ms.prestigeCrystal', descKey: 'asteroids.rl.ms.prestigeCrystal.desc', icon: '\u{1F48E}', unlock: { type: 'artifact', artifactId: 'timeCrystal' as ArtifactId } },
  { id: 'prestige_plasma', nameKey: 'asteroids.rl.ms.prestigePlasma', descKey: 'asteroids.rl.ms.prestigePlasma.desc', icon: '\u{1F7E1}', unlock: { type: 'buff', buffId: 'plasmaField' as TempBuffId } },
  { id: 'prestige_frenzy', nameKey: 'asteroids.rl.ms.prestigeFrenzy', descKey: 'asteroids.rl.ms.prestigeFrenzy.desc', icon: '\u{1F4B0}', unlock: { type: 'buff', buffId: 'scrapFrenzy' as TempBuffId } },
];

// ---------------------------------------------------------------------------
// Curses
// ---------------------------------------------------------------------------

export const CURSES: CurseDef[] = [
  { id: 'glassCannon', nameKey: 'asteroids.rl.curse.glassCannon', descKey: 'asteroids.rl.curse.glassCannon.desc', icon: '\u{1F4A5}', scrapMultiplier: 1.3, color: '#f87171' },
  { id: 'swarm', nameKey: 'asteroids.rl.curse.swarm', descKey: 'asteroids.rl.curse.swarm.desc', icon: '\u{1F41D}', scrapMultiplier: 1.3, color: '#fbbf24' },
  { id: 'velocity', nameKey: 'asteroids.rl.curse.velocity', descKey: 'asteroids.rl.curse.velocity.desc', icon: '\u{1F4A8}', scrapMultiplier: 1.2, color: '#38bdf8' },
  { id: 'famine', nameKey: 'asteroids.rl.curse.famine', descKey: 'asteroids.rl.curse.famine.desc', icon: '\u{1F6AB}', scrapMultiplier: 1.4, color: '#a1a1aa' },
  { id: 'darkness', nameKey: 'asteroids.rl.curse.darkness', descKey: 'asteroids.rl.curse.darkness.desc', icon: '\u{1F319}', scrapMultiplier: 1.5, color: '#1e1b4b' },
  { id: 'berserker', nameKey: 'asteroids.rl.curse.berserker', descKey: 'asteroids.rl.curse.berserker.desc', icon: '\u{1F525}', scrapMultiplier: 1.6, color: '#dc2626' },
  { id: 'pilot', nameKey: 'asteroids.rl.curse.pilot', descKey: 'asteroids.rl.curse.pilot.desc', icon: '\u{1F3AE}', scrapMultiplier: 0.35, color: '#22d3ee' },
];

export function getCurseScrapMultiplier(curses: CurseId[]): number {
  return curses.reduce((mult, id) => {
    const c = CURSES.find(c => c.id === id);
    return mult * (c?.scrapMultiplier ?? 1);
  }, 1);
}

// ---------------------------------------------------------------------------
// Mega-boss config
// ---------------------------------------------------------------------------

export const MEGA_BOSS_CONFIG = {
  radius: 90,
  phases: {
    shield: { hp: 25, fireInterval: 80, segments: 6 },
    swarm:  { hp: 20, spawnInterval: 60, missileSpeed: 2.5 },
    core:   { hp: 12, fireInterval: 30, teleportInterval: 3000 },
  },
  scrapReward: 1200,
};

/** Mega-boss HP scale per encounter (wave 25=1x, 50=1.5x, 75=2x, etc.) */
export function getMegaBossHpScale(wave: number): number {
  const encounter = Math.floor(wave / 25); // 1, 2, 3, ...
  return 1 + (encounter - 1) * 0.5;
}

export function isMegaBossWave(wave: number): boolean {
  return wave > 0 && wave % 25 === 0;
}

// ---------------------------------------------------------------------------
// Daily run modifiers (12)
// ---------------------------------------------------------------------------

export const DAILY_MODIFIERS: DailyModifierDef[] = [
  { id: 'forcedGlassCannon', nameKey: 'asteroids.rl.daily.mod.forcedGlassCannon', descKey: 'asteroids.rl.daily.mod.forcedGlassCannon.desc', icon: '\u{1F4A5}', color: '#f87171' },
  { id: 'scrapFrenzy', nameKey: 'asteroids.rl.daily.mod.scrapFrenzy', descKey: 'asteroids.rl.daily.mod.scrapFrenzy.desc', icon: '\u{1F4B0}', color: '#fbbf24' },
  { id: 'eliteSwarm', nameKey: 'asteroids.rl.daily.mod.eliteSwarm', descKey: 'asteroids.rl.daily.mod.eliteSwarm.desc', icon: '\u26A1', color: '#a78bfa' },
  { id: 'bossRush', nameKey: 'asteroids.rl.daily.mod.bossRush', descKey: 'asteroids.rl.daily.mod.bossRush.desc', icon: '\u{1F47E}', color: '#ef4444' },
  { id: 'speedDemon', nameKey: 'asteroids.rl.daily.mod.speedDemon', descKey: 'asteroids.rl.daily.mod.speedDemon.desc', icon: '\u{1F3CE}\uFE0F', color: '#38bdf8' },
  { id: 'bulletHell', nameKey: 'asteroids.rl.daily.mod.bulletHell', descKey: 'asteroids.rl.daily.mod.bulletHell.desc', icon: '\u{1F52B}', color: '#f97316' },
  { id: 'noPowerups', nameKey: 'asteroids.rl.daily.mod.noPowerups', descKey: 'asteroids.rl.daily.mod.noPowerups.desc', icon: '\u{1F6AB}', color: '#a1a1aa' },
  { id: 'titanAsteroids', nameKey: 'asteroids.rl.daily.mod.titanAsteroids', descKey: 'asteroids.rl.daily.mod.titanAsteroids.desc', icon: '\u{1FAA8}', color: '#78716c' },
  { id: 'richBosses', nameKey: 'asteroids.rl.daily.mod.richBosses', descKey: 'asteroids.rl.daily.mod.richBosses.desc', icon: '\u{1F911}', color: '#4ade80' },
  { id: 'miniShip', nameKey: 'asteroids.rl.daily.mod.miniShip', descKey: 'asteroids.rl.daily.mod.miniShip.desc', icon: '\u{1F52C}', color: '#c084fc' },
  { id: 'fastAsteroids', nameKey: 'asteroids.rl.daily.mod.fastAsteroids', descKey: 'asteroids.rl.daily.mod.fastAsteroids.desc', icon: '\u{1F4A8}', color: '#22d3ee' },
  { id: 'heavyHitter', nameKey: 'asteroids.rl.daily.mod.heavyHitter', descKey: 'asteroids.rl.daily.mod.heavyHitter.desc', icon: '\u{1F528}', color: '#e879f9' },
];

export const DAILY_MODIFIER_MAP: Record<DailyModifierId, DailyModifierDef> = Object.fromEntries(
  DAILY_MODIFIERS.map((m) => [m.id, m]),
) as Record<DailyModifierId, DailyModifierDef>;

export function getDailyModifiers(): DailyModifierDef[] {
  const rng = createSeededRng(getDailySeed());
  const count = rng() < 0.30 ? 3 : 2;
  const shuffled = [...DAILY_MODIFIERS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// ---------------------------------------------------------------------------
// Seeded RNG
// ---------------------------------------------------------------------------

export function createSeededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
