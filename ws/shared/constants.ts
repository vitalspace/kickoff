// Server-side constants (no frontend deps)

export const PITCH_W = 105;
export const PITCH_D = 68;
export const PITCH_H = 0.2;

export const GOAL_W = 7.32;
export const GOAL_H = 2.44;
export const GOAL_D = 2.0;

export const PLAYER_RADIUS = 0.4;
export const PLAYER_HEIGHT = 1.8;
export const BALL_RADIUS = 0.22;

export const MATCH_DURATION = 90;

export type TeamId = "home" | "away";

// ─── NFT → Player stat mapping ────────────────────────────────────────────────
export type NftAbility = "SWIFT" | "POWER_SHOT" | "WALL" | "MAESTRO" | "CLUTCH" | "RUSH";

export interface PlayerStats {
  speed: number;
  shooting: number;
  passing: number;
  defense: number;
  ability?: NftAbility;
}

export const DEFAULT_PLAYER_STATS: PlayerStats = {
  speed: 70,
  shooting: 70,
  passing: 70,
  defense: 70,
};

export const FORMATION_HOME: Array<{ x: number; z: number; isGK: boolean }> = [
  { x: -50, z: 0, isGK: true },
  { x: -38, z: -12, isGK: false },
  { x: -38, z: -4, isGK: false },
  { x: -38, z: 4, isGK: false },
  { x: -38, z: 12, isGK: false },
  { x: -22, z: -10, isGK: false },
  { x: -22, z: 0, isGK: false },
  { x: -22, z: 10, isGK: false },
];

export const FORMATION_AWAY: Array<{ x: number; z: number; isGK: boolean }> = [
  { x: 50, z: 0, isGK: true },
  { x: 38, z: 12, isGK: false },
  { x: 38, z: 4, isGK: false },
  { x: 38, z: -4, isGK: false },
  { x: 38, z: -12, isGK: false },
  { x: 22, z: 10, isGK: false },
  { x: 22, z: 0, isGK: false },
  { x: 22, z: -10, isGK: false },
];
