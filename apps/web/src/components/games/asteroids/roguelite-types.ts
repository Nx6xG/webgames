// Asteroid variants for roguelite
export type AsteroidVariant = 'normal' | 'armored' | 'explosive' | 'homing' | 'splitting';

// Boss variants
export type BossVariant = 'standard' | 'twin' | 'shield' | 'carrier';

// Permanent upgrade IDs
export type PermanentUpgradeId =
  | 'hull' | 'engine' | 'gyroscope' | 'caliber'
  | 'fireRate' | 'bulletSpeed' | 'magnet'
  | 'scrapBonus' | 'shieldGen' | 'critStrike'
  | 'retroThruster';

// Temporary buff IDs
export type TempBuffId =
  | 'piercing' | 'drone' | 'overdrive' | 'emp'
  | 'extraLife' | 'scrapMagnet' | 'timeSlow'
  | 'homingBullets' | 'explosiveBullets' | 'doubleScrap'
  | 'rearGun' | 'regeneration'
  | 'orbitalStrike' | 'chainLightning' | 'voidShield';

export interface PermanentUpgrade {
  id: PermanentUpgradeId;
  nameKey: string;
  descKey: string;
  icon: string;
  maxTier: number;
  costs: number[]; // cost per tier [tier1, tier2, ...]
}

export interface TempBuffDef {
  id: TempBuffId;
  nameKey: string;
  descKey: string;
  icon: string;
  duration: number; // waves (0 = rest of run, -1 = instant)
  color: string;
}

export interface ActiveBuff {
  id: TempBuffId;
  wavesRemaining: number; // 0 = permanent for run, decremented on wave clear
}

// Scrap drop entity (floats in game world)
export interface ScrapDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  life: number; // ms remaining
}

// Drone companion entity
export interface Drone {
  angle: number; // orbit angle around ship
  fireTimer: number;
}

// Roguelite save data (persisted across runs)
export interface RogueliteSave {
  scrap: number;
  upgrades: Partial<Record<PermanentUpgradeId, number>>;
  totalRuns: number;
  bestWave: number;
  bestScore: number;
  ascensionLevel: number;
  selectedShip: ShipId;
  unlockedMilestones: MilestoneId[];
  bestiary: Record<string, BestiaryEntry>;
  totalBossesKilled: number;
  totalAsteroidsKilled: number;
  bestRunScrap: number;
  dailyRun?: DailyRunResult;
}

// Extended asteroid for roguelite (extra fields)
export interface RogueliteAsteroidData {
  hp: number;
  maxHp: number;
  variant: AsteroidVariant;
  scrapValue: number;
}

// Extended boss for roguelite
export interface RogueliteBossData {
  variant: BossVariant;
  shieldHp: number;
  shieldMaxHp: number;
  shieldRegenTimer: number;
  spawnTimer: number; // for carrier
}

// Artifact IDs (boss drops, permanent for run)
export type ArtifactId =
  | 'bouncingBullets' | 'explosionHeal' | 'killSpawnPowerup'
  | 'shrapnelBurst' | 'scrapVampire' | 'asteroidFear'
  | 'ghostShip' | 'overcharge'
  | 'voidArmor' | 'bossSlayer';

export interface ArtifactDef {
  id: ArtifactId;
  nameKey: string;
  descKey: string;
  icon: string;
  color: string;
}

// Elite asteroid modifiers (wave 10+)
export type EliteModifier = 'fast' | 'tiny' | 'teleporter' | 'reflective' | 'shielded' | 'magnetic';

// Between-wave events
export type WaveEventType = 'scrapBonus' | 'asteroidSprint' | 'miniBossRush';

export interface WaveEvent {
  type: WaveEventType;
  timer: number; // ms remaining
}

// Run statistics
export interface RunStats {
  wavesCleared: number;
  asteroidsDestroyed: number;
  eliteAsteroidsDestroyed: number;
  bossesKilled: number;
  buffsChosen: number;
  artifactsCollected: number;
  damageTaken: number;
  scrapEarned: number;
  timePlayed: number; // ms
}

// Ship/Pilot IDs
export type ShipId = 'vanguard' | 'phantom' | 'harvester' | 'striker' | 'sentinel';

export interface ShipDef {
  id: ShipId;
  nameKey: string;
  descKey: string;
  passiveKey: string;
  icon: string;
  color: string;
  hpMod: number;
  accelMod: number;
  turnSpeedMod: number;
  fireRateMod: number;
  bulletDamageMod: number;
  scrapRadiusMod: number;
  scrapMultMod: number;
  shieldRechargeMod: number;
  phaseChance: number;
}

// Milestone IDs
export type MilestoneId =
  | 'reach_wave_10' | 'reach_wave_20' | 'reach_wave_30'
  | 'kill_500_asteroids' | 'kill_50_bosses'
  | 'collect_5000_scrap' | 'ascend_once'
  | 'defeat_megaboss' | 'no_damage_boss'
  | 'all_buffs_run' | 'max_all_upgrades' | 'reach_wave_50';

export interface MilestoneDef {
  id: MilestoneId;
  nameKey: string;
  descKey: string;
  icon: string;
  unlock: MilestoneUnlock;
}

export type MilestoneUnlock =
  | { type: 'ship'; shipId: ShipId }
  | { type: 'buff'; buffId: TempBuffId }
  | { type: 'artifact'; artifactId: ArtifactId };

// Bestiary
export interface BestiaryEntry {
  seen: boolean;
  count: number;
  firstWave?: number;
}

// Curse IDs
export type CurseId = 'glassCannon' | 'swarm' | 'velocity' | 'famine' | 'darkness' | 'berserker' | 'pilot';

export interface CurseDef {
  id: CurseId;
  nameKey: string;
  descKey: string;
  icon: string;
  scrapMultiplier: number;
  color: string;
}

// Daily run
export interface DailyRunResult {
  date: string;
  wave: number;
  score: number;
  scrap: number;
}

// Daily run modifiers
export type DailyModifierId =
  | 'forcedGlassCannon' | 'scrapFrenzy' | 'eliteSwarm' | 'bossRush'
  | 'speedDemon' | 'bulletHell' | 'noPowerups' | 'titanAsteroids'
  | 'richBosses' | 'miniShip' | 'fastAsteroids' | 'heavyHitter';

export interface DailyModifierDef {
  id: DailyModifierId;
  nameKey: string;
  descKey: string;
  icon: string;
  color: string;
}

// Mega-boss
export type MegaBossPhase = 'shield' | 'swarm' | 'core';

export interface MegaBossData {
  phase: MegaBossPhase;
  phaseHp: number;
  phaseMaxHp: number;
  /** HP scale factor for this mega-boss encounter (wave 25=1x, 50=1.5x, etc.) */
  hpScale: number;
  shieldRotation: number;
  shieldSegments: boolean[];
  homingMissiles: Array<{ x: number; y: number; vx: number; vy: number; life: number }>;
  teleportTimer: number;
  transitionTimer: number;
  x: number;
  y: number;
  defeated: boolean;
}
