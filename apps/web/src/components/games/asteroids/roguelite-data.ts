import type {
  PermanentUpgrade,
  PermanentUpgradeId,
  TempBuffDef,
  TempBuffId,
  AsteroidVariant,
  BossVariant,
  ArtifactId,
  ArtifactDef,
  EliteModifier,
  WaveEventType,
  RunStats,
  ShipId,
  ShipDef,
  MilestoneId,
  MilestoneDef,
  CurseId,
  CurseDef,
  DailyModifierId,
  DailyModifierDef,
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
    maxTier: 5,
    costs: [100, 300, 800, 1800, 3600],
  },
  {
    id: 'engine',
    nameKey: 'asteroids.rl.upg.engine',
    descKey: 'asteroids.rl.upg.engine.desc',
    icon: '\u{1F680}',
    maxTier: 5,
    costs: [80, 250, 650, 1500, 3000],
  },
  {
    id: 'gyroscope',
    nameKey: 'asteroids.rl.upg.gyroscope',
    descKey: 'asteroids.rl.upg.gyroscope.desc',
    icon: '\u{1F504}',
    maxTier: 5,
    costs: [80, 250, 650, 1500, 3000],
  },
  {
    id: 'caliber',
    nameKey: 'asteroids.rl.upg.caliber',
    descKey: 'asteroids.rl.upg.caliber.desc',
    icon: '\u{1F4A5}',
    maxTier: 5,
    costs: [120, 360, 960, 2200, 4500],
  },
  {
    id: 'fireRate',
    nameKey: 'asteroids.rl.upg.fireRate',
    descKey: 'asteroids.rl.upg.fireRate.desc',
    icon: '\u26A1',
    maxTier: 5,
    costs: [100, 300, 800, 1800, 3600],
  },
  {
    id: 'bulletSpeed',
    nameKey: 'asteroids.rl.upg.bulletSpeed',
    descKey: 'asteroids.rl.upg.bulletSpeed.desc',
    icon: '\u{1F3AF}',
    maxTier: 5,
    costs: [70, 200, 550, 1200, 2500],
  },
  {
    id: 'magnet',
    nameKey: 'asteroids.rl.upg.magnet',
    descKey: 'asteroids.rl.upg.magnet.desc',
    icon: '\u{1F9F2}',
    maxTier: 3,
    costs: [200, 700, 1600],
  },
  {
    id: 'scrapBonus',
    nameKey: 'asteroids.rl.upg.scrapBonus',
    descKey: 'asteroids.rl.upg.scrapBonus.desc',
    icon: '\u{1F4B0}',
    maxTier: 3,
    costs: [160, 560, 1400],
  },
  {
    id: 'shieldGen',
    nameKey: 'asteroids.rl.upg.shieldGen',
    descKey: 'asteroids.rl.upg.shieldGen.desc',
    icon: '\u{1F50B}',
    maxTier: 3,
    costs: [300, 1000, 2400],
  },
  {
    id: 'critStrike',
    nameKey: 'asteroids.rl.upg.critStrike',
    descKey: 'asteroids.rl.upg.critStrike.desc',
    icon: '\u2694\uFE0F',
    maxTier: 3,
    costs: [250, 800, 2000],
  },
  {
    id: 'retroThruster',
    nameKey: 'asteroids.rl.upg.retroThruster',
    descKey: 'asteroids.rl.upg.retroThruster.desc',
    icon: '\u{1F6D1}',
    maxTier: 1,
    costs: [150],
  },
];

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
}

export const BOSS_VARIANT_CONFIG: Record<BossVariant, BossVariantConfig> = {
  standard: { hp: 10, fireInterval: 120, speed: 0.3 },
  twin:     { hp: 7,  fireInterval: 150, speed: 0.4 },
  shield:   { hp: 12, fireInterval: 100, speed: 0.25, shieldHp: 5, shieldRegenRate: 0.02 },
  carrier:  { hp: 15, fireInterval: 140, speed: 0.2,  spawnInterval: 180 },
};

// ---------------------------------------------------------------------------
// Boss variant selection per wave
// ---------------------------------------------------------------------------

export function getBossVariantForWave(wave: number): BossVariant {
  if (wave <= 5) return 'standard';
  if (wave <= 10) return 'twin';
  if (wave <= 15) return 'shield';
  if (wave <= 20) return 'carrier';
  // wave 25+: random
  const variants: BossVariant[] = ['standard', 'twin', 'shield', 'carrier'];
  return variants[Math.floor(Math.random() * variants.length)];
}

/** Wave-based HP scaling for bosses — they get stronger in late game */
export function getBossWaveHpScale(wave: number): number {
  if (wave <= 5) return 1;
  // +15% HP per 5 waves after wave 5
  return 1 + Math.floor((wave - 5) / 5) * 0.15;
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
  large: 15,
  medium: 10,
  small: 5,
  boss: 200,
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
}

export function getAppliedStats(
  upgrades: Partial<Record<PermanentUpgradeId, number>>,
  shipId?: ShipId,
): AppliedStats {
  const tier = (id: PermanentUpgradeId): number => upgrades[id] ?? 0;
  const ship = shipId ? SHIP_MAP[shipId] : null;

  const base: AppliedStats = {
    maxLives: 3 + tier('hull') + (ship?.hpMod ?? 0),
    accel: 0.12 * (1 + tier('engine') * 0.12) * (ship?.accelMod ?? 1),
    turnSpeed: 0.065 * (1 + tier('gyroscope') * 0.12) * (ship?.turnSpeedMod ?? 1),
    bulletDamage: (1 + tier('caliber')) * (ship?.bulletDamageMod ?? 1),
    fireCooldown: 150 * (1 - tier('fireRate') * 0.12) * (ship?.fireRateMod ?? 1),
    bulletSpeed: 7 * (1 + tier('bulletSpeed') * 0.10),
    magnetRange: [0, 80, 150, 250][tier('magnet')] * (ship?.scrapRadiusMod ?? 1),
    scrapMultiplier: (1 + tier('scrapBonus') * 0.20) * (ship?.scrapMultMod ?? 1),
    shieldRechargeMs: [Infinity, 45000, 30000, 20000][tier('shieldGen')] * (ship?.shieldRechargeMod ?? 1),
    critChance: [0, 0.08, 0.15, 0.22][tier('critStrike')],
    hasBrake: tier('retroThruster') >= 1,
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
];

export const ARTIFACT_MAP: Record<ArtifactId, ArtifactDef> = Object.fromEntries(
  ARTIFACTS.map((a) => [a.id, a]),
) as Record<ArtifactId, ArtifactDef>;

export function pickRandomArtifacts(count: number, collected: ArtifactId[]): ArtifactDef[] {
  const collectedSet = new Set(collected);
  const eligible = ARTIFACTS.filter((a) => !collectedSet.has(a.id));
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
};

export function rollWaveEvent(wave: number): WaveEventType | null {
  if (wave < 5) return null;
  if (Math.random() > 0.20) return null;
  const roll = Math.random();
  if (roll < 0.40) return 'scrapBonus';
  if (roll < 0.75) return 'asteroidSprint';
  return 'miniBossRush';
}

// ---------------------------------------------------------------------------
// Ascension
// ---------------------------------------------------------------------------

export function getAscensionScrapBonus(ascensionLevel: number): number {
  return 1 + ascensionLevel * 0.05;
}

/** Power-up drop rate multiplier — decreases in late game to prevent oversaturation */
export function getPowerupDropScale(wave: number): number {
  if (wave <= 10) return 1;
  // Drops to 0.4 by wave 50
  return Math.max(0.4, 1 - (wave - 10) * 0.015);
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
  { id: 'collect_5000_scrap', nameKey: 'asteroids.rl.ms.collect5000', descKey: 'asteroids.rl.ms.collect5000.desc', icon: '\u{1F4B0}', unlock: { type: 'ship', shipId: 'harvester' } },
  { id: 'ascend_once', nameKey: 'asteroids.rl.ms.ascend', descKey: 'asteroids.rl.ms.ascend.desc', icon: '\u2B50', unlock: { type: 'buff', buffId: 'chainLightning' as TempBuffId } },
  { id: 'defeat_megaboss', nameKey: 'asteroids.rl.ms.megaboss', descKey: 'asteroids.rl.ms.megaboss.desc', icon: '\u{1F451}', unlock: { type: 'artifact', artifactId: 'bossSlayer' as ArtifactId } },
  { id: 'reach_wave_50', nameKey: 'asteroids.rl.ms.reachWave50', descKey: 'asteroids.rl.ms.reachWave50.desc', icon: '\u{1F525}', unlock: { type: 'buff', buffId: 'voidShield' as TempBuffId } },
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
  { id: 'pilot', nameKey: 'asteroids.rl.curse.pilot', descKey: 'asteroids.rl.curse.pilot.desc', icon: '\u{1F3AE}', scrapMultiplier: 0.6, color: '#22d3ee' },
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
